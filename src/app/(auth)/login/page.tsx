import Link from "next/link";
import { LoginForm } from "./form";

export const metadata = { title: "Вход — Родослов" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next = "/dashboard", error } = await searchParams;

  return (
    <>
      <h1 className="text-[28px] leading-tight text-ink-800">С возвращением</h1>
      <p className="mt-2 text-sm text-ink-500">
        Войдите, чтобы продолжить работу над древом.
      </p>

      {error && (
        <p className="mt-5 rounded-[10px] border border-[#e4c3bd] bg-[#fdf4f2] px-3 py-2 text-sm text-[#c05a4d]">
          Вход через внешний сервис не завершился. Попробуйте ещё раз.
        </p>
      )}

      <LoginForm next={next} />

      <p className="mt-6 text-sm text-ink-500">
        Ещё нет аккаунта?{" "}
        <Link href="/signup" className="font-medium text-brass-600 hover:underline">
          Зарегистрироваться
        </Link>
      </p>
    </>
  );
}
