import Link from "next/link";
import { formatDateTime, yearsWord } from "@/lib/format";
import {
  eventsWord,
  eventKind,
  inDaysWord,
  relativeTime,
  type Invite,
  type UpcomingDate,
} from "./overview";

/*
 * Блоки дашборда — «История» и «Ближайшие даты».
 * Это только разметка: данные и запросы живут в page.tsx. Оба блока подписаны
 * древом и работают при нескольких древах сразу. Приглашения живут в карточке
 * своего древа — за кнопкой «Приглашения · N» (см. invite-popover.tsx).
 */

export type HistoryItem = {
  id: number;
  kind: string;
  summary: string;
  author: string;
  treeId: string;
  treeTitle: string;
  createdAt: string;
};

export type DateItem = UpcomingDate & { treeTitle: string };

export type InviteItem = Invite & { url: string };

/** «Пока ничего не менялось»: спокойная плашка вместо списка */
function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-[14px] border border-dashed border-[var(--p-line)] px-4 py-7 text-center">
      <p className="text-[13.5px] leading-relaxed text-ink-500">{title}</p>
      <p className="mx-auto mt-1 max-w-[46ch] text-[12.5px] leading-relaxed text-ink-400">{hint}</p>
    </div>
  );
}

/* ---------------------------------------------------------------------
   История — последние события доступных древ
   --------------------------------------------------------------------- */

export function HistoryBlock({
  items,
  total,
  showTree,
  historyHref,
  unavailable = false,
}: {
  items: HistoryItem[];
  total: number;
  showTree: boolean;
  historyHref: string | null;
  unavailable?: boolean;
}) {
  return (
    <section className="panel overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--p-line)] px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-display text-[19px] leading-snug text-ink-800">История</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-500">
            {unavailable
              ? "Лента правок древа"
              : total > 0
                ? `${total} ${eventsWord(total)} — что менялось в древе`
                : "Что и когда менялось в древе"}
          </p>
        </div>

        {historyHref && items.length > 0 && (
          <Link
            href={historyHref}
            className="studio-chip transition-colors hover:border-[var(--p-line-3)] hover:text-ink-800"
          >
            вся история <span aria-hidden="true">→</span>
          </Link>
        )}
      </header>

      {items.length === 0 ? (
        <div className="px-5 py-6">
          <EmptyState
            title={
              unavailable
                ? "История пока недоступна."
                : "Пока ничего не менялось."
            }
            hint={
              unavailable
                ? "В Supabase не выполнен файл supabase/tree-history.sql — после него лента заработает."
                : "Первое же событие — новая карточка, связь или участник — появится здесь."
            }
          />
        </div>
      ) : (
        <ol className="divide-y divide-[var(--p-line)]">
          {items.map((item) => {
            const kind = eventKind(item.kind);
            return (
              <li key={item.id}>
                <Link
                  href={`/tree/${item.treeId}/history`}
                  className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--p-row-bg)]"
                >
                  <span
                    aria-hidden="true"
                    className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${kind.dot}`}
                  />

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="min-w-0 break-words text-[13.5px] leading-snug text-ink-800">
                        {item.summary}
                      </span>
                      <span className="studio-chip">{kind.label}</span>
                    </span>

                    <span className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12px] leading-snug text-ink-400">
                      <span className="min-w-0 truncate">{item.author}</span>
                      {showTree && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="min-w-0 truncate">{item.treeTitle}</span>
                        </>
                      )}
                    </span>
                  </span>

                  <time
                    dateTime={item.createdAt}
                    title={formatDateTime(item.createdAt) ?? ""}
                    className="mt-0.5 shrink-0 whitespace-nowrap text-[11.5px] tabular-nums text-ink-400"
                  >
                    {relativeTime(item.createdAt)}
                  </time>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/* ---------------------------------------------------------------------
   Ближайшие даты — дни рождения живущих
   --------------------------------------------------------------------- */

export function DatesBlock({ items, showTree }: { items: DateItem[]; showTree: boolean }) {
  return (
    <article className="panel flex min-w-0 flex-col p-5">
      <h2 className="font-display text-[18px] leading-snug text-ink-800">Ближайшие даты</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-500">Дни рождения</p>

      {items.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="Дат рождения пока нет."
            hint="Как только в карточках появятся день и месяц рождения, ближайшие даты соберутся здесь."
          />
        </div>
      ) : (
        <ul className="mt-4 grid min-w-0 grid-cols-1 gap-2.5">
          {items.map((item) => (
            <li key={item.personId} className="min-w-0">
              <Link
                href={`/tree/${item.treeId}/person/${item.personId}`}
                className="flex items-center justify-between gap-3 rounded-[12px] border border-[var(--p-line-2)] bg-[var(--p-row-bg)] px-3.5 py-2.5 transition-colors hover:border-[var(--p-line-3)]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[13.5px] leading-snug text-ink-800">
                    {item.name}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-snug text-ink-400">
                    {item.dateLabel} · исполнится {item.turning} {yearsWord(item.turning)}
                    {showTree && (
                      <>
                        {" · "}
                        {item.treeTitle}
                      </>
                    )}
                  </span>
                </span>

                <span className="shrink-0 rounded-full border border-[var(--p-acc-line)] bg-[var(--p-acc-bg)] px-2.5 py-1 text-[11.5px] font-medium text-brass-ink">
                  {inDaysWord(item.days)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

