import { memo } from "react";
import type { NodeProps } from "@xyflow/react";

export type CouplePlateData = { w: number; h: number };

/**
 * Мягкая «фотографическая» подложка под парой супругов:
 * объединяет две карточки в одну семью без дополнительных линий.
 */
function CouplePlateComponent({ data }: NodeProps) {
  const { w, h } = data as CouplePlateData;
  return (
    <div
      style={{ width: w, height: h }}
      className="pointer-events-none rounded-[18px] border border-bond-200 bg-bond-100/45 shadow-[0_1px_0_rgba(10,17,32,0.03)]"
    />
  );
}

export const CouplePlate = memo(CouplePlateComponent);
