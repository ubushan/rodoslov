"use client";

import { memo } from "react";
import { useStore, type EdgeProps } from "@xyflow/react";
import type { FamilyGeometry } from "./familyGeometry";

/**
 * Ребро семьи на холсте: рисует готовый path, который посчитала чистая
 * геометрия. Сама геометрия живёт в ./familyGeometry — без @xyflow/react,
 * потому что её же берёт мини-древо на главной: React Flow на лендинг не
 * попадает, а связи примера и холста считаются одной функцией.
 */
export { familyEdgeGeometry } from "./familyGeometry";
export type { FamilyGeometry } from "./familyGeometry";

/**
 * Почему path считается заранее, на холсте (familyEdgeGeometry), а не здесь:
 * раньше ребро само читало useNodes()/useEdges() — то есть перерисовывалось на
 * любое изменение узлов и на каждое перерисовывание обходило весь список рёбер
 * (O(E) поиск внутри O(E) перебора). На древе в 30 карточек выделение одной
 * карточки давало десятки тысяч операций. Теперь ребро — чистая функция от
 * готового path, а из хранилища React Flow берётся только признак выделения
 * карточек-родителей: подписка на булево значение не перерисовывает чужие рёбра.
 */

type FamilyEdgeData = {
  kind?: string;
  /** готовый path семьи; нет — ребро ничего не рисует */
  family?: FamilyGeometry | null;
};

/**
 * Вертикальное ребро семьи. Геометрию получает готовой в data (см.
 * familyEdgeGeometry), поэтому само ничего не считает: остаётся решить,
 * подсвечено ли оно выделением родителей.
 */
function FamilyBusEdgeComponent({ data }: EdgeProps) {
  const family = (data as FamilyEdgeData | undefined)?.family ?? null;

  // Подписка только на выделение карточек-родителей: селектор возвращает булево
  // значение, поэтому выделение чужой карточки это ребро не перерисовывает.
  const highlighted = useStore((state) => {
    if (!family) return false;
    for (const id of family.parents) {
      if (state.nodeLookup.get(id)?.selected) return true;
    }
    return false;
  });

  if (!family) return null;

  return (
    <path
      d={family.d}
      fill="none"
      stroke={highlighted ? "var(--color-brass-500)" : "var(--color-canvas-line)"}
      strokeWidth={highlighted ? 2 : 1.5}
      strokeOpacity={highlighted ? 0.8 : 1}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

export const FamilyBusEdge = memo(FamilyBusEdgeComponent);
