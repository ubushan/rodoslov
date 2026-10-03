import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { acceptInvite } from "@/app/actions/members";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { ROLE_LABEL, ROLE_HINT } from "@/lib/format";

export const metadata = { title: "Приглашение — Torlmud" };

const ERRORS: Record<string, string> = {
  notfound: "Такой ссылки не существует. Проверьте, что скопировали её целиком.",
  revoked: "Владелец отозвал эту ссылку. Попросите прислать новую.",
  expired: "Срок действия ссылки истёк. Попросите владельца создать новую.",
  exhausted: "По этой ссылке уже прошло максимальное число людей.",
  unknown: "Присоединиться не получилось. Попробуйте ещё раз чуть позже.",
};

/**
 * Приём приглашения: та же тёмная «обложка», что на входе, а решение —
 * на непрозрачной панели. Логика не меняется: токен читает invite_preview,
 * присоединение делает server action acceptInvite.
 */
export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase.rpc("invite_preview", { p_token: token });
  const preview = Array.isArray(data) ? data[0] : null;

  return (
    <div className="plate grain relative flex min-h-dvh flex-col overflow-hidden">
      <header
        className="relative z-20 mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-5 pb-4 sm:px-8"
        style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top))" }}
      >
        <Link href="/" className="flex items-center gap-2.5" aria-label="Torlmud — на главную">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 place-items-center rounded-[10px] border border-brass-400/50 bg-white/[0.06] font-display text-[16px] text-brass-400"
          >
            T
          </span>
          <span className="font-display text-[18px] text-album-text">Torlmud</span>
        </Link>
        <ThemeSwitcher tone="cover" />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-5 pb-16 pt-6 sm:px-8">
        <div
          className="panel w-full max-w-lg p-6 sm:p-8"
          style={{ background: "var(--color-mist-50)", borderColor: "var(--p-line-3)" }}
        >
          {error && (
            <p
              role="alert"
              className="mb-5 rounded-[12px] border border-danger-line bg-danger-soft px-3.5 py-3 text-[13.5px] leading-relaxed text-danger-ink"
            >
              {ERRORS[error] ?? ERRORS.unknown}
            </p>
          )}

          {!preview ? (
            <>
              <span className="studio-chip">Приглашение</span>
              <h1 className="mt-4 font-display text-[25px] leading-tight text-ink-800 sm:text-[28px]">
                Ссылка не работает
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-500">
                Возможно, она отозвана или скопирована не полностью. Попросите родственника
                прислать приглашение ещё раз.
              </p>
              <Link href="/" className="mt-6 block">
                <Button variant="secondary" size="lg" className="w-full">
                  На главную
                </Button>
              </Link>
            </>
          ) : !preview.valid ? (
            <>
              <span className="studio-chip">Приглашение</span>
              <h1 className="mt-4 font-display text-[25px] leading-tight text-ink-800 sm:text-[28px]">
                Приглашение недействительно
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-ink-500">
                Срок действия истёк или ссылку отозвали. Попросите владельца древа создать новую.
              </p>
              <Link href="/" className="mt-6 block">
                <Button variant="secondary" size="lg" className="w-full">
                  На главную
                </Button>
              </Link>
            </>
          ) : (
            <>
              <span className="studio-chip">Приглашение</span>

              <h1 className="mt-4 font-display text-[25px] leading-tight text-ink-800 sm:text-[28px]">
                Вас пригласили в древо
              </h1>
              <p className="mt-2.5 font-display text-[21px] leading-snug text-brass-600 sm:text-[23px]">
                «{preview.tree_title}»
              </p>

              <div className="mt-5 rounded-[14px] border border-[var(--p-line)] bg-[var(--p-row-bg)] p-4">
                <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink-400">
                  Ваша роль
                </p>
                <p className="mt-1.5 font-display text-[17px] text-ink-800">
                  {ROLE_LABEL[preview.role]}
                </p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-ink-500">
                  {ROLE_HINT[preview.role]}.
                </p>
              </div>

              {user ? (
                <form
                  action={async () => {
                    "use server";
                    await acceptInvite(token);
                  }}
                  className="mt-6"
                >
                  <Button type="submit" size="lg" className="w-full">
                    Присоединиться к древу
                  </Button>
                </form>
              ) : (
                <div className="mt-6">
                  <p className="text-sm leading-relaxed text-ink-500">
                    Чтобы присоединиться, войдите или заведите аккаунт — после этого древо
                    откроется автоматически.
                  </p>
                  <div className="mt-5 space-y-3">
                    <Link href={`/signup?next=/invite/${token}`} className="block">
                      <Button size="lg" className="w-full">
                        Создать аккаунт
                      </Button>
                    </Link>
                    <Link href={`/login?next=/invite/${token}`} className="block">
                      <Button size="lg" variant="secondary" className="w-full">
                        У меня уже есть аккаунт
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <footer
        className="relative z-10 mx-auto w-full max-w-3xl px-5 pt-2 text-xs text-album-muted sm:px-8"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        Приглашение открывает доступ только к одному древу и только с выбранной ролью.
      </footer>
    </div>
  );
}
