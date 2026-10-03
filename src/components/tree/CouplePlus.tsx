"use client";

import { memo, useEffect, useRef, useState } from "react";
import type { NodeProps } from "@xyflow/react";

export type CouplePlusData = {
  /** ширина просвета между карточками и их высота — чтобы «+» не мешал линии, пока скрыт */
  w: number;
  h: number;
  canEdit: boolean;
  /** открыт, когда курсор на одной из карточек пары */
  open: boolean;
  anchorId: string;
  onAddChild: (id: string) => void;
};

/**
 * «+» по центру линии между супругами: сразу добавляет ребёнка этой паре.
 * Лежит отдельным узлом поверх линий, иначе линия связи перехватывала бы клик.
 * Появляется при наведении на любую из карточек пары и не исчезает, пока
 * курсор идёт через просвет к самой кнопке.
 */
function CouplePlusComponent({ data }: NodeProps) {
  const { w, h, canEdit, open, anchorId, onAddChild } = data as CouplePlusData;
  const [hovering, setHovering] = useState(false);
  const [shown, setShown] = useState(open);

  useEffect(() => {
    if (open || hovering) {
      setShown(true);
      return;
    }
    const t = setTimeout(() => setShown(false), 180);
    return () => clearTimeout(t);
  }, [open, hovering]);

  return (
    <div
      style={{ width: w, height: h }}
      className={`relative grid place-items-center ${shown ? "pointer-events-auto" : "pointer-events-none"}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {canEdit && shown && (
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onAddChild(anchorId);
          }}
          aria-label="Добавить ребёнка этой паре"
          title="Добавить ребёнка"
          className="grid h-8 w-8 place-items-center rounded-full border border-[var(--p-fill-2)]
                     bg-[linear-gradient(180deg,var(--p-fill),var(--p-fill-2))] text-[19px] font-bold leading-none
                     text-on-fill shadow-[var(--p-inset-hi),0_2px_6px_rgba(10,17,32,0.25)]
                     transition-[filter] hover:brightness-105"
        >
          +
        </button>
      )}
    </div>
  );
}

export const CouplePlus = memo(CouplePlusComponent);
