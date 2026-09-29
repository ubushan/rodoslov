import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { acceptInvite } from "@/app/actions/members";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL, ROLE_HINT } from "@/lib/format";

export const metadata = { title: "Приглашение — Родослов" };

const ERRORS: Record<string, string> = {
  notfound: "Такой ссылки не существует. Проверьте, что скопировали её целиком.",
  revoked: "Владелец отозвал эту ссылку. Попросите прислать новую.",
  expired: "Срок действия ссылки истёк. Попросите владельца создать новую.",
  exhausted: "По этой ссылке уже прошло максимальное число людей.",
  unknown: "Присоединиться не получилось. Попробуйте ещё раз чуть позже.",
};

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
    <div className="plate grain flex min-h-dvh items-center justify-center px-5 py-12">
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-surface p-7 shadow-plate">
        <Link href="/" className="mb-6 flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid h-8 w-8 place-items-center rounded-[9px] border border-brass-600/50 font-display text-[15px] text-brass-600"
          >
            Р
          </span>
          <span className="font-display text-[17px] text-ink-800">Родослов</span>
        </Link>

        {error && (
          <p className="mb-5 rounded-[10px] border border-danger-line bg-danger-soft px-3 py-2.5 text-sm leading-relaxed text-danger">
            {ERRORS[error] ?? ERRORS.unknown}
          </p>
        )}

        {!preview ? (
          <>
            <h1 className="text-[24px] leading-tight text-ink-800">Ссылка не работает</h1>
            <p className="mt-2.5 text-[15px] leading-relaxed text-ink-500">
              Возможно, она отозвана или скопирована не полностью. Попросите родственника
              прислать приглашение ещё раз.
            </p>
            <Link href="/" className="mt-6 inline-block">
              <Button variant="secondary">На главную</Button>
            </Link>
          </>
        ) : !preview.valid ? (
          <>
            <h1 className="text-[24px] leading-tight text-ink-800">Приглашение недействительно</h1>
            <p className="mt-2.5 text-[15px] leading-relaxed text-ink-500">
              Срок действия истёк или ссылку отозвали. Попросите владельца древа создать
              новую.
            </p>
            <Link href="/" className="mt-6 inline-block">
              <Button variant="secondary">На главную</Button>
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-[24px] leading-tight text-ink-800">
              Вас зовут в древо «{preview.tree_title}»
            </h1>
            <p className="mt-2.5 text-[15px] leading-relaxed text-ink-500">
              Роль: {ROLE_LABEL[preview.role]}. {ROLE_HINT[preview.role]}.
            </p>

            {user ? (
              <form
                action={async () => {
                  "use server";
                  await acceptInvite(token);
                }}
                className="mt-7"
              >
                <Button type="submit" size="lg" className="w-full">
                  Присоединиться к древу
                </Button>
              </form>
            ) : (
              <div className="mt-7 space-y-3">
                <p className="text-sm leading-relaxed text-ink-500">
                  Чтобы присоединиться, войдите или заведите аккаунт — после этого древо
                  откроется автоматически.
                </p>
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
            )}
          </>
        )}
      </div>
    </div>
  );
}
