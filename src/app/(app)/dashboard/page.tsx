import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { embeddedName } from "@/lib/admin";
import { ROLE_LABEL, formatDateTime, peopleWord } from "@/lib/format";
import { NewTreeForm } from "./new-tree-form";
import { DatesBlock, HistoryBlock, type DateItem, type HistoryItem, type InviteItem } from "./blocks";
import { InvitePopover } from "./invite-popover";
import { activeInvites, upcomingDates, type Invite, type LivingPerson } from "./overview";

export const metadata = { title: "Мои древа — Torlmud" };

/** Сколько строк показываем в блоках, прежде чем увести в раздел целиком */
const EVENTS_SHOWN = 5;
const DATES_SHOWN = 5;
/** В панели приглашений показываем не больше трёх ссылок на древо */
const INVITES_PER_TREE = 3;

/** «1 древо», «3 древа», «12 древ» */
function treeWord(n: number) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "древо";
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return "древа";
  return "древ";
}

/** «1 участник», «3 участника», «12 участников» */
function memberWord(n: number) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "участник";
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return "участника";
  return "участников";
}

/** Название, роль и описание древа — общая часть обеих раскладок карточки */
function TreeHead({
  title,
  role,
  description,
}: {
  title: string;
  role: string;
  description: string | null;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <h2 className="min-w-0 font-display text-[20px] leading-snug text-ink-800">{title}</h2>
        <span className="studio-chip shrink-0">{ROLE_LABEL[role]}</span>
      </div>

      {description && (
        <p className="mt-2.5 line-clamp-2 max-w-[68ch] text-[13.5px] leading-relaxed text-ink-500">
          {description}
        </p>
      )}
    </>
  );
}

/** Счётчики древа: люди, участники и дата последней правки */
function TreeStats({
  people,
  members,
  updatedAt,
  className = "",
}: {
  people: number;
  members: number;
  updatedAt: string;
  className?: string;
}) {
  return (
    <dl className={`flex flex-wrap gap-x-7 gap-y-3.5 ${className}`}>
      <div>
        <dt className="text-[11.5px] uppercase tracking-[0.08em] text-ink-400">Людей</dt>
        <dd className="mt-0.5 text-[17px] tabular-nums text-ink-800">{people}</dd>
      </div>
      <div>
        <dt className="text-[11.5px] uppercase tracking-[0.08em] text-ink-400">Участников</dt>
        <dd className="mt-0.5 text-[17px] tabular-nums text-ink-800">{members}</dd>
      </div>
      <div className="min-w-0">
        <dt className="text-[11.5px] uppercase tracking-[0.08em] text-ink-400">Обновлено</dt>
        <dd className="mt-0.5 text-[13px] tabular-nums text-ink-600">
          {formatDateTime(updatedAt)}
        </dd>
      </div>
    </dl>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // только своё членство: политика RLS пускает участника к строкам всех
  // участников древа, поэтому без фильтра древо дублировалось по числу родни
  const { data: memberships } = await supabase
    .from("tree_members")
    .select("role, tree_id, trees(id, title, description, updated_at, owner_id)")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  const seen = new Set<string>();
  const rows = ((memberships ?? []).filter((m) => m.trees) as unknown as Array<{
    role: string;
    tree_id: string;
    trees: { id: string; title: string; description: string | null; updated_at: string; owner_id: string };
  }>).filter((row) => {
    if (seen.has(row.tree_id)) return false;
    seen.add(row.tree_id);
    return true;
  });

  const treeIds = rows.map((r) => r.trees.id);
  const treeTitles = new Map(rows.map((r) => [r.trees.id, r.trees.title] as const));
  // ссылки-приглашения RLS отдаёт только владельцу древа
  const ownedIds = rows.filter((r) => r.role === "owner").map((r) => r.trees.id);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  // Счётчики карточек и участников — по одной выборке на все древа сразу
  const [counts, memberRows] = await Promise.all([
    Promise.all(
      rows.map(async (r) => {
        const { count } = await supabase
          .from("persons")
          .select("id", { count: "exact", head: true })
          .eq("tree_id", r.trees.id);
        return count ?? 0;
      })
    ),
    treeIds.length
      ? supabase.from("tree_members").select("tree_id").in("tree_id", treeIds)
      : Promise.resolve({ data: [] as { tree_id: string }[] }),
  ]);

  // Данные трёх блоков: события, живые люди с датой рождения, приглашения.
  // Запросы идут под сессией пользователя, поэтому RLS сам решает, что видно.
  const [eventsResult, peopleResult, invitesResult] = await Promise.all([
    treeIds.length
      ? supabase
          .from("tree_events")
          .select(
            "id, tree_id, kind, summary, created_at, actor:profiles!tree_events_actor_fkey(full_name)",
            { count: "exact" }
          )
          .in("tree_id", treeIds)
          .order("created_at", { ascending: false })
          .limit(EVENTS_SHOWN)
      : Promise.resolve({ data: [] as unknown[], count: 0, error: null }),
    treeIds.length
      ? supabase
          .from("persons")
          .select("id, tree_id, first_name, middle_name, last_name, birth_date")
          .in("tree_id", treeIds)
          .eq("is_living", true)
          .not("birth_date", "is", null)
      : Promise.resolve({ data: [] as LivingPerson[] }),
    ownedIds.length
      ? supabase
          .from("tree_invites")
          .select("id, tree_id, token, role, expires_at, max_uses, uses")
          .in("tree_id", ownedIds)
          .eq("revoked", false)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Invite[] }),
  ]);

  const memberCounts = new Map<string, number>();
  for (const m of (memberRows.data ?? []) as { tree_id: string }[]) {
    memberCounts.set(m.tree_id, (memberCounts.get(m.tree_id) ?? 0) + 1);
  }

  const totalPeople = counts.reduce((sum, n) => sum + n, 0);
  const totalMembers = rows.reduce((sum, r) => sum + (memberCounts.get(r.trees.id) ?? 0), 0);

  const eventRows = (eventsResult.data ?? []) as Array<{
    id: number;
    tree_id: string;
    kind: string;
    summary: string;
    created_at: string;
    actor: unknown;
  }>;
  const historyItems: HistoryItem[] = eventRows.map((event) => ({
    id: Number(event.id),
    kind: String(event.kind),
    summary: String(event.summary),
    author: embeddedName(event.actor) ?? "Удалённый пользователь",
    treeId: String(event.tree_id),
    treeTitle: treeTitles.get(String(event.tree_id)) ?? "Древо",
    createdAt: String(event.created_at),
  }));

  const dateItems: DateItem[] = upcomingDates(
    (peopleResult.data ?? []) as LivingPerson[],
    DATES_SHOWN
  ).map((date) => ({ ...date, treeTitle: treeTitles.get(date.treeId) ?? "Древо" }));

  // Приглашения раскладываем по древам: каждая ссылка живёт за кнопкой
  // «Приглашения · N» в карточке своего древа, общей панели на странице нет.
  // Считаем и все активные ссылки древа — чтобы честно сказать, сколько
  // осталось за тремя показанными.
  const invitesByTree = new Map<string, InviteItem[]>();
  const inviteTotals = new Map<string, number>();
  for (const invite of activeInvites((invitesResult.data ?? []) as Invite[])) {
    inviteTotals.set(invite.tree_id, (inviteTotals.get(invite.tree_id) ?? 0) + 1);
    const list = invitesByTree.get(invite.tree_id) ?? [];
    if (list.length >= INVITES_PER_TREE) continue;
    list.push({ ...invite, url: `${siteUrl}/invite/${invite.token}` });
    invitesByTree.set(invite.tree_id, list);
  }

  // при нескольких древах строки подписаны древом, а ссылка «вся история»
  // ведёт в ленту того древа, чьё событие показано первым
  const showTree = rows.length > 1;
  const historyHref = historyItems.length ? `/tree/${historyItems[0].treeId}/history` : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-5 sm:py-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[28px] leading-tight text-ink-800 sm:text-[30px]">Мои древа</h1>
          <p className="mt-1.5 max-w-[58ch] text-sm leading-relaxed text-ink-500">
            Здесь и те древа, что вы завели сами, и те, куда вас пригласили.
          </p>
        </div>
        <NewTreeForm />
      </header>

      {rows.length === 0 ? (
        // Пустое состояние: спокойное, объясняет первый шаг и не пугает
        <div className="panel mt-8 border-dashed px-5 py-14 text-center sm:px-6">
          <span
            aria-hidden="true"
            className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-[var(--p-acc-line)] bg-[var(--p-acc-bg)] font-display text-[20px] text-brass-ink"
          >
            ✦
          </span>
          <h2 className="mt-4 text-[21px] text-ink-800">Здесь появятся ваши древа</h2>
          <p className="mx-auto mt-2 max-w-[48ch] text-[14.5px] leading-relaxed text-ink-500">
            Начните с себя: нажмите «Новое древо» — первая карточка создастся сама.
            Потом позовите родственников ссылкой из раздела «Участники», и заполните
            историю семьи вместе.
          </p>
        </div>
      ) : (
        <>
          {/* Сводка по всем древам — те же числа, что и на карточках */}
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="studio-chip">
              {rows.length} {treeWord(rows.length)}
            </span>
            <span className="studio-chip">
              {totalPeople} {peopleWord(totalPeople)}
            </span>
            <span className="studio-chip">
              {totalMembers} {memberWord(totalMembers)}
            </span>
          </div>

          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {rows.map((r, i) => {
              const invites = invitesByTree.get(r.trees.id) ?? [];
              const inviteTotal = inviteTotals.get(r.trees.id) ?? 0;
              const more = Math.max(0, inviteTotal - invites.length);
              // Одно древо — карточка занимает всю ширину и раскладывается в две
              // колонки: слева название, описание и переход в древо, справа
              // счётчики и кнопка приглашений. При нескольких древах остаётся
              // прежняя сетка в две колонки, но с той же кнопкой.
              const alone = rows.length === 1;

              return (
                <li key={r.trees.id} className={alone ? "min-w-0 sm:col-span-2" : "min-w-0"}>
                  {/* Карточка древа: сама карточка — не ссылка, иначе внутри
                      нельзя было бы держать кнопку приглашений. */}
                  <article className="panel flex h-full min-w-0 flex-col p-5 transition-colors hover:border-[var(--p-line-3)] sm:p-6">
                    {alone ? (
                      <div className="flex min-w-0 flex-1 flex-col gap-6 md:flex-row md:items-stretch md:gap-8">
                        <Link
                          href={`/tree/${r.trees.id}`}
                          className="flex min-w-0 flex-1 flex-col rounded-[12px]"
                        >
                          <TreeHead
                            title={r.trees.title}
                            role={r.role}
                            description={r.trees.description}
                          />

                          <span className="mt-auto pt-6 text-[13px] font-medium text-brass-500">
                            Открыть древо <span aria-hidden="true">→</span>
                          </span>
                        </Link>

                        <div className="flex shrink-0 flex-col gap-5 border-t border-[var(--p-line)] pt-5 md:w-[340px] md:max-w-[46%] md:justify-between md:border-l md:border-t-0 md:pl-8 md:pt-0 lg:w-[420px]">
                          <TreeStats
                            people={counts[i]}
                            members={memberCounts.get(r.trees.id) ?? 0}
                            updatedAt={r.trees.updated_at}
                          />

                          {inviteTotal > 0 && (
                            <InvitePopover treeId={r.trees.id} items={invites} more={more} />
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        <Link
                          href={`/tree/${r.trees.id}`}
                          className="flex min-w-0 flex-1 flex-col rounded-[12px]"
                        >
                          <TreeHead
                            title={r.trees.title}
                            role={r.role}
                            description={r.trees.description}
                          />

                          <TreeStats
                            className="mt-5"
                            people={counts[i]}
                            members={memberCounts.get(r.trees.id) ?? 0}
                            updatedAt={r.trees.updated_at}
                          />

                          <span className="mt-auto pt-5 text-[13px] font-medium text-brass-500">
                            Открыть древо <span aria-hidden="true">→</span>
                          </span>
                        </Link>

                        {inviteTotal > 0 && (
                          <div className="mt-4">
                            <InvitePopover treeId={r.trees.id} items={invites} more={more} />
                          </div>
                        )}
                      </>
                    )}
                  </article>
                </li>
              );
            })}
          </ul>

          {/* Ниже — даты и история: приглашения уехали в карточки древ.
              items-start: панель дат не растягивается по высоте ленты истории */}
          <div className="mt-8 grid items-start gap-4 lg:grid-cols-2">
            <DatesBlock items={dateItems} showTree={showTree} />
            <HistoryBlock
              items={historyItems}
              total={eventsResult.count ?? historyItems.length}
              showTree={showTree}
              historyHref={historyHref}
              unavailable={Boolean(eventsResult.error)}
            />
          </div>
        </>
      )}
    </div>
  );
}
