import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TreeCanvas } from "@/components/tree/TreeCanvas";
import { ROLE_LABEL } from "@/lib/format";
import type { Person, Relationship, Attachment, MemberRole } from "@/lib/types";

export async function generateMetadata({ params }: { params: Promise<{ treeId: string }> }) {
  const { treeId } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("trees").select("title").eq("id", treeId).single();
  return { title: data ? `${data.title} — Родослов` : "Древо — Родослов" };
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

  const role = membership.role as MemberRole;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-mist-200 bg-surface px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-lg px-2 py-1 text-sm text-ink-400 hover:bg-mist-100 hover:text-ink-700"
          >
            Все древа
          </Link>
          <span className="text-mist-300">/</span>
          <h1 className="truncate font-display text-[17px] text-ink-800">{tree.title}</h1>
          <span className="shrink-0 rounded-lg bg-mist-100 px-2 py-0.5 text-xs text-ink-500">
            {ROLE_LABEL[role]}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden text-[13px] text-ink-400 md:inline">
            {persons?.length ?? 0} карточек
          </span>
          <Link
            href={`/tree/${treeId}/settings`}
            className="rounded-lg border border-mist-300 px-3 py-1.5 text-sm text-ink-700 transition-colors hover:border-ink-300"
          >
            Участники и доступ
          </Link>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <TreeCanvas
          treeId={treeId}
          treeTitle={tree.title}
          role={role}
          persons={(persons ?? []) as Person[]}
          relationships={(relationships ?? []) as Relationship[]}
          attachments={(attachments ?? []) as Attachment[]}
        />
      </div>
    </div>
  );
}
