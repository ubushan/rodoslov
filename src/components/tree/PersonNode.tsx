"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { PersonCardFace } from "@/components/person/PersonCardFace";
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
 * Карточка на холсте — 176×100, как в прототипе студии. Саму внешность
 * (портрет кругом, годы в углу, имя по центру, кромка пола) рисует
 * PersonCardFace — тот же компонент, из которого собраны примеры на главной,
 * поэтому холст и лендинг не могут разойтись.
 *
 * Здесь остаётся только то, что нужно холсту: обёртка узла с обработчиками и
 * атрибутами выделения, скрытые в CSS точки-хэндлы (к ним крепятся линии
 * связи) и чип «скрыто N».
 *
 * Кнопок на самой карточке нет: клик выделяет человека и открывает панель
 * деталей (инспектор) справа, там «Открыть карточку», «Открыть семейную
 * ветку» и добавление родственников. Двойной клик открывает карточку.
 */
function PersonNodeComponent({ data, selected }: NodeProps) {
  const { person, photoUrl, hiddenCount, onOpen } = data as PersonNodeData;

  return (
    <div
      data-selected={selected ? "true" : undefined}
      className="relative cursor-pointer"
      onDoubleClick={() => onOpen(person.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onOpen(person.id)}
      aria-label={`Карточка: ${shortName(person)}`}
    >
      {/* Точки-хэндлы крепятся к карточке, а не к обёртке: слой inset-px
          повторяет padding box карточки (у неё рамка 1px). Без этого линии на
          холсте сдвинулись бы на пиксель — до выноса карточки в
          PersonCardFace containing block'ом хэндлов была сама карточка. */}
      <div className="pointer-events-none absolute inset-px">
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
      </div>

      <PersonCardFace
        name={shortName(person)}
        years={cardYears(person)}
        gender={person.gender}
        isLiving={person.is_living}
        photoUrl={photoUrl}
      />

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
