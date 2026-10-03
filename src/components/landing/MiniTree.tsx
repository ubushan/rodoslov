type Person = {
  id: string;
  name: string;
  years: string;
  place: string;
  x: number;
  y: number;
  i: string;
  sex: "male" | "female";
};

const PEOPLE: Person[] = [
  { id: "p1", name: "Пётр Ковалёв", years: "1931 — 2004", place: "Вологда", x: 0, y: 0, i: "ПК", sex: "male" },
  { id: "p2", name: "Анна Ковалёва", years: "1934 — 2011", place: "Вологда", x: 196, y: 0, i: "АК", sex: "female" },
  { id: "p3", name: "Сергей Ковалёв", years: "р. 1958", place: "Ярославль", x: 98, y: 132, i: "СК", sex: "male" },
  { id: "p4", name: "Мария Ковалёва", years: "р. 1989", place: "Москва", x: 0, y: 264, i: "МК", sex: "female" },
  { id: "p5", name: "Артём Ковалёв", years: "р. 1993", place: "Тбилиси", x: 196, y: 264, i: "АК", sex: "male" },
];

/**
 * Фрагмент древа на холсте в точку: связи поколений — цветом линий холста,
 * супружество — пунктиром цвета связи, кромка карточки — по полу.
 * Карточки те же, что и в редакторе, только уменьшенные.
 */
export function MiniTree() {
  return (
    <div
      className="panel canvas-dots mx-auto w-full max-w-[440px] p-3"
      style={{ borderColor: "var(--p-line-3)" }}
    >
      <div className="relative w-full select-none" style={{ aspectRatio: "376 / 364" }}>
        <svg
          viewBox="0 0 376 364"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
          fill="none"
        >
          {/* супруги */}
          <path
            d="M172 50 H 204"
            stroke="var(--color-bond-400)"
            strokeWidth="2"
            strokeDasharray="5 4"
          />
          {/* родители → сын */}
          <path
            d="M188 58 V 96 Q 188 108 188 120"
            stroke="var(--color-canvas-line)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* сын → дети */}
          <path
            d="M188 190 V 214 Q 188 226 176 226 H 76 Q 64 226 64 238 V 258"
            stroke="var(--color-canvas-line)"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M188 190 V 214 Q 188 226 200 226 H 300 Q 312 226 312 238 V 258"
            stroke="var(--color-canvas-line)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>

        {PEOPLE.map((p, idx) => (
          <article
            key={p.id}
            className="rise absolute flex items-center gap-2 overflow-hidden rounded-[13px] border border-[var(--p-line)] bg-surface px-2.5 py-2 shadow-lift"
            style={{
              left: `${(p.x / 376) * 100}%`,
              top: `${(p.y / 364) * 100}%`,
              width: `${(180 / 376) * 100}%`,
              animationDelay: `${0.12 * idx + 0.15}s`,
            }}
          >
            <span
              aria-hidden="true"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-album font-display text-[11.5px] text-brass-400"
            >
              {p.i}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-[13px] leading-tight text-ink-800">
                {p.name}
              </span>
              <span className="block truncate text-[11px] leading-tight text-ink-400">
                {p.years} · {p.place}
              </span>
            </span>
            <span
              aria-hidden="true"
              className="absolute inset-x-0 bottom-0 h-[2px]"
              style={{
                background: p.sex === "female" ? "var(--color-female)" : "var(--color-male)",
              }}
            />
          </article>
        ))}
      </div>
    </div>
  );
}
