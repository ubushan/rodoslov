import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentAdmin, embeddedName } from "@/lib/admin";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { AccountMenu } from "@/components/account/AccountMenu";
import { ContextNav, TreeSearchButton } from "@/components/shell/ContextNav";
import {
  TreeProvider,
  TreeCrumbs,
  type TreeContextData,
} from "@/components/shell/TreeContext";
import type { MemberRole } from "@/lib/types";

/**
 * Контекст древа для шапки. Серверный layout не знает адрес запроса, поэтому
 * middleware кладёт путь в заголовок `x-pathname`. Внутри /tree/<id> забираем
 * название, роль пользователя и участников обычным запросом под его сессией
 * (RLS сам решает, что видно); новых таблиц и полей не нужно.
 */
async function treeContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<TreeContextData | null> {
  const pathname = (await headers()).get("x-pathname") ?? "";
  const treeId = /^\/tree\/([^/]+)/.exec(pathname)?.[1];
  if (!treeId) return null;

  const [{ data: tree }, { data: members }] = await Promise.all([
    supabase.from("trees").select("id, title").eq("id", treeId).maybeSingle(),
    supabase
      .from("tree_members")
      .select("user_id, role, created_at, profiles(full_name)")
      .eq("tree_id", treeId)
      .order("created_at"),
  ]);

  const me = members?.find((member) => member.user_id === userId);
  if (!tree || !me) return null;

  return {
    id: tree.id as string,
    title: tree.title as string,
    role: me.role as MemberRole,
    members: (members ?? []).map((member) => ({
      id: member.user_id as string,
      name: embeddedName(member.profiles) ?? "Участник",
      role: member.role as MemberRole,
    })),
  };
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, admin, tree] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    currentAdmin(),
    treeContext(supabase, user.id),
  ]);

  const name = profile?.full_name ?? user.email ?? "Аккаунт";

  return (
    <div className="flex h-dvh flex-col bg-mist-100">
      {/* Парящая стеклянная шапка: бренд, контекст древа (название, раздел,
          роль) и разделы; справа — поиск, темы и меню аккаунта, куда уезжают
          участники, профиль, админка и выход. Стопки аватаров в шапке нет:
          состав древа — строка «Участники и доступ» в меню.
          На телефоне слова «Torlmud» нет, а темы переключаются одной кнопкой. */}
      <header
        className="sticky top-0 z-30 shrink-0 px-3 sm:px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      >
        <div className="glass mx-auto flex min-h-[52px] w-full max-w-[1600px] items-center gap-2 px-2.5 py-2 sm:gap-3 sm:px-3">
          <TreeProvider initial={tree}>
            {/* Левая группа — как .top__l в прототипе: бренд, контекст древа и
                разделы; под тесноту ужимается название, а не ряд разделов. */}
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <Link
                href="/dashboard"
                className="flex shrink-0 items-center gap-2.5"
                aria-label="Torlmud — мои древа"
              >
                <span
                  aria-hidden="true"
                  className="grid h-7 w-7 place-items-center rounded-[9px] border border-[var(--p-acc-line)] bg-[var(--p-acc-bg)] font-display text-[13px] text-brass-ink"
                >
                  T
                </span>
                <span className="hidden font-display text-[15px] font-semibold text-ink-800 md:block">
                  Torlmud
                </span>
              </Link>

              <TreeCrumbs />

              <ContextNav />
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {/* Поиск по древу: видна только внутри /tree/<id> — вне древа
                  компонент не рендерится вовсе */}
              <TreeSearchButton />

              <ThemeSwitcher tone="plain" />

              <AccountMenu name={name} isAdmin={!!admin} />
            </div>
          </TreeProvider>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
