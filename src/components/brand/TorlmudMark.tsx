/**
 * Знак Torlmud — «спираль рода»: непрерывная линия разворачивается от предка
 * (латунная точка в середине) к потомкам-виткам.
 *
 * Штрих берёт цвет текста, точка настраивается классом: `fill-current` — знак
 * в один цвет, `fill-brass-400` — в два. Размер задаётся снаружи через className.
 *
 * Нарезки две, потому что на 16–24 px полная спираль сливается в пятно:
 *   compact (по умолчанию) — для вкладки браузера, иконки приложения и плашки
 *     в шапке: витков меньше, шаг между ними 6, штрих толще;
 *   full — для крупных размеров (лок-ап, штамп, OG-картинка), где линия
 *     успевает закрутиться трижды.
 *
 * Геометрия один в один с brand/torlmud/svg — при правке знака менять обе части.
 */
const VARIANTS = {
  compact: { d: "M3 3H21V21H3V9H15V15H9V12H12", stroke: 2.3, dot: 1.7 },
  full: { d: "M19 19H5V5h14v10.6H8.4V8.4h7.2V12H12", stroke: 1.7, dot: 1.35 },
} as const;

export function TorlmudMark({
  className,
  dotClassName = "fill-current",
  variant = "compact",
}: {
  className?: string;
  dotClassName?: string;
  variant?: keyof typeof VARIANTS;
}) {
  const mark = VARIANTS[variant];

  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      strokeWidth={mark.stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      // Знак всегда стоит рядом с надписью «Torlmud», поэтому для скринридера
      // он декоративный: имя ссылки даёт текст, а не картинка.
      aria-hidden="true"
    >
      <path d={mark.d} stroke="currentColor" />
      <circle cx="12" cy="12" r={mark.dot} className={dotClassName} />
    </svg>
  );
}
