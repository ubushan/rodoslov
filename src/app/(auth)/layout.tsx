import Link from "next/link";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex flex-col justify-center px-5 py-12 sm:px-12 lg:px-16">
        <div className="mb-10 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid h-8 w-8 place-items-center rounded-[9px] border border-brass-600/50 font-display text-[15px] text-brass-600"
          >
            Р
          </span>
            <span className="font-display text-[17px] text-ink-800">Родослов</span>
          </Link>
          <ThemeSwitcher tone="plain" />
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </div>

      <aside className="plate grain relative hidden flex-col justify-end p-12 lg:flex">
        <blockquote className="relative z-10 max-w-md">
          <p className="font-display text-[26px] leading-snug text-album-text">
            «Спросить было у кого — просто никто не записал. Теперь записываем.»
          </p>
          <footer className="mt-4 text-sm text-album-muted">
            Из письма пользователя, который восстановил пять поколений
          </footer>
        </blockquote>
      </aside>
    </div>
  );
}
