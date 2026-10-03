import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PersonPage, type NewRelation } from "@/components/person/PersonPage";
import type { ChangeRow } from "@/components/person/PersonHistory";
import { getSettings } from "@/lib/settings";
import { shortName, formatDateTime, publicUrl } from "@/lib/format";
import { embeddedName } from "@/lib/admin";
import type { Person, Relationship, Attachment, MemberRole } from "@/lib/types";

type Params = { params: Promise<{ treeId: string; personId: string }> };
type Search = { searchParams: Promise<{ relateTo?: string; relation?: string }> };

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

/**
 * Размеры файлов архива: Storage отдаёт Content-Length по публичной ссылке.
 * Если файл не ответил (или бакет закрыт) — размер просто не показываем,
 * вместо него в списке остаётся дата добавления.
 */
async function attachmentSizes(attachments: Attachment[]) {
  const sizes: Record<string, number> = {};
  await Promise.all(
    attachments.map(async (a) => {
      const url = publicUrl(SUPABASE_URL, "archive", a.storage_path);
      if (!url) return;
      try {
        const res = await fetch(url, {
          method: "HEAD",
          cache: "no-store",
          signal: AbortSignal.timeout(1500),
        });
        const length = Number(res.headers.get("content-length"));
        if (res.ok && Number.isFinite(length) && length > 0) sizes[a.id] = length;
      } catch {
        // размер не критичен — без него покажем дату добавления
      }
    })
  );
  return sizes;
}

export async function generateMetadata({ params }: Params) {
  const { treeId, personId } = await params;
  if (personId === "new") return { title: "Новая карточка — Torlmud" };

  const supabase = await createClient();
  const { data } = await supabase
    .from("persons")
    .select("first_name, last_name, maiden_name, tree_id")
    .eq("id", personId)
    .eq("tree_id", treeId)
    .maybeSingle();

  return { title: data ? `${shortName(data)} — Torlmud` : "Карточка — Torlmud" };
}

export default async function PersonCardPage({ params, searchParams }: Params & Search) {
  const { treeId, personId } = await params;
  const { relateTo, relation } = await searchParams;
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

  if (!tree || !membership) notFound();

  const isNew = personId === "new";

  const [{ data: persons }, { data: relationships }, { data: attachments }, { error: deathPlaceError }] =
    await Promise.all([
      supabase.from("persons").select("*").eq("tree_id", treeId),
      supabase.from("relationships").select("*").eq("tree_id", treeId),
      supabase.from("person_attachments").select("*").eq("tree_id", treeId),
      // колонка места смерти может быть ещё не добавлена в базу — тогда прячем поле
      supabase.from("persons").select("death_place").limit(0),
    ]);

  const person = isNew ? null : ((persons ?? []) as Person[]).find((p) => p.id === personId);
  if (!isNew && !person) notFound();

  const relationKinds: NewRelation[] = ["child", "spouse", "father", "mother", "brother", "sister"];
  const kind = relationKinds.includes(relation as NewRelation) ? (relation as NewRelation) : null;

  // предел числа людей в древе: задаёт администратор платформы
  const { maxPersonsPerTree } = await getSettings();
  const limitReached =
    isNew && maxPersonsPerTree > 0 && (persons?.length ?? 0) >= maxPersonsPerTree;

  // история изменений: таблица может ещё отсутствовать — тогда покажем подсказку
  let changes: ChangeRow[] | null = null;
  if (!isNew && person) {
    const { data: history, error: historyError } = await supabase
      .from("person_changes")
      .select("id, changed_by, before, after, created_at, by:profiles!person_changes_changed_by_fkey(full_name)")
      .eq("person_id", person.id)
      .order("created_at", { ascending: false });
    if (historyError) {
      changes = null;
    } else {
      changes = (history ?? []).map((row) => ({
        id: row.id as number,
        author: embeddedName(row.by) ?? "Удалённый пользователь",
        createdAt: formatDateTime(row.created_at as string) ?? "—",
        before: row.before as Record<string, unknown> | null,
        after: row.after as Record<string, unknown>,
      }));
    }
  }

  const personAttachments = ((attachments ?? []) as Attachment[]).filter(
    (a) => a.person_id === person?.id
  );
  const sizes = await attachmentSizes(personAttachments);

  return (
    <PersonPage
      treeId={treeId}
      treeTitle={tree.title}
      role={membership.role as MemberRole}
      person={person ?? null}
      persons={(persons ?? []) as Person[]}
      relationships={(relationships ?? []) as Relationship[]}
      attachments={personAttachments}
      attachmentSizes={sizes}
      hasDeathPlace={!deathPlaceError}
      relation={relateTo && kind ? { relateTo, kind } : null}
      limitReached={limitReached}
      changes={changes}
    />
  );
}
