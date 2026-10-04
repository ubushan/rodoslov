"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { shortName, peopleWord } from "@/lib/format";
import type { Person } from "@/lib/types";

export type PersonNodeData = {
  person: Person;
  photoUrl: string | null;
  /** на странице ветки: сколько человек общего древа в неё не попало */
  hiddenCount?: number;
  onOpen: (id: string) => void;
};

/**
 * «1889–1954», «1974» — годы в углу карточки, как в прототипе.
 * Полные даты в карточку не влезают (11px моноширинного текста в правом
 * верхнем углу), поэтому берём только год: остальное — в карточке человека.
 */
function cardYears(person: Person) {
  const yearOf = (iso: string | null, year: number | null) => {
    if (iso) {
      const m = /(\d{4})/.exec(iso);
      if (m) return m[1];
      return iso;
    }
    return year ? String(year) : null;
  };
  const birth = yearOf(person.birth_date, person.birth_year);
  const death = yearOf(person.death_date, person.death_year);
  if (person.is_living) return birth;
  if (!birth && !death) return null;
  return `${birth ?? "?"}–${death ?? "?"}`;
}

/**
 * Карточка на холсте — 176×100, как в прототипе студии:
 *   верхняя строка  — портрет кругом слева, годы справа;
 *   нижняя строка   — имя (до трёх строк);
 *   кромка по низу  — цвет пола (рисует .studio-card).
 *
 * Диаметр портрета задаёт --face-size в .person-card: карточка, сетка и круг
 * берут одно значение, поэтому круг можно растить, не трогая размеры карточки.
 *
 * Кнопок на самой карточке нет: клик выделяет человека и открывает панель
 * деталей (инспектор) справа, там «Открыть карточку», «Открыть семейную
 * ветку» и добавление родственников. Двойной клик открывает карточку.
 *
 * Точки-хэндлы скрыты в CSS: к ним крепятся линии связи.
 */
function PersonNodeComponent({ data, selected }: NodeProps) {
  const { person, photoUrl, hiddenCount, onOpen } = data as PersonNodeData;
  const years = cardYears(person);

  // кромка по низу — по полу: значения заданы токенами темы, поэтому карточка
  // читается и в тёмной, и в светлой. Полосу 2px рисует .studio-card через
  // .is-male/.is-female.
  const genderClass =
    person.gender === "male" ? "is-male" : person.gender === "female" ? "is-female" : "";

  return (
    <div
      data-selected={selected ? "true" : undefined}
      className={`person-card studio-card ${genderClass} relative grid h-[100px] w-[176px] cursor-pointer grid-cols-[var(--face-size)_1fr] grid-rows-[var(--face-size)_auto] content-start gap-x-2 px-2.5 py-2`}
      onDoubleClick={() => onOpen(person.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onOpen(person.id)}
      aria-label={`Карточка: ${shortName(person)}`}
    >
      {/* связи с родителями — сверху, с детьми — снизу (сами точки скрыты в CSS) */}
      <Handle id="parent-in" type="target" position={Position.Top} />
      <Handle id="child-out" type="source" position={Position.Bottom} />
      <Handle id="spouse-l" type="target" position={Position.Left} />
      <Handle id="spouse-r" type="source" position={Position.Right} />

      {/* верхняя строка: портрет кругом --face-size — фото или силуэт по полу */}
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt=""
          crossOrigin="anonymous"
          className={`col-start-1 row-start-1 h-[var(--face-size)] w-[var(--face-size)] rounded-full border border-[var(--p-line)] object-cover ${
            person.is_living ? "" : "opacity-80 saturate-50"
          }`}
        />
      ) : (
        // без фотографии — силуэт-заглушка: голова и плечи цветом пола,
        // как в прототипе (подробности — в .card-face)
        <span
          aria-hidden="true"
          className={`card-face col-start-1 row-start-1 ${person.is_living ? "" : "opacity-70"}`}
        />
      )}

      {/* годы — справа в верхней строке, моноширинным набором как в прототипе */}
      {years && (
        <span className="col-start-2 row-start-1 min-w-0 justify-self-end self-center truncate pl-1 font-mono text-[11px] leading-none tabular-nums text-ink-400">
          {years}
        </span>
      )}

      {/* имя — во всю ширину, до трёх строк: кегль прототипа (15px) сохранён,
          три строки влезают в карточку рядом с крупным портретом */}
      <span className="col-span-2 col-start-1 row-start-2 line-clamp-3 font-display text-[15px] font-medium leading-[1.07] tracking-[-0.01em] text-ink-800 [overflow-wrap:anywhere]">
        {shortName(person)}
      </span>

      {/* сколько человек общего древа не попало в открытую ветку */}
      {!!hiddenCount && (
        <span className="studio-chip pointer-events-none absolute -top-11 left-1/2 -translate-x-1/2">
          скрыто {hiddenCount} {peopleWord(hiddenCount)}
        </span>
      )}
    </div>
  );
}

export const PersonNode = memo(PersonNodeComponent);
