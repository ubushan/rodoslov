import Link from "next/link";
import {
  Chip,
  Empty,
  IconArchive,
  IconLink,
  IconMail,
  IconTree,
  IconUser,
  IconUsers,
  Section,
  StatTile,
} from "@/components/admin/ui";
import { adminClient, embeddedName, hasServiceKey, TREE_OWNER_SELECT } from "@/lib/admin";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Обзор — Torlmud" };

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
  const freshTotal = days.reduce((sum, [, n]) => sum + n, 0);

  return (
    <div className="space-y-5">
      {/* Плитки-бенто: цифра крупно, подпись приглушённо, без тяжёлых рамок */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Пользователи" value={users} icon={<IconUsers size={14} />} />
        <StatTile label="Древа" value={trees} icon={<IconTree size={14} />} />
        <StatTile label="Люди в древах" value={persons} icon={<IconUser size={14} />} />
        <StatTile label="Связи" value={relationships} icon={<IconLink size={14} />} />
        <StatTile label="Файлы архива" value={attachments} icon={<IconArchive size={14} />} />
        <StatTile label="Приглашения" value={invites} hint="кроме отозванных" icon={<IconMail size={14} />} />
      </div>

      <Section
        title="Регистрации за две недели"
        hint="сколько аккаунтов появилось в день"
        action={<Chip>всего {freshTotal}</Chip>}
      >
        <div className="flex h-[132px] items-end gap-1 px-4 pb-3 pt-4 sm:gap-1.5 sm:px-5">
          {days.map(([day, n]) => (
            <div key={day} className="flex min-w-0 flex-1 flex-col items-center gap-1.5" title={`${day}: ${n}`}>
              <div className="flex h-[84px] w-full items-end">
                <div
                  className="w-full rounded-t-[6px]"
                  style={{
                    height: `${Math.max(4, (n / peak) * 84)}px`,
                    background:
                      "linear-gradient(180deg, var(--color-brass-400), var(--color-brass-500))",
                  }}
                />
              </div>
              <span className="text-[10px] tabular-nums text-ink-300">{day.slice(8)}</span>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section
          title="Последние древа"
          action={
            <Link href="/admin/trees" className="text-[12.5px] text-brass-ink hover:opacity-80">
              Все древа →
            </Link>
          }
        >
          {(recentTrees.data ?? []).length === 0 ? (
            <Empty>Древ пока нет.</Empty>
          ) : (
            <ul className="divide-y divide-[var(--p-line-2)]">
              {(recentTrees.data ?? []).map((tree) => {
                const owner = embeddedName(tree.owner);
                return (
                  <li key={tree.id} className="last:rounded-b-[19px] hover:bg-[var(--p-row-bg)]">
                    <Link
                      href={`/admin/trees/${tree.id}`}
                      className="flex items-baseline justify-between gap-3 px-4 py-3"
                    >
                      <span className="min-w-0 truncate text-[13.5px] text-ink-800">{tree.title}</span>
                      <span className="shrink-0 text-[11.5px] text-ink-400">
                        {owner ?? "без имени"} · {formatDate(String(tree.created_at))}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section
          title="Новые пользователи"
          action={
            <Link href="/admin/users" className="text-[12.5px] text-brass-ink hover:opacity-80">
              Все пользователи →
            </Link>
          }
        >
          {(recentUsers.data ?? []).length === 0 ? (
            <Empty>Пользователей пока нет.</Empty>
          ) : (
            <ul className="divide-y divide-[var(--p-line-2)]">
              {(recentUsers.data ?? []).map((profile) => (
                <li key={profile.id} className="last:rounded-b-[19px] hover:bg-[var(--p-row-bg)]">
                  <div className="flex items-baseline justify-between gap-3 px-4 py-3">
                    <span className="min-w-0 truncate text-[13.5px] text-ink-800">
                      {profile.full_name ?? "Без имени"}
                    </span>
                    <span className="shrink-0 text-[11.5px] text-ink-400">
                      {formatDate(String(profile.created_at))}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}
