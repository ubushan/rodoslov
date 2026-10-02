import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { embeddedName } from "@/lib/admin";
import { describeChange } from "@/lib/changes";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "История изменений — Родослов" };

/** Что произошло: значок и подпись для списка. */
const KIND_ICON: Record<string, string> = {
  person_created: "＋",
  person_updated: "✎",
  person_deleted: "✕",
  relation_added: "⇄",
  relation_removed: "⇹",
  tree_created: "★",
  tree_renamed: "✎",
  member_added: "＋",
  member_role: "✎",
  member_removed: "✕",
  invite_created: "✉",
  invite_revoked: "✕",
  import: "⇪",
};

type Row = {
  id: number;
  author: string;
  date: string;
  day: string;
  summary: string;
  icon: string;
  diff: string[];
};

export default async function TreeHistoryPage({ params }: { params: Promise<{ treeId: string }> }) {
  const { treeId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const { data: events, error } = await supabase
    .from("tree_events")
    .select("id, kind, summary, details, created_at, actor:profiles!tree_events_actor_fkey(full_name)")
    .eq("tree_id", treeId)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows: Row[] = (events ?? []).map((event) => {
    const details = (event.details ?? null) as Record<string, unknown> | null;
    const before = details?.before as Record<string, unknown> | undefined;
    const after = details?.after as Record<string, unknown> | undefined;
    const stamp = formatDateTime(event.created_at as string) ?? "";
    return {
      id: event.id as number,
      author: embeddedName(event.actor) ?? "Удалённый пользователь",
      date: stamp,
      day: stamp.split(",")[0] ?? "",
      summary: event.summary as string,
      icon: KIND_ICON[event.kind as string] ?? "•",
      // разницу показываем только там, где есть оба снимка карточки
      diff:
        before && after && typeof before === "object" && typeof after === "object"
          ? describeChange(before, after)
          : [],
    };
  });

  let lastDay = "";

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">
      <Link
        href={`/tree/${treeId}`}
        className="text-sm text-ink-400 transition-colors hover:text-ink-700"
      >
        ← К древу «{tree.title}»
      </Link>

      <h1 className="mt-4 text-[30px] leading-tight text-ink-800">История изменений</h1>
      <p className="mt-1.5 max-w-[60ch] text-sm leading-relaxed text-ink-500">
        Кто и когда правил древо: карточки, связи, участники и приглашения. Показаны последние
        200 событий.
      </p>

      {error ? (
        <p className="mt-8 rounded-2xl border border-danger-line bg-danger-soft px-5 py-4 text-sm text-danger-ink">
          История пока недоступна: выполните в Supabase файл{" "}
          <code className="font-mono">supabase/tree-history.sql</code>.
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-mist-300 bg-surface px-5 py-10 text-center text-sm text-ink-400">
          Пока ничего не менялось.
        </p>
      ) : (
        <ol className="mt-8 space-y-2.5">
          {rows.map((row) => {
            const showDay = row.day !== lastDay;
            lastDay = row.day;
            return (
              <li key={row.id}>
                {showDay && (
                  <p className="mb-2 mt-6 text-[12px] uppercase tracking-[0.07em] text-ink-400">
                    {row.day}
                  </p>
                )}
                <div className="flex gap-3 rounded-2xl border border-mist-200 bg-surface px-4 py-3">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-mist-100 text-[13px] text-ink-500"
                  >
                    {row.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[14px] leading-snug text-ink-800">{row.summary}</p>
                    {row.diff.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {row.diff.map((line, index) => (
                          <li key={index} className="text-[13px] leading-snug text-ink-500">
                            {line}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-1 text-[12px] text-ink-400">
                      {row.author} · {row.date.split(",")[1]?.trim() ?? ""}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
