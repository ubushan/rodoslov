import Link from "next/link";
import { SignupForm } from "./form";

export const metadata = { title: "Регистрация — Родослов" };

export default function SignupPage() {
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
