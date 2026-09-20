"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { shortName, lifespan, initials } from "@/lib/format";
import type { Person } from "@/lib/types";

export type PersonNodeData = {
  person: Person;
  photoUrl: string | null;
  onOpen: (id: string) => void;
};

/**
 * Карточка на холсте: портрет, имя, годы жизни, место.
 * Умершие отмечены приглушённым портретом и тире в годах.
 */
function PersonNodeComponent({ data, selected }: NodeProps) {
  const { person, photoUrl, onOpen } = data as PersonNodeData;
  const years = lifespan(person);

  return (
    <div
      className={`person-card group relative flex h-[104px] w-[208px] cursor-pointer items-center gap-3
                  rounded-[13px] border bg-white px-3 shadow-lift transition-colors
                  ${selected ? "border-brass-500" : "border-mist-200 hover:border-ink-300"}`}
      onDoubleClick={() => onOpen(person.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onOpen(person.id)}
      aria-label={`Карточка: ${shortName(person)}`}
    >
      {/* связи с родителями — сверху, с детьми — снизу */}
      <Handle id="parent-in" type="target" position={Position.Top} />
      <Handle id="child-out" type="source" position={Position.Bottom} />
      {/* супружеская связь — по бокам */}
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
      ) : (
        <span
          aria-hidden="true"
          className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-ink-700 font-display text-[15px] text-brass-400"
        >
          {initials(person)}
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="block truncate font-display text-[15px] leading-tight text-ink-800">
          {shortName(person)}
        </span>
        {person.middle_name && (
          <span className="block truncate text-[12px] leading-tight text-ink-400">
            {person.middle_name}
          </span>
        )}
        {years && (
          <span className="mt-1 block text-[12px] leading-tight text-ink-500">{years}</span>
        )}
        {person.residence && (
          <span className="block truncate text-[12px] leading-tight text-ink-400">
            {person.residence}
          </span>
        )}
      </span>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onOpen(person.id);
        }}
        className="absolute right-1.5 top-1.5 hidden h-7 w-7 place-items-center rounded-lg
                   text-ink-300 hover:bg-mist-100 hover:text-ink-700 group-hover:grid"
        aria-label="Открыть карточку"
      >
        ✎
      </button>
    </div>
  );
}

export const PersonNode = memo(PersonNodeComponent);
