import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { embeddedName } from "@/lib/admin";
import { TreeCanvas } from "@/components/tree/TreeCanvas";
import type { InspectorChange } from "@/components/tree/Inspector";
import { formatDateTime } from "@/lib/format";
import { describeChange } from "@/lib/changes";
import type { Person, Relationship, Attachment, MemberRole } from "@/lib/types";

export async function generateMetadata({ params }: { params: Promise<{ treeId: string }> }) {
  const { treeId } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("trees").select("title").eq("id", treeId).single();
  return { title: data ? `${data.title} — Torlmud` : "Древо — Torlmud" };
}

export default async function TreePage({ params }: { params: Promise<{ treeId: string }> }) {
  const { treeId } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: tree }, { data: membership }] = await Promise.all([
    supabase.from("trees").select("id, title, description").eq("id", treeId).single(),
    supabase
      .from("tree_members")
      .select("role")
      .eq("tree_id", treeId)
      .eq("user_id", user!.id)
      .maybeSingle(),
  ]);

  if (!tree || !membership) notFound();

  const [{ data: persons }, { data: relationships }, { data: attachments }] = await Promise.all([
    supabase.from("persons").select("*").eq("tree_id", treeId),
    supabase.from("relationships").select("*").eq("tree_id", treeId),
    supabase.from("person_attachments").select("*").eq("tree_id", treeId),
  ]);

  // Последние правки карточек — для раздела «История» в инспекторе холста.
  // Таблица существующая; если она недоступна, инспектор честно об этом скажет.
  let changes: InspectorChange[] | null = null;
  const { data: history, error: historyError } = await supabase
    .from("person_changes")
    .select("id, person_id, before, after, created_at, by:profiles!person_changes_changed_by_fkey(full_name)")
    .eq("tree_id", treeId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (!historyError) {
    changes = (history ?? []).map((row) => ({
      id: row.id as number,
      personId: row.person_id as string,
      author: embeddedName(row.by) ?? "Удалённый пользователь",
      at: formatDateTime(row.created_at as string) ?? "—",
      summary: describeChange(
        row.before as Record<string, unknown> | null,
        row.after as Record<string, unknown>
      ).join("; "),
    }));
  }

  const role = membership.role as MemberRole;

  // Ключ выбранного вида холста: свой у каждого пользователя и древа. Холст
  // читает его из localStorage и возвращает выбранный режим после перезагрузки.
  const viewStorageKey = `canvas-view:${user!.id}:${treeId}`;

  // Второй стеклянной полосы на странице нет: название древа, роль и разделы
  // переехали в шапку приложения. Здесь остаётся только сам холст на всю высоту.
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1">
        <TreeCanvas
          treeId={treeId}
          treeTitle={tree.title}
          role={role}
          persons={(persons ?? []) as Person[]}
          relationships={(relationships ?? []) as Relationship[]}
          attachments={(attachments ?? []) as Attachment[]}
          changes={changes}
          viewStorageKey={viewStorageKey}
        />
      </div>
    </div>
  );
}
