"use client";

import { memo } from "react";
import { useStore, type EdgeProps } from "@xyflow/react";
import { primaryParentByChild } from "@/lib/layout";
import { CARD_W, CARD_H } from "@/lib/place";
import type { Relationship } from "@/lib/types";

/**
 * Ребро «родитель — ребёнок» ровно как в прототипе студии:
 *  - от середины пары (или от центра одинокого родителя) вниз опускается стебель;
 *  - ниже родителей идёт общая шина до крайнего ребёнка;
 *  - от шины к каждому ребёнку спускается короткий отвод.
 *
 * Геометрия прототипа: стебель начинается у нижней кромки карточек и уходит на
 * STEM_GAP вниз, шина проходит там же, отводы входят в верх детей. Углы прямые,
 * концы и стыки скруглены (stroke-linecap/linejoin: round) — как в прототипе,
 * где линии нарисованы командами M/V/H без дуг.
 *
 * Восходящее древо (dir = "up") — то же самое, но снизу вверх: карточки
 * зеркалятся холстом (см. TreeCanvas), дети оказываются выше родителей, и шина
 * строится над родителями, а отводы входят в нижние кромки детей.
 *
 * Горизонтальное древо (dir = "right", вид «слева направо») — та же геометрия,
 * повёрнутая на 90°: стебель выходит из правой кромки пары (или центра
 * одиночного родителя), шина идёт вертикально в зазоре между колонками, отводы
 * входят в левые кромки детей. Карточки остаются прямыми.
 *
 * Всю семью рисует ровно одно ребро — от основного родителя к первому ребёнку,
 * как один path в прототипе. Остальные рёбра семьи ничего не рисуют: иначе
 * полупрозрачный штрих лёг бы сам на себя и линия стала бы вдвое темнее
 * прототипа.
 *
 * Почему path считается заранее, на холсте (familyEdgeGeometry), а не здесь:
 * раньше ребро само читало useNodes()/useEdges() — то есть перерисовывалось на
 * любое изменение узлов и на каждое перерисовывание обходило весь список рёбер
 * (O(E) поиск внутри O(E) перебора). На древе в 30 карточек выделение одной
 * карточки давало десятки тысяч операций. Теперь ребро — чистая функция от
 * готового path, а из хранилища React Flow берётся только признак выделения
 * карточек-родителей: подписка на булево значение не перерисовывает чужие рёбра.
 */

/** Геометрия одной семьи: готовый path шины и карточки-родители для подсветки */
export type FamilyGeometry = {
  d: string;
  /** id родителей: по их выделению ребро подсвечивается латунью */
  parents: string[];
};

type Relation = Pick<Relationship, "id" | "kind" | "from_person_id" | "to_person_id">;

/** Отступ стебля и шины от кромки карточек родителей — как в прототипе */
const STEM_GAP = 24;

/**
 * Считает path для каждого «хозяйского» ребра семьи: ключ — id связи
 * «родитель — ребёнок», значение — готовый path. Остальных связей в карте нет.
 *
 * Функция чистая: позиции берутся из раскладки холста (layoutPositions), а
 * размеры карточек — константы CARD_W/CARD_H. Раскладка считает те же константы
 * (карточка жёстко 176×100 в PersonNode), поэтому линии совпадают с карточками,
 * а результат зависит только от данных и вида — не от состояния React Flow.
 */
export function familyEdgeGeometry(
  relationships: Relation[],
  positionOf: (id: string) => { x: number; y: number } | undefined,
  { horizontal, mirror }: { horizontal: boolean; mirror: boolean }
): Map<string, FamilyGeometry> {
  const dir = horizontal ? "right" : mirror ? "up" : "down";
  const parentRels = relationships.filter((r) => r.kind === "parent");
  const primaryParent = primaryParentByChild(
    parentRels.map((r) => ({ source: r.from_person_id, target: r.to_person_id }))
  );

  // Первая по порядку связь «супруги» с участием человека — то же правило,
  // что раньше применяло ребро (edges.find(...)).
  const spouseOf = new Map<string, string>();
  for (const r of relationships) {
    if (r.kind !== "spouse") continue;
    if (!spouseOf.has(r.from_person_id)) spouseOf.set(r.from_person_id, r.to_person_id);
    if (!spouseOf.has(r.to_person_id)) spouseOf.set(r.to_person_id, r.from_person_id);
  }

  const box = (id: string) => {
    const p = positionOf(id) ?? { x: 0, y: 0 };
    return {
      x: p.x + CARD_W / 2,
      y: p.y + CARD_H / 2,
      left: p.x,
      right: p.x + CARD_W,
      top: p.y,
      bottom: p.y + CARD_H,
    };
  };

  const out = new Map<string, FamilyGeometry>();
  for (const rel of parentRels) {
    const source = rel.from_person_id;
    const spouse = spouseOf.get(source);
    const parentIds = spouse ? [source, spouse] : [source];

    // дети этой семьи. Ребёнок рисуется только от основного родителя —
    // то же правило использует раскладка, иначе линия ушла бы в чужую ветвь
    const kids = parentRels
      .filter(
        (e) => parentIds.includes(e.from_person_id) && primaryParent.get(e.to_person_id) === e.from_person_id
      )
      .map((e) => e.to_person_id);
    if (!kids.length) continue;

    // хозяин геометрии семьи: основная связь с первым ребёнком. Остальные рёбра
    // семьи ничего не рисуют — дублировать шину нельзя (см. комментарий выше)
    if (rel.to_person_id !== kids[0] || primaryParent.get(rel.to_person_id) !== source) continue;

    // «Слева направо» супруги стоят друг под другом — тогда пару сортируем по
    // вертикали, в остальных видах по горизонтали: так стебель встаёт ровно
    // посередине между карточками пары.
    const parents = parentIds
      .map((id) => ({ id, ...box(id) }))
      .sort((a, b) => (dir === "right" ? a.y - b.y : a.x - b.x));
    const kidBoxes = kids.map((id) => box(id));

    const stemX =
      parents.length > 1 ? (parents[0].x + parents[parents.length - 1].x) / 2 : parents[0].x;
    const stemY =
      parents.length > 1 ? (parents[0].y + parents[parents.length - 1].y) / 2 : parents[0].y;
    const kmin = Math.min(...kidBoxes.map((k) => k.x));
    const kmax = Math.max(...kidBoxes.map((k) => k.x));

    // один path на всю семью: стебель, шина и отвод к каждому ребёнку
    let d: string;
    if (dir === "right") {
      const parentRight = Math.max(...parents.map((p) => p.right));
      const kidLeft = Math.min(...kidBoxes.map((k) => k.left));
      const kidTop = Math.min(...kidBoxes.map((k) => k.y));
      const kidBottom = Math.max(...kidBoxes.map((k) => k.y));
      // шина на STEM_GAP правее родителей; если колонки почему-то сжались —
      // прижимаем её к детям
      const busX = Math.min(parentRight + STEM_GAP, Math.max(parentRight + 2, kidLeft - 2));
      d = [
        `M ${parentRight},${stemY} H ${busX}`,
        `M ${busX},${Math.min(stemY, kidTop)} V ${kidBottom}`,
        ...kidBoxes.map((k) => `M ${busX},${k.y} H ${k.left}`),
      ].join(" ");
    } else if (dir === "up") {
      const parentTop = Math.min(...parents.map((p) => p.top));
      const kidBottom = Math.max(...kidBoxes.map((k) => k.bottom));
      // шина на STEM_GAP выше родителей; если ряд почему-то сжался — прижимаем её к детям
      const busY = Math.min(parentTop - 2, Math.max(kidBottom + 2, parentTop - STEM_GAP));
      d = [
        `M ${stemX},${parentTop} V ${busY}`,
        `M ${Math.min(stemX, kmin)},${busY} H ${kmax}`,
        ...kidBoxes.map((k) => `M ${k.x},${busY} V ${k.bottom}`),
      ].join(" ");
    } else {
      const parentBottom = Math.max(...parents.map((p) => p.bottom));
      const kidTop = Math.min(...kidBoxes.map((k) => k.top));
      // шина на STEM_GAP ниже родителей; если ряд почему-то сжался — прижимаем её к детям
      const busY = Math.min(parentBottom + STEM_GAP, Math.max(parentBottom + 2, kidTop - 2));
      d = [
        `M ${stemX},${parentBottom} V ${busY}`,
        `M ${Math.min(stemX, kmin)},${busY} H ${kmax}`,
        ...kidBoxes.map((k) => `M ${k.x},${busY} V ${k.top}`),
      ].join(" ");
    }

    out.set(rel.id, { d, parents: parentIds });
  }
  return out;
}

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
