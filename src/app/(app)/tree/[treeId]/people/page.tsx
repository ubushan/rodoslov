import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fullName, lifespan } from "@/lib/format";
import type { Person, Relationship } from "@/lib/types";
import { PeopleList, type PeopleRow } from "./people-list";

export const metadata = { title: "Люди — Torlmud" };

/**
 * Поколение по связям: супруги считаются одной семьёй (у них общее поколение —
 * как в раскладке холста), дети встают на поколение ниже родителя. Люди без
 * записанных родителей — корни, у них первое поколение. Ничего не выдумываем:
 * число выводится только из связей `parent` и `spouse` самого древа.
 */
function generationsByPerson(persons: Person[], relationships: Relationship[]): Map<string, number> {
  const known = new Set(persons.map((p) => p.id));
  const unit = new Map<string, string>(persons.map((p) => [p.id, p.id]));

  const find = (id: string): string => {
    let root = id;
    while (unit.get(root) !== root) root = unit.get(root)!;
    let walk = id;
    while (unit.get(walk) !== root) {
      const next = unit.get(walk)!;
      unit.set(walk, root);
      walk = next;
    }
    return root;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) unit.set(rb, ra);
  };

  for (const rel of relationships) {
    if (rel.kind !== "spouse") continue;
    if (!known.has(rel.from_person_id) || !known.has(rel.to_person_id)) continue;
    union(rel.from_person_id, rel.to_person_id);
  }

  const parentsOf = new Map<string, string[]>();
  for (const rel of relationships) {
    if (rel.kind !== "parent") continue;
    if (!known.has(rel.from_person_id) || !known.has(rel.to_person_id)) continue;
    const parent = find(rel.from_person_id);
    const child = find(rel.to_person_id);
    if (parent === child) continue; // аномалия в данных: не зацикливаемся
    parentsOf.set(child, [...(parentsOf.get(child) ?? []), parent]);
  }

  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  /** Самая длинная цепочка предков: корень — первое поколение. */
  const generationOf = (id: string): number => {
    const cached = depth.get(id);
    if (cached) return cached;
    if (visiting.has(id)) return 1; // цикл в связях — не уходим в бесконечность
    visiting.add(id);
    let value = 1;
    for (const parent of parentsOf.get(id) ?? []) {
      value = Math.max(value, generationOf(parent) + 1);
    }
    visiting.delete(id);
    depth.set(id, value);
    return value;
  };

  return new Map(persons.map((p) => [p.id, generationOf(find(p.id))]));
}

export default async function PeoplePage({ params }: { params: Promise<{ treeId: string }> }) {
  const { treeId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: tree }, { data: membership }] = await Promise.all([
    supabase.from("trees").select("id, title").eq("id", treeId).single(),
    supabase
      .from("tree_members")
      .select("role")
      .eq("tree_id", treeId)
      .eq("user_id", user!.id)
      .maybeSingle(),
  ]);

  // доступ тот же, что у остальных страниц древа: только участники
  if (!tree || !membership) notFound();

  const [{ data: persons }, { data: relationships }] = await Promise.all([
    supabase.from("persons").select("*").eq("tree_id", treeId),
    supabase.from("relationships").select("*").eq("tree_id", treeId),
  ]);

  const people = (persons ?? []) as Person[];
  const relations = (relationships ?? []) as Relationship[];
  const generations = generationsByPerson(people, relations);

  // ключи сортировки отдельно, чтобы в клиент уехали только нужные поля
  const sortKeys = new Map<string, { birthYear: number | null; name: string }>();
  const rows: PeopleRow[] = people.map((person) => {
    const years = lifespan(person);
    sortKeys.set(person.id, {
      birthYear: person.birth_year ?? null,
      name: `${person.last_name} ${person.first_name}`.trim(),
    });
    return {
      id: person.id,
      name: fullName(person),
      maiden: person.maiden_name,
      gender: person.gender,
      years,
      place: person.birth_place ?? person.residence ?? null,
      generation: generations.get(person.id) ?? null,
      isLiving: person.is_living,
      hasDates: years !== null,
    };
  });

  // старшие поколения — выше, внутри поколения — по старшинству
  rows.sort((a, b) => {
    const ka = sortKeys.get(a.id)!;
    const kb = sortKeys.get(b.id)!;
    return (
      (a.generation ?? 0) - (b.generation ?? 0) ||
      (ka.birthYear ?? 9999) - (kb.birthYear ?? 9999) ||
      ka.name.localeCompare(kb.name, "ru")
    );
  });

  return <PeopleList treeId={treeId} treeTitle={tree.title} rows={rows} />;
}
