import Link from "next/link";
import { Section, StatTile, Empty } from "@/components/admin/ui";
import { adminClient, embeddedName, hasServiceKey, TREE_OWNER_SELECT } from "@/lib/admin";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Обзор — Родослов" };

const DAY = 24 * 60 * 60 * 1000;

export default async function AdminOverviewPage() {
  if (!hasServiceKey()) {
    return (
      <Section title="Сводка">
        <Empty>Пока нечего показать: панели нужен ключ service_role (см. подсказку выше).</Empty>
      </Section>
    );
  }

  const admin = adminClient();
  const since = new Date(Date.now() - 13 * DAY);
  since.setHours(0, 0, 0, 0);

  const head = { count: "exact" as const, head: true };

  const [
    profileCount,
    treeCount,
    personCount,
    relationCount,
    attachmentCount,
    inviteCount,
    recentTrees,
    recentUsers,
    fresh,
  ] = await Promise.all([
    admin.from("profiles").select("id", head),
    admin.from("trees").select("id", head),
    admin.from("persons").select("id", head),
    admin.from("relationships").select("id", head),
    admin.from("person_attachments").select("id", head),
    admin.from("tree_invites").select("id", head).eq("revoked", false),
    admin
        .from("trees")
        .select(`id, title, created_at, owner_id, ${TREE_OWNER_SELECT}`)
        .order("created_at", { ascending: false })
        .limit(6),
      admin
        .from("profiles")
        .select("id, full_name, created_at")
        .order("created_at", { ascending: false })
        .limit(6),
      admin.from("profiles").select("created_at").gte("created_at", since.toISOString()),
    ]);

  const users = profileCount.count ?? 0;
  const trees = treeCount.count ?? 0;
  const persons = personCount.count ?? 0;
  const relationships = relationCount.count ?? 0;
  const attachments = attachmentCount.count ?? 0;
  const invites = inviteCount.count ?? 0;

  // регистрации по дням за две недели — столбиками
  const perDay = new Map<string, number>();
  for (let i = 0; i < 14; i++) {
    const day = new Date(since.getTime() + i * DAY);
    perDay.set(day.toISOString().slice(0, 10), 0);
  }
  for (const row of fresh.data ?? []) {
    const key = String(row.created_at).slice(0, 10);
    if (perDay.has(key)) perDay.set(key, (perDay.get(key) ?? 0) + 1);
  }
  const days = [...perDay.entries()];
  const peak = Math.max(1, ...days.map(([, n]) => n));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Пользователи" value={users} />
        <StatTile label="Древа" value={trees} />
        <StatTile label="Люди в древах" value={persons} />
        <StatTile label="Связи" value={relationships} />
        <StatTile label="Файлы архива" value={attachments} />
        <StatTile label="Приглашения" value={invites} hint="кроме отозванных" />
      </div>

      <Section title="Регистрации за две недели" hint="сколько аккаунтов появилось в день">
        <div className="flex h-32 items-end gap-1.5 px-5 py-4">
          {days.map(([day, n]) => (
            <div key={day} className="flex flex-1 flex-col items-center gap-1.5" title={`${day}: ${n}`}>
              <div
                className="w-full rounded-t bg-brass-500/70"
                style={{ height: `${Math.max(3, (n / peak) * 88)}px` }}
              />
              <span className="text-[10px] text-ink-300">{day.slice(8)}</span>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section
          title="Последние древа"
          action={
            <Link href="/admin/trees" className="text-[13px] text-ink-500 hover:text-ink-800">
              Все древа →
            </Link>
          }
        >
          {(recentTrees.data ?? []).length === 0 ? (
            <Empty>Древ пока нет.</Empty>
          ) : (
            <ul className="divide-y divide-mist-200">
              {(recentTrees.data ?? []).map((tree) => {
                const owner = embeddedName(tree.owner);
                return (
                  <li key={tree.id} className="flex items-baseline justify-between gap-3 px-5 py-3">
                    <Link
                      href={`/admin/trees/${tree.id}`}
                      className="truncate text-sm text-ink-800 hover:text-brass-600"
                    >
                      {tree.title}
                    </Link>
                    <span className="shrink-0 text-[12px] text-ink-400">
                      {owner ?? "без имени"} · {formatDate(String(tree.created_at))}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section
          title="Новые пользователи"
          action={
            <Link href="/admin/users" className="text-[13px] text-ink-500 hover:text-ink-800">
              Все пользователи →
            </Link>
          }
        >
          {(recentUsers.data ?? []).length === 0 ? (
            <Empty>Пользователей пока нет.</Empty>
          ) : (
            <ul className="divide-y divide-mist-200">
              {(recentUsers.data ?? []).map((profile) => (
                <li key={profile.id} className="flex items-baseline justify-between gap-3 px-5 py-3">
                  <span className="truncate text-sm text-ink-800">{profile.full_name ?? "Без имени"}</span>
                  <span className="shrink-0 text-[12px] text-ink-400">
                    {formatDate(String(profile.created_at))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
