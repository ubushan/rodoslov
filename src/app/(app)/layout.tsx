import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { currentAdmin } from "@/lib/admin";
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
        className="sticky top-0 z-30 border-b border-ink-600 bg-ink-800/95 backdrop-blur"
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
            <span className="font-display text-[15px] text-mist-50">Родослов</span>
          </Link>

          <div className="flex items-center gap-1">
            {admin && (
              <Link
                href="/admin"
                className="rounded-lg px-2.5 py-1.5 text-sm text-brass-400 transition-colors hover:bg-white/10 hover:text-brass-300 sm:px-3"
              >
                Админка
              </Link>
            )}
            <Link
              href="/profile"
              className="max-w-[38vw] truncate rounded-lg px-2.5 py-1.5 text-sm text-mist-300 transition-colors hover:bg-white/10 hover:text-mist-50 sm:max-w-none sm:px-3"
            >
              {name}
            </Link>
            <form action={signOut}>
              <button className="rounded-lg px-3 py-1.5 text-sm text-ink-300 transition-colors hover:bg-white/10 hover:text-mist-50">
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
