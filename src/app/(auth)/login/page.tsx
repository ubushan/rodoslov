import Link from "next/link";
import { LoginForm } from "./form";

export const metadata = { title: "Вход — Torlmud" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next = "/dashboard", error } = await searchParams;

  return (
    <>
      <span className="studio-chip">Вход</span>

      <h1 className="mt-4 font-display text-[26px] leading-tight text-ink-800 sm:text-[28px]">
        С возвращением
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-500">
        Войдите, чтобы продолжить работу над древом.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-5 rounded-[12px] border border-danger-line bg-danger-soft px-3.5 py-3 text-[13.5px] leading-relaxed text-danger-ink"
        >
          Вход через внешний сервис не завершился. Попробуйте ещё раз.
        </p>
      )}

      <LoginForm next={next} />

      <p className="mt-7 text-sm text-ink-500">
        Ещё нет аккаунта?{" "}
        <Link
          href="/signup"
          className="font-medium text-brass-600 underline decoration-brass-500/40 underline-offset-4 hover:decoration-brass-500"
        >
          Зарегистрироваться
        </Link>
      </p>
    </>
  );
}
