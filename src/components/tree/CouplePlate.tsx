import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

export type CouplePlateData = { w: number; h: number };

/**
 * Мягкая «фотографическая» подложка под парой супругов:
 * объединяет две карточки в одну семью без дополнительных линий.
 * Тёплая латунная подложка студии: на светлом холсте — песочная,
 * в тёмной теме — едва заметная.
 */
function CouplePlateComponent({ data }: NodeProps) {
  const { w, h } = data as CouplePlateData;
  return (
    <div
      style={{ width: w, height: h }}
      className="pointer-events-none rounded-[18px] border border-[var(--p-line)] bg-[var(--p-acc-soft)]"
    />
  );
}

export const CouplePlate = memo(CouplePlateComponent);
