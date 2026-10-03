import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { ProfileForm } from "./form";

export const metadata = { title: "Профиль — Torlmud" };

/** «Тест Torlmud» → «ТР» */
function initials(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]).join("");
  return letters.toUpperCase() || "?";
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user!.id)
    .single();

  const name = profile?.full_name ?? "";
  const email = user!.email ?? "";

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-5 sm:py-12">
      <header>
        <h1 className="text-[28px] leading-tight text-ink-800 sm:text-[30px]">Профиль</h1>
        <p className="mt-1.5 max-w-[58ch] text-sm leading-relaxed text-ink-500">
          Ваш аккаунт в Torlmud: имя видят родственники в списке участников древа.
        </p>
      </header>

      {/* Кто вошёл: имя, почта и метка аккаунта */}
      <section className="panel mt-6 flex items-center gap-4 p-5">
        <span
          aria-hidden="true"
          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-[var(--p-acc-line)] bg-[var(--p-acc-bg)] font-display text-[21px] text-brass-ink"
        >
          {initials(name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[17px] text-ink-800">{name || "Имя не указано"}</p>
          <p className="mt-0.5 truncate text-[13px] text-ink-400">{email}</p>
        </div>
        <span className="studio-chip ml-auto hidden shrink-0 sm:inline-flex">аккаунт</span>
      </section>

      {/* Данные аккаунта: имя меняется, почта — нет */}
      <section className="panel mt-5 overflow-hidden">
        <header className="border-b border-[var(--p-line)] px-5 py-4">
          <h2 className="font-display text-[19px] leading-snug text-ink-800">Имя и почта</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-500">
            Имя подставляется в карточку участника и в подписи правок.
          </p>
        </header>
        <div className="p-5">
          <ProfileForm fullName={name} email={email} />
        </div>
      </section>

      {/* Выход: отдельным блоком, чтобы не путался с сохранением */}
      <section className="panel mt-5 overflow-hidden">
        <header className="border-b border-[var(--p-line)] px-5 py-4">
          <h2 className="font-display text-[19px] leading-snug text-ink-800">Выход</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-500">
            Завершает сеанс на этом устройстве. Древа и данные останутся на месте.
          </p>
        </header>
        <div className="p-5">
          <form action={signOut}>
            <Button variant="secondary" className="w-full sm:w-auto">
              Выйти из аккаунта
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
