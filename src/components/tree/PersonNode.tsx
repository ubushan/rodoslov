"use client";

import { memo, useRef, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { shortName, lifespan, ageYears, yearsWord } from "@/lib/format";
import type { Gender, Person } from "@/lib/types";
import { NodeMenu, MenuItem } from "./NodeMenu";

export type PersonNodeData = {
  person: Person;
  photoUrl: string | null;
  canEdit: boolean;
  /** входит в подсвеченную линию по отцу */
  highlighted: boolean;
  /** линия по отцу показана, но этот человек в неё не входит */
  dimmed: boolean;
  /** у этого человека сейчас включена подсветка линии по отцу */
  paternalActive: boolean;
  onPaternal: (id: string) => void;
  onBranch: (id: string) => void;
  /** Пол уже добавленных родителей: чтобы не завести второго отца или мать */
  parentGenders: Gender[];
  onOpen: (id: string) => void;
  onAdd: (id: string, relation: NewRelative) => void;
  onHover: (id: string, over: boolean) => void;
};

/** Кем приходится новый человек тому, от чьей карточки его добавляют. */
export type NewRelative = "child" | "spouse" | "father" | "mother";

type AddOption = { key: NewRelative; label: string; disabled?: boolean; hint?: string };

/** Карандаш для кнопки редактирования */
function IconEdit() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 14v-2.3L11.7 4a1.7 1.7 0 0 1 2.4 2.4L6.3 14H4Z" />
      <path d="M10.4 5.3 12.7 7.6" />
    </svg>
  );
}

/** Стрелки наружу для кнопки «открыть семейную ветку» */
function IconExpand() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.6 3.5h3.9v3.9M14.5 3.5 9.6 8.4M7.4 14.5H3.5v-3.9M3.5 14.5l4.9-4.9" />
    </svg>
  );
}

/**
 * Карточка на холсте: портрет, имя, годы жизни с возрастом, место.
 * Ширина подстраивается под содержимое (не больше 320px), поэтому
 * длинные имена не режутся многоточием, а переносятся на новую строку.
 * Умершие отмечены приглушённым портретом и тире в годах.
 *
 * Точки-хэндлы скрыты: вместо них два «+» — по центру нижнего края
 * (ребёнок или супруг) и верхнего (отец или мать).
 */
function PersonNodeComponent({ data, selected }: NodeProps) {
  const { person, photoUrl, canEdit, parentGenders, highlighted, dimmed, paternalActive, onPaternal, onBranch, onOpen, onAdd, onHover } =
    data as PersonNodeData;
  const years = lifespan(person);
  const age = ageYears(person);

  // супруга называем по полу того, от кого добавляем
  const spouseLabel =
    person.gender === "male" ? "Супруга" : person.gender === "female" ? "Супруг" : "Супруг(а)";
  const hasFather = parentGenders.includes("male");
  const hasMother = parentGenders.includes("female");


  // цвет карточки: рамка, подсветка выделения и кнопки — всё по полу
  const accent =
    person.gender === "male" ? "#7fa6c9" : person.gender === "female" ? "#d1873f" : "#c6cfdd";
  // лёгкая заливка карточки в тон рамки
  const accentTint =
    person.gender === "male" ? "#f3f8fb" : person.gender === "female" ? "#fdf5ef" : "#ffffff";
  const accentRing =
    person.gender === "male"
      ? "rgba(127,166,201,.35)"
      : person.gender === "female"
        ? "rgba(209,135,63,.35)"
        : "rgba(198,207,221,.55)";

  const plusRef = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  // порядок по иерархии: отец, мать, супруг(а), ребёнок.
  // Занятый родительский слот не предлагаем повторно.
  const addOptions: AddOption[] = [
    { key: "father", label: "Отец", disabled: hasFather, hint: hasFather ? "Отец уже указан" : undefined },
    { key: "mother", label: "Мать", disabled: hasMother, hint: hasMother ? "Мать уже указана" : undefined },
    { key: "spouse", label: spouseLabel },
    { key: "child", label: "Ребёнок" },
  ];

  function openMenu() {
    const r = plusRef.current?.getBoundingClientRect();
    if (!r) return;
    setMenu({ x: Math.round(r.left + r.width / 2 - 98), y: Math.round(r.bottom + 8) });
  }

  return (
    <div
      style={{
        backgroundColor: accentTint,
        borderColor: accent,
        borderWidth: highlighted ? 2.5 : undefined,
        opacity: dimmed ? 0.45 : undefined,
        ...(selected || highlighted
          ? {
              boxShadow: `0 0 0 3px ${accentRing}, 0 1px 2px rgba(10,17,32,.06), 0 12px 32px -12px rgba(10,17,32,.24)`,
            }
          : {}),
      }}
      className="person-card group relative flex min-h-[104px] w-[236px] cursor-pointer items-center gap-3
                 rounded-[13px] border-[1.5px] px-3 py-3 shadow-lift transition-colors"
      onMouseEnter={() => onHover?.(person.id, true)}
      onMouseLeave={() => onHover?.(person.id, false)}
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

      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt=""
          crossOrigin="anonymous"
          className={`h-14 w-14 shrink-0 rounded-xl object-cover ${
            person.is_living ? "" : "opacity-80 saturate-50"
          }`}
        />
      ) : person.gender !== "unknown" ? (
        // без фотографии — силуэт по полу
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={person.gender === "male" ? "/avatars/male.png" : "/avatars/female.png"}
          alt=""
          className={`h-14 w-14 shrink-0 rounded-full ${
            person.is_living ? "" : "opacity-80 saturate-50"
          }`}
        />
      ) : null}

      <span className="min-w-0 flex-1">
        <span
          className={`block font-display text-[15px] leading-tight text-ink-800 ${
            highlighted ? "font-bold" : "font-semibold"
          }`}
        >
          {shortName(person)}
        </span>
        {person.middle_name && (
          <span className="block text-[12px] leading-tight text-ink-400">
            {person.middle_name}
          </span>
        )}
        {years && (
          <>
            <span
              aria-hidden="true"
              className="mt-1.5 mb-1 block h-px w-full opacity-60"
              style={{
                backgroundImage: `linear-gradient(90deg, ${
                  person.gender === "male"
                    ? "#7fa6c9"
                    : person.gender === "female"
                      ? "#d1873f"
                      : "#c6cfdd"
                }, transparent)`,
              }}
            />
            <span className="block text-[12px] leading-tight text-ink-500">
            {years}
            {age != null && (
              <span className="text-ink-400">
                {" "}
                · {age} {yearsWord(age)}
              </span>
            )}
            </span>
          </>
        )}
      </span>

      {/* три кнопки на верхней грани, слева: добавить, редактировать, линия по отцу */}
      <span className="card-actions absolute -top-4 left-3 hidden gap-1.5 group-hover:flex">
        {canEdit && (
          <button
            ref={plusRef}
            style={{ "--accent": accent } as React.CSSProperties}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              openMenu();
            }}
            aria-label="Добавить родственника"
            title="Добавить родственника"
            className="node-btn card-btn grid h-8 w-8 place-items-center rounded-full text-[19px] font-bold leading-none"
          >
            +
          </button>
        )}
        <button
          style={{ "--accent": accent } as React.CSSProperties}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onOpen(person.id);
          }}
          className="node-btn card-btn grid h-8 w-8 place-items-center rounded-full"
          aria-label="Открыть карточку"
          title="Открыть карточку"
        >
          <IconEdit />
        </button>
        <button
          style={{ "--accent": accent } as React.CSSProperties}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onPaternal(person.id);
          }}
          className={`node-btn card-btn grid h-8 w-8 place-items-center rounded-full text-[15px] font-bold leading-none ${
            paternalActive ? "node-btn-on" : ""
          }`}
          aria-label="Показать линию по отцу"
          title="Линия по отцу"
        >
          ↑
        </button>
        <button
          style={{ "--accent": accent } as React.CSSProperties}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onBranch(person.id);
          }}
          className="node-btn card-btn grid h-8 w-8 place-items-center rounded-full"
          aria-label="Открыть ветку"
          title="Открыть семейную ветку"
        >
          <IconExpand />
        </button>
      </span>

      {canEdit && (
        <>
          {menu && (
            <NodeMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)}>
              {addOptions.map((o) => (
                <MenuItem
                  key={o.key}
                  label={o.label}
                  hint={o.hint}
                  disabled={o.disabled}
                  onClick={() => {
                    setMenu(null);
                    onAdd(person.id, o.key);
                  }}
                />
              ))}
            </NodeMenu>
          )}
        </>
      )}
    </div>
  );
}

export const PersonNode = memo(PersonNodeComponent);
