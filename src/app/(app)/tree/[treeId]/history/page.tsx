import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { embeddedName } from "@/lib/admin";
import { describeChange } from "@/lib/changes";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "История изменений — Torlmud" };

/** Что произошло: значок, подпись чипа и тон для списка. */
const KIND: Record<string, { icon: string; label: string; tone: string }> = {
  person_created: { icon: "＋", label: "Карточка", tone: "text-male border-male/40 bg-male/10" },
  person_updated: { icon: "✎", label: "Карточка", tone: "text-male border-male/40 bg-male/10" },
  person_deleted: { icon: "✕", label: "Карточка", tone: "text-male border-male/40 bg-male/10" },
  relation_added: { icon: "⇄", label: "Связь", tone: "text-ink-600 border-[var(--p-line)] bg-[var(--p-row-bg)]" },
  relation_removed: { icon: "⇹", label: "Связь", tone: "text-ink-600 border-[var(--p-line)] bg-[var(--p-row-bg)]" },
  tree_created: { icon: "★", label: "Древо", tone: "text-brass-500 border-[var(--p-acc-line)] bg-[var(--p-acc-bg)]" },
  tree_renamed: { icon: "✎", label: "Древо", tone: "text-brass-500 border-[var(--p-acc-line)] bg-[var(--p-acc-bg)]" },
  member_added: { icon: "＋", label: "Участник", tone: "text-female border-female/40 bg-female/10" },
  member_role: { icon: "✎", label: "Роль", tone: "text-female border-female/40 bg-female/10" },
  member_removed: { icon: "✕", label: "Участник", tone: "text-female border-female/40 bg-female/10" },
  invite_created: { icon: "✉", label: "Приглашение", tone: "text-brass-500 border-[var(--p-acc-line)] bg-[var(--p-acc-bg)]" },
  invite_revoked: { icon: "✕", label: "Приглашение", tone: "text-brass-500 border-[var(--p-acc-line)] bg-[var(--p-acc-bg)]" },
  import: { icon: "⇪", label: "Импорт", tone: "text-ink-600 border-[var(--p-line)] bg-[var(--p-row-bg)]" },
};

const UNKNOWN_KIND = { icon: "•", label: "Событие", tone: "text-ink-600 border-[var(--p-line)] bg-[var(--p-row-bg)]" };

type Row = {
  id: number;
  author: string;
  time: string;
  day: string;
  summary: string;
  kind: { icon: string; label: string; tone: string };
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
      time: stamp.split(",")[1]?.trim() ?? "",
      day: stamp.split(",")[0] ?? "",
      summary: event.summary as string,
      kind: KIND[event.kind as string] ?? UNKNOWN_KIND,
      // разницу показываем только там, где есть оба снимка карточки
      diff:
        before && after && typeof before === "object" && typeof after === "object"
          ? describeChange(before, after)
          : [],
    };
  });

  // Лента по дням: заголовок дня, под ним — компактные строки одного дня
  const groups: { day: string; rows: Row[] }[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (!last || last.day !== row.day) groups.push({ day: row.day, rows: [row] });
    else last.rows.push(row);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-5 sm:py-12">
      <Link
        href={`/tree/${treeId}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-400 transition-colors hover:text-ink-700"
      >
        <span aria-hidden="true">←</span> К древу «{tree.title}»
      </Link>

      <h1 className="mt-4 text-[28px] leading-tight text-ink-800 sm:text-[30px]">
        История изменений
      </h1>
      <p className="mt-1.5 max-w-[60ch] text-sm leading-relaxed text-ink-500">
        Кто и когда правил древо: карточки, связи, участники и приглашения.
      </p>

      {error ? (
        <p className="panel mt-8 border-danger-line bg-danger-soft px-5 py-4 text-sm leading-relaxed text-danger-ink">
          История пока недоступна: выполните в Supabase файл{" "}
          <code className="font-mono">supabase/tree-history.sql</code>.
        </p>
      ) : rows.length === 0 ? (
        <p className="panel mt-8 border-dashed px-5 py-12 text-center text-sm text-ink-400">
          Пока ничего не менялось.
        </p>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="studio-chip">
              {rows.length} {eventsWord(rows.length)}
            </span>
            <span className="studio-chip">
              {groups.length} {daysWord(groups.length)} · последние 200 событий
            </span>
          </div>

          <div className="mt-7 space-y-7">
            {groups.map((group) => (
              <section key={group.day}>
                <div className="mb-2.5 flex items-center gap-3 px-1">
                  <h2 className="text-[12px] font-semibold uppercase tracking-[0.1em] text-ink-400">
                    {group.day}
                  </h2>
                  <span aria-hidden="true" className="h-px flex-1 bg-[var(--p-line)]" />
                  <span className="text-[12px] tabular-nums text-ink-300">{group.rows.length}</span>
                </div>

                <ol className="panel divide-y divide-[var(--p-line)] overflow-hidden">
                  {group.rows.map((row) => (
                    <li key={row.id} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border text-[13px] ${row.kind.tone}`}
                      >
                        {row.kind.icon}
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="min-w-0 break-words text-[14px] leading-snug text-ink-800">
                            {row.summary}
                          </p>
                          <span className="studio-chip h-[22px] px-2 text-[11px]">
                            {row.kind.label}
                          </span>
                        </div>

                        {row.diff.length > 0 && (
                          <ul className="mt-1.5 space-y-0.5 border-l border-[var(--p-line)] pl-2.5">
                            {row.diff.map((line, index) => (
                              <li
                                key={index}
                                className="break-words text-[12.5px] leading-snug text-ink-500"
                              >
                                {line}
                              </li>
                            ))}
                          </ul>
                        )}

                        <p className="mt-1.5 break-words text-[12px] text-ink-400">
                          {row.author}
                          {row.time && <span className="tabular-nums"> · {row.time}</span>}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** «1 событие», «3 события», «12 событий» */
function eventsWord(n: number) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "событие";
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return "события";
  return "событий";
}

/** «1 день», «3 дня», «12 дней» */
function daysWord(n: number) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "день";
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return "дня";
  return "дней";
}
