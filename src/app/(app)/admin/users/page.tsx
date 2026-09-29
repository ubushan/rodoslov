import Link from "next/link";
import { Section, Empty } from "@/components/admin/ui";
import { UsersTable, type UserRow } from "@/components/admin/UsersTable";
import { adminClient, adminEmails, adminIds, currentAdmin, hasServiceKey } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Пользователи — Родослов" };

type Search = { searchParams: Promise<{ page?: string }> };
const PER_PAGE = 50;

export default async function AdminUsersPage({ searchParams }: Search) {
  const me = await currentAdmin();
  const { page: pageRaw } = await searchParams;
  const page = Math.max(1, Number(pageRaw ?? 1) || 1);

  if (!hasServiceKey()) {
    return (
      <Section title="Пользователи">
        <Empty>Список пользователей доступен после подключения service role key (см. подсказку выше).</Empty>
      </Section>
    );
  }

  const admin = adminClient();
  const [list, memberships, granted, envAdmins] = await Promise.all([
    admin.auth.admin.listUsers({ page, perPage: PER_PAGE }),
    admin.from("tree_members").select("user_id"),
    adminIds(),
    Promise.resolve(adminEmails()),
  ]);

  if (list.error) {
    return (
      <Section title="Пользователи">
        <Empty>Не удалось получить список: {list.error.message}</Empty>
      </Section>
    );
  }

  const treeCount = new Map<string, number>();
  for (const row of memberships.data ?? []) {
    const id = row.user_id as string;
    treeCount.set(id, (treeCount.get(id) ?? 0) + 1);
  }

  const rows: UserRow[] = (list.data?.users ?? []).map((user) => {
    const email = user.email ?? "";
    const meta = (user.user_metadata ?? {}) as { full_name?: string };
    return {
      id: user.id,
      email: email || "без почты",
      name: meta.full_name?.trim() || email.split("@")[0] || "Без имени",
      createdAt: formatDateTime(user.created_at),
      lastSignInAt: formatDateTime(user.last_sign_in_at ?? null),
      bannedUntil: (user as { banned_until?: string }).banned_until ?? null,
      trees: treeCount.get(user.id) ?? 0,
      isAdmin: granted.has(user.id) || envAdmins.includes(email.toLowerCase()),
      isEnvAdmin: envAdmins.includes(email.toLowerCase()),
      isMe: user.id === me?.id,
    };
  });

  const lastPage = Math.max(1, (list.data as { lastPage?: number } | undefined)?.lastPage ?? page);

  return (
    <div className="space-y-4">
      <Section
        title="Пользователи"
        hint={`Всего на странице: ${rows.length}. Блокировка закрывает вход, удаление забирает и древа пользователя.`}
      >
        {rows.length === 0 ? <Empty>На этой странице никого.</Empty> : <UsersTable rows={rows} />}
      </Section>

      {lastPage > 1 && (
        <div className="flex items-center justify-between text-[13px] text-ink-500">
          {page > 1 ? (
            <Link href={`/admin/users?page=${page - 1}`} className="hover:text-ink-800">
              ← Предыдущая
            </Link>
          ) : (
            <span />
          )}
          <span>
            Страница {page} из {lastPage}
          </span>
          {page < lastPage ? (
            <Link href={`/admin/users?page=${page + 1}`} className="hover:text-ink-800">
              Следующая →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
