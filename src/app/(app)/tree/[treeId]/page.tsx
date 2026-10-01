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
            className="hidden items-center rounded-lg border border-mist-300 px-3 py-1.5 text-sm text-ink-700 transition-colors hover:border-ink-300 sm:flex"
          >
            Участники и доступ
          </Link>
          {/* на телефоне — компактная кнопка с иконкой, чтобы панель не росла вниз */}
          <Link
            href={`/tree/${treeId}/settings`}
            aria-label="Участники и доступ"
            title="Участники и доступ"
            className="grid h-9 w-9 place-items-center rounded-lg border border-mist-300 text-ink-600 transition-colors hover:border-ink-300 sm:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <circle cx="6.8" cy="6.4" r="2.2" />
              <path d="M2.6 13.8c.4-2.2 2.1-3.5 4.2-3.5s3.8 1.3 4.2 3.5" />
              <path d="M12.6 5.6c1.4.3 2.3 1.4 2.3 2.7 0 1.2-.7 2.2-1.8 2.6M11.9 11.4c1.9.4 3 1.7 3.3 3.4" />
            </svg>
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
