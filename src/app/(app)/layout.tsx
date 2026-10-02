import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentAdmin } from "@/lib/admin";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { AccountMenu } from "@/components/account/AccountMenu";
import { signOut } from "@/app/actions/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, admin] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    currentAdmin(),
  ]);

  const name = profile?.full_name ?? user.email ?? "Аккаунт";

  return (
    <div className="flex h-dvh flex-col bg-mist-100">
      <header
        className="sticky top-0 z-30 border-b border-white/12 bg-album/95 backdrop-blur"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-4 px-4">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="grid h-7 w-7 place-items-center rounded-lg border border-brass-500/50 font-display text-[13px] text-brass-400"
            >
              Р
            </span>
            <span className="font-display text-[15px] text-album-text">Родослов</span>
          </Link>

          <div className="flex items-center gap-1">
            <ThemeSwitcher />
            <AccountMenu name={name} isAdmin={!!admin} />
            {admin && (
              <Link
                href="/admin"
                className="hidden rounded-lg px-2.5 py-1.5 text-sm text-brass-400 transition-colors hover:bg-white/10 hover:text-brass-300 sm:block"
              >
                Админка
              </Link>
            )}
            <Link
              href="/profile"
              className="hidden truncate rounded-lg px-2.5 py-1.5 text-sm text-album-muted transition-colors hover:bg-white/10 hover:text-album-text sm:block"
            >
              {name}
            </Link>
            <form action={signOut} className="hidden sm:block">
              <button className="rounded-lg px-3 py-1.5 text-sm text-album-muted transition-colors hover:bg-white/10 hover:text-album-text">
                Выйти
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
