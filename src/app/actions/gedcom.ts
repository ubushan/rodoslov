"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { autoLayout } from "@/lib/layout";
import { savePositions } from "./persons";
import { exportGedcom, parseGedcom } from "@/lib/gedcom";
import type { Person, Relationship } from "@/lib/types";

export type GedcomResult = { error?: string; ok?: string };

/** Роль пользователя в древе или null, если доступа нет. */
async function roleOf(treeId: string): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("tree_members")
    .select("role")
    .eq("tree_id", treeId)
    .eq("user_id", user.id)
    .maybeSingle();
  return data?.role ?? null;
}

/** Скачивание GEDCOM — доступно любому участнику древа. */
export async function exportTree(
  treeId: string
): Promise<{ filename: string; content: string } | { error: string }> {
  const role = await roleOf(treeId);
  if (!role) return { error: "У вас нет доступа к этому древу" };

  const supabase = await createClient();
  const [{ data: persons }, { data: relationships }, { data: tree }] = await Promise.all([
    supabase.from("persons").select("*").eq("tree_id", treeId),
    supabase.from("relationships").select("*").eq("tree_id", treeId),
    supabase.from("trees").select("title").eq("id", treeId).single(),
  ]);

  const content = exportGedcom((persons ?? []) as Person[], (relationships ?? []) as Relationship[]);
  const base = (tree?.title ?? "древо").replace(/[^\wа-яА-ЯёЁ\- ]/g, "").trim() || "древо";
  return { filename: `${base}.ged`, content };
}

/** Импорт GEDCOM — создаёт людей и связи, после чего раскладывает древо. */
export async function importGedcom(treeId: string, text: string): Promise<GedcomResult> {
  const role = await roleOf(treeId);
  if (role !== "owner" && role !== "editor") return { error: "Импортировать могут владелец и редакторы" };

  const parsed = parseGedcom(text);
  if (parsed.persons.length === 0) return { error: "В файле не нашлось ни одной записи о человеке" };
  if (parsed.persons.length > 5000) return { error: "Слишком большой файл: не больше 5000 человек" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Нужно войти" };

  const { maxPersonsPerTree } = await getSettings();
  const { count } = await supabase
    .from("persons")
    .select("id", { count: "exact", head: true })
    .eq("tree_id", treeId);
  const existing = count ?? 0;
  if (maxPersonsPerTree > 0 && existing + parsed.persons.length > maxPersonsPerTree) {
    return { error: `Импорт превысил бы предел ${maxPersonsPerTree} человек в древе` };
  }

  // колонка места смерти может ещё отсутствовать в базе
  const { error: deathProbeError } = await supabase.from("persons").select("death_place").limit(0);
  const hasDeathPlace = !deathProbeError;

  const payloads = parsed.persons.map((p) => ({
    tree_id: treeId,
    created_by: user.id,
    last_name: p.last_name,
    first_name: p.first_name,
    middle_name: p.middle_name,
    maiden_name: p.maiden_name,
    gender: p.gender,
    birth_year: p.birth_year,
    birth_date: p.birth_date,
    birth_place: p.birth_place,
    is_living: !(p.death_date || p.death_year || p.death_place),
    death_year: p.death_year,
    death_date: p.death_date,
    ...(hasDeathPlace ? { death_place: p.death_place } : {}),
    residence: p.residence,
    bio: p.bio,
    pos_x: 0,
    pos_y: 0,
  }));

  const { data: created, error: insertError } = await supabase
    .from("persons")
    .insert(payloads)
    .select("id, birth_date, birth_year, gender");

  if (insertError) return { error: "Не удалось создать карточки" };

  const idOf = new Map<string, string>();
  parsed.persons.forEach((p, index) => idOf.set(p.xref, created[index].id as string));

  // связи из FAM: супруги (HUSB+WIFE) и родители (HUSB/WIFE → CHIL)
  const rels: { kind: "parent" | "spouse"; from: string; to: string }[] = [];
  for (const family of parsed.families) {
    const husb = family.husb ? idOf.get(family.husb) : undefined;
    const wife = family.wife ? idOf.get(family.wife) : undefined;
    if (husb && wife) rels.push({ kind: "spouse", from: husb, to: wife });
    for (const childRef of family.children) {
      const child = idOf.get(childRef);
      if (!child) continue;
      if (husb) rels.push({ kind: "parent", from: husb, to: child });
      if (wife) rels.push({ kind: "parent", from: wife, to: child });
    }
  }

  // уникальные связи: в GEDCOM одно и то же родство иногда описано дважды
  const seen = new Set<string>();
  const unique = rels.filter((rel) => {
    const key =
      rel.kind === "spouse"
        ? `spouse|${[rel.from, rel.to].sort().join("|")}`
        : `${rel.kind}|${rel.from}|${rel.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const relRows = unique.map((rel) => ({
    tree_id: treeId,
    kind: rel.kind,
    from_person_id: rel.from,
    to_person_id: rel.to,
  }));
  if (relRows.length) {
    const { error: relError } = await supabase.from("relationships").insert(relRows);
    if (relError) console.error("Не удалось сохранить связи импорта:", relError.message);
  }

  // раскладываем импортированных людей по поколениям
  try {
    const nodes = created.map((row) => ({
      id: row.id as string,
      position: { x: 0, y: 0 },
      data: { person: row },
    }));
    const edges = relRows.map((rel, index) => ({
      id: `import-${index}`,
      source: rel.from_person_id,
      target: rel.to_person_id,
      data: { kind: rel.kind },
    }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const laid = autoLayout(nodes as any, edges as any);
    await savePositions(
      treeId,
      laid.map((node) => ({ id: node.id, x: node.position.x, y: node.position.y }))
    );
  } catch (error) {
    console.error("Не удалось разложить импортированное древо:", error);
  }

  revalidatePath(`/tree/${treeId}`);

  // сводка импорта в историю древа; отдельные карточки туда пишет триггер
  const { error: logError } = await supabase.rpc("log_tree_event", {
    p_tree: treeId,
    p_kind: "import",
    p_summary: `Импортировал GEDCOM: ${parsed.persons.length} человек, ${unique.length} связей`,
  });
  if (logError) console.error("Не удалось записать импорт в историю:", logError.message);

  return {
    ok: `Импортировано: ${parsed.persons.length} человек, ${unique.length} связей`,
  };
}
