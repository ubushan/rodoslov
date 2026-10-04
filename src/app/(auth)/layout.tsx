import Link from "next/link";
import { TorlmudMark } from "@/components/brand/TorlmudMark";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";

/* Смысл сервиса слева от формы — на широком экране.
   На телефоне колонка скрыта, короткая строка остаётся над панелью. */
const POINTS = [
  "Одно древо на всю семью: карточки, связи, фотографии и документы.",
  "Доступ по ссылке-приглашению: владелец, редактор или зритель.",
  "Готовое древо скачивается картинкой — для печати и семейного чата.",
];

/**
 * Вход и регистрация: тёмная «обложка» на весь экран, форма — на панели.
 * Панель непрозрачная (не .glass): её поверхность и поля должны читаться
 * одинаково в любой из четырёх тем, а обложка остаётся тёмной всегда.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="plate grain relative flex min-h-dvh flex-col overflow-hidden">
      <header
        className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 pb-4 sm:px-8"
        style={{ paddingTop: "calc(1.25rem + env(safe-area-inset-top))" }}
      >
        <Link href="/" className="flex items-center gap-2.5" aria-label="Torlmud — на главную">
          <span
            aria-hidden="true"
            className="grid h-9 w-9 place-items-center rounded-[10px] border border-brass-400/50 bg-white/[0.06] text-brass-400"
          >
            <TorlmudMark className="h-5 w-5" />
          </span>
          <span className="font-display text-[18px] text-album-text">Torlmud</span>
        </Link>
        <ThemeSwitcher tone="cover" />
      </header>

      <main className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-5 pb-14 pt-6 sm:px-8 lg:grid-cols-[1.05fr_minmax(380px,440px)] lg:gap-16 lg:pb-20">
        <section className="hidden lg:block">
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-brass-400">
            Семейный архив
          </p>
          <h2 className="mt-4 max-w-[16ch] font-display text-[clamp(2rem,3.4vw,3rem)] leading-[1.08] text-album-text">
            Древо, которое собирают вместе
          </h2>
          <p className="mt-5 max-w-[46ch] text-[16px] leading-relaxed text-album-muted">
            Бабушка помнит имена и деревни, дядя хранит фотографии, сестра знает, кто на ком
            женился. Torlmud собирает эти кусочки в одно древо, к которому открыт доступ
            родным.
          </p>
          <ul className="mt-9 max-w-[46ch] space-y-3.5">
            {POINTS.map((point) => (
              <li key={point} className="flex gap-3 text-[14.5px] leading-relaxed text-album-muted">
                <span
                  aria-hidden="true"
                  className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full bg-brass-400"
                />
                {point}
              </li>
            ))}
          </ul>
        </section>

        <section className="w-full">
          <p className="mb-5 max-w-[36ch] text-[14.5px] leading-relaxed text-album-muted lg:hidden">
            Древо, которое собирают вместе: общие карточки, доступ по ссылке и экспорт
            картинкой.
          </p>
          <div
            className="panel w-full p-6 sm:p-8"
            style={{ background: "var(--color-mist-50)", borderColor: "var(--p-line-3)" }}
          >
            {children}
          </div>
        </section>
      </main>

      <footer
        className="relative z-10 mx-auto w-full max-w-6xl px-5 pt-2 text-xs text-album-muted sm:px-8"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
      >
        Torlmud — семейное древо, которое собирают вместе
      </footer>
    </div>
  );
}
