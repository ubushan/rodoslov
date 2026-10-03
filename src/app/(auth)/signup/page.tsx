import Link from "next/link";
import { SignupForm } from "./form";
import { Button } from "@/components/ui/button";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Регистрация — Torlmud" };

export default async function SignupPage() {
  // регистрацию можно закрыть в панели администратора
  const { allowSignups } = await getSettings();

  if (!allowSignups) {
    return (
      <>
        <span className="studio-chip">Регистрация</span>
        <h1 className="mt-4 font-display text-[26px] leading-tight text-ink-800 sm:text-[28px]">
          Регистрация закрыта
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">
          Новые аккаунты сейчас не создаются — так решил администратор платформы. Если вас
          пригласили в древо, войдите в существующий аккаунт или попросите приглашение заново.
        </p>
        <Link href="/login" className="mt-6 block">
          <Button size="lg" className="w-full">
            Войти
          </Button>
        </Link>
      </>
    );
  }

  return (
    <>
      <span className="studio-chip">Регистрация</span>

      <h1 className="mt-4 font-display text-[26px] leading-tight text-ink-800 sm:text-[28px]">
        Заведите семейный архив
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-500">
        Аккаунт нужен, чтобы древо сохранилось и его увидели только те, кого вы пригласите.
      </p>

      <SignupForm />

      <p className="mt-7 text-sm text-ink-500">
        Уже зарегистрированы?{" "}
        <Link
          href="/login"
          className="font-medium text-brass-600 underline decoration-brass-500/40 underline-offset-4 hover:decoration-brass-500"
        >
          Войти
        </Link>
      </p>
    </>
  );
}
