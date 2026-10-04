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
 * Полные даты в карточку не влезают (10px моноширинного текста в правом
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
 *   первая строка — портрет кругом по центру карточки, у верхней кромки;
 *   годы          — в правом верхнем углу, вне сетки;
 *   вторая строка — имя по центру (до двух строк);
 *   кромка по низу — цвет пола (рисует .person-card::after по --card-accent).
 *
 * Диаметр портрета задаёт --face-size в .person-card: карточка, сетка и круг
 * берут одно значение, поэтому круг можно растить, не трогая размеры карточки.
 *
 * Почему портрет не делит строку с годами: годы «1889–1954» — ~58px
 * моноширинного 10px, а по бокам от круга по центру остаётся меньше места.
 * Поэтому годы лежат в самом углу (absolute right-2.5 top-px), где круг уже
 * сузился, и не наезжают на портрет ни при каком диапазоне лет.
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
  // читается и в тёмной, и в светлой. Полоса задаёт --card-accent, из неё же
  // берётся цвет свечения выделения (.person-card.is-male/.is-female).
  const genderClass =
    person.gender === "male" ? "is-male" : person.gender === "female" ? "is-female" : "";

  return (
    <div
      data-selected={selected ? "true" : undefined}
      className={`person-card studio-card ${genderClass} relative grid h-[100px] w-[176px] cursor-pointer grid-cols-1 grid-rows-[var(--face-size)_auto] content-start justify-items-center px-2.5 pb-2 pt-2`}
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
      {/* вид «слева направо»: предки слева, дети справа, супруги — друг под
          другом, поэтому у карточки есть и боковые, и парные точки. Сторону
          выбирает холст (см. TreeCanvas), точки всё равно скрыты. */}
      <Handle id="kin-in" type="target" position={Position.Left} />
      <Handle id="kin-out" type="source" position={Position.Right} />
      <Handle id="pair-in" type="target" position={Position.Top} />
      <Handle id="pair-out" type="source" position={Position.Bottom} />

      {/* верхняя строка: портрет кругом --face-size по центру карточки —
          фото или силуэт по полу */}
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt=""
          crossOrigin="anonymous"
          className={`col-start-1 row-start-1 h-[var(--face-size)] w-[var(--face-size)] justify-self-center rounded-full border border-[var(--p-line)] object-cover ${
            person.is_living ? "" : "opacity-80 saturate-50"
          }`}
        />
      ) : (
        // без фотографии — силуэт-заглушка: голова и плечи цветом пола,
        // как в прототипе (подробности — в .card-face)
        <span
          aria-hidden="true"
          className={`card-face col-start-1 row-start-1 justify-self-center ${person.is_living ? "" : "opacity-70"}`}
        />
      )}

      {/* годы — правый верхний угол, моноширинным набором как в прототипе.
          Вне сетки: в своей строке над портретом они отнимали бы у круга
          высоту, а в общей — наезжали бы на него (см. комментарий выше).
          Отступ сверху и кегль поменьше: у самой кромки цифры «липли» к рамке
          и визуально спорили с крупным портретом, поэтому воздух сверху есть,
          а сами годы набраны на шаг мельче (10px). */}
      {years && (
        <span className="absolute right-2.5 top-[7px] font-mono text-[10px] leading-none tabular-nums text-ink-400">
          {years}
        </span>
      )}

      {/* имя — во всю ширину, по центру, до двух строк (14px — на шаг мельче
          прототипного 15px, чтобы крупный портрет не давил на текст).
          Три строки с крупным портретом (46px) в 100px карточки не влезают:
          третья строка уходила под кромку пола, поэтому клэмп — две строки.
          line-clamp обрезает по content-box, а при плотном интерлиньяже нижние
          хвосты букв (у, р, д) уходят ниже строки и срезались. Здесь интерлиньяж
          1.2 — ровно по метрикам шрифта (хвост выступает на ~0.01px), поэтому
          нижний отступ нужен только страховочный: 1px расширяет область
          обрезки, отрицательный margin его же компенсирует. Верх третьей (скрытой
          клэмпом) строки начинается в ~3.4px ниже content-box, поэтому 1px
          отступа её не показывает; при прежних 3px под «Проверова…» проступала
          верхушка «С» третьей строки. */}
      <span className="col-span-1 col-start-1 row-start-2 line-clamp-2 -mb-px w-full pb-px text-center font-display text-[14px] font-medium leading-[1.2] tracking-[-0.01em] text-ink-800 [overflow-wrap:anywhere]">
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
