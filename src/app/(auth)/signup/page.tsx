import Link from "next/link";
import { SignupForm } from "./form";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Регистрация — Родослов" };

export default async function SignupPage() {
  // регистрацию можно закрыть в панели администратора
  const { allowSignups } = await getSettings();

  if (!allowSignups) {
    return (
      <>
        <h1 className="text-[28px] leading-tight text-ink-800">Регистрация закрыта</h1>
        <p className="mt-2 text-sm text-ink-500">
          Новые аккаунты сейчас не создаются — так решил администратор платформы. Если вас
          пригласили в древо, войдите в существующий аккаунт или попросите приглашение заново.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-brass-500 px-6 text-[15px] font-medium text-ink-900 transition-colors hover:bg-brass-400"
        >
          Войти
        </Link>
      </>
    );
  }

  return (
    <>
      <h1 className="text-[28px] leading-tight text-ink-800">Заведите семейный архив</h1>
      <p className="mt-2 text-sm text-ink-500">
        Аккаунт нужен, чтобы древо сохранилось и его увидели только те, кого вы пригласите.
      </p>

      <SignupForm />

      <p className="mt-6 text-sm text-ink-500">
        Уже зарегистрированы?{" "}
        <Link href="/login" className="font-medium text-brass-600 hover:underline">
          Войти
        </Link>
      </p>
    </>
  );
}
