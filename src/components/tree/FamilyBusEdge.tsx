"use client";

import { memo } from "react";
import { useNodes, useEdges, type EdgeProps } from "@xyflow/react";
import { primaryParentByChild } from "@/lib/layout";

const FALLBACK_W = 176;
const FALLBACK_H = 100;

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
 * Восходящее древо (data.dir = "up") — то же самое, но снизу вверх: карточки
 * зеркалятся холстом (см. TreeCanvas), дети оказываются выше родителей, и шина
 * строится над родителями, а отводы входят в нижние кромки детей.
 *
 * Горизонтальное древо (data.dir = "right", вид «слева направо») — та же
 * геометрия, повёрнутая на 90°: стебель выходит из правой кромки пары (или
 * центра одинокого родителя), шина идёт вертикально в зазоре между колонками,
 * отводы входят в левые кромки детей. Карточки остаются прямыми.
 *
 * Всю семью рисует ровно одно ребро — от основного родителя к первому ребёнку,
 * как один path в прототипе. Остальные рёбра семьи (второй родитель, другие
 * дети) не рисуют ничего: иначе полупрозрачный штрих лёг бы сам на себя и линия
 * стала бы вдвое темнее прототипа.
 *
 * Позиции берём из хранилища React Flow, поэтому линии всегда совпадают с
 * карточками.
 */
function FamilyBusEdgeComponent({ source, target, data }: EdgeProps) {
  const nodes = useNodes();
  const edges = useEdges();
  // Направление раскладки: «down» — нисходящее (по умолчанию), «up» —
  // восходящее (дети выше родителей), «right» — «слева направо» (дети правее).
  const dir = (data as { dir?: string } | undefined)?.dir ?? "down";
  const kindOf = (id: string) =>
    (edges.find((e) => e.id === id)?.data as { kind?: string } | undefined)?.kind;

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const box = (id: string) => {
    const n = nodeById.get(id);
    const w = n?.measured?.width ?? FALLBACK_W;
    const h = n?.measured?.height ?? FALLBACK_H;
    const x = n?.position.x ?? 0;
    const y = n?.position.y ?? 0;
    return {
      x: x + w / 2,
      y: y + h / 2,
      left: x,
      right: x + w,
      top: y,
      bottom: y + h,
    };
  };

  // пара родителей (сам родитель + его супруг, если есть)
  const spouseEdge = edges.find(
    (e) => kindOf(e.id) === "spouse" && (e.source === source || e.target === source)
  );
  const spouseId = spouseEdge
    ? spouseEdge.source === source
      ? spouseEdge.target
      : spouseEdge.source
    : null;
  const parentIds = new Set([source]);
  if (spouseId) parentIds.add(spouseId);

  // «Слева направо» супруги стоят друг под другом — тогда пару сортируем по
  // вертикали, в остальных видах по горизонтали: так стебель встаёт ровно
  // посередине между карточками пары.
  const parents = [...parentIds]
    .map((id) => ({ id, ...box(id) }))
    .sort((a, b) => (dir === "right" ? a.y - b.y : a.x - b.x));

  // дети этой семьи. Ребёнок рисуется только от основного родителя —
  // то же правило использует раскладка, иначе линия ушла бы в чужую ветвь
  const parentEdges = edges.filter((e) => kindOf(e.id) === "parent");
  const primaryParent = primaryParentByChild(parentEdges);
  const kids = parentEdges
    .filter((e) => parentIds.has(e.source) && primaryParent.get(e.target) === e.source)
    .map((e) => nodeById.get(e.target))
    .filter((n): n is NonNullable<typeof n> => !!n)
    .map((n) => ({ id: n.id, ...box(n.id) }));
  if (!kids.length) return null;

  // хозяин геометрии семьи: основная связь с первым ребёнком. Остальные рёбра
  // семьи ничего не рисуют — дублировать шину нельзя (см. комментарий выше)
  if (target !== kids[0].id || primaryParent.get(target) !== source) return null;

  // Выбранная карточка подсвечивает свою ветвь латунью — как «w-glow»
  // в прототипе студии: цвет, толщина и прозрачность оттуда же
  const selectedIds = nodes.filter((n) => n.selected).map((n) => n.id);
  const highlighted =
    selectedIds.length > 0 &&
    (selectedIds.includes(source) || (!!spouseId && selectedIds.includes(spouseId)));

  // Отводы к детям идут от шины:
  //  - вертикальные виды: шина горизонтальная, отводы спускаются/поднимаются
  //    по x детей (kmin..kmax), стебель — по x середины пары;
  //  - «слева направо»: шина вертикальная, отводы идут по y детей (kmin..kmax),
  //    стебель выходит из правой кромки пары по её середине по вертикали.
  const stemX =
    parents.length > 1 ? (parents[0].x + parents[parents.length - 1].x) / 2 : parents[0].x;
  const stemY =
    parents.length > 1 ? (parents[0].y + parents[parents.length - 1].y) / 2 : parents[0].y;
  const kmin = Math.min(...kids.map((k) => k.x));
  const kmax = Math.max(...kids.map((k) => k.x));

  // один path на всю семью: стебель, шина и отвод к каждому ребёнку
  let d: string;
  if (dir === "right") {
    const parentRight = Math.max(...parents.map((p) => p.right));
    const kidLeft = Math.min(...kids.map((k) => k.left));
    const kidTop = Math.min(...kids.map((k) => k.y));
    const kidBottom = Math.max(...kids.map((k) => k.y));
    // шина на STEM_GAP правее родителей; если колонки почему-то сжались —
    // прижимаем её к детям
    const busX = Math.min(parentRight + STEM_GAP, Math.max(parentRight + 2, kidLeft - 2));
    d = [
      `M ${parentRight},${stemY} H ${busX}`,
      `M ${busX},${Math.min(stemY, kidTop)} V ${kidBottom}`,
      ...kids.map((k) => `M ${busX},${k.y} H ${k.left}`),
    ].join(" ");
  } else if (dir === "up") {
    const parentTop = Math.min(...parents.map((p) => p.top));
    const kidBottom = Math.max(...kids.map((k) => k.bottom));
    // шина на STEM_GAP выше родителей; если ряд почему-то сжался — прижимаем её к детям
    const busY = Math.min(parentTop - 2, Math.max(kidBottom + 2, parentTop - STEM_GAP));
    d = [
      `M ${stemX},${parentTop} V ${busY}`,
      `M ${Math.min(stemX, kmin)},${busY} H ${kmax}`,
      ...kids.map((k) => `M ${k.x},${busY} V ${k.bottom}`),
    ].join(" ");
  } else {
    const parentBottom = Math.max(...parents.map((p) => p.bottom));
    const kidTop = Math.min(...kids.map((k) => k.top));
    // шина на STEM_GAP ниже родителей; если ряд почему-то сжался — прижимаем её к детям
    const busY = Math.min(parentBottom + STEM_GAP, Math.max(parentBottom + 2, kidTop - 2));
    d = [
      `M ${stemX},${parentBottom} V ${busY}`,
      `M ${Math.min(stemX, kmin)},${busY} H ${kmax}`,
      ...kids.map((k) => `M ${k.x},${busY} V ${k.top}`),
    ].join(" ");
  }

  return (
    <path
      d={d}
      fill="none"
      stroke={highlighted ? "var(--color-brass-500)" : "var(--color-canvas-line)"}
      strokeWidth={highlighted ? 2 : 1.5}
      strokeOpacity={highlighted ? 0.8 : 1}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

/** Отступ стебля и шины от нижней кромки карточек родителей — как в прототипе */
const STEM_GAP = 24;

export const FamilyBusEdge = memo(FamilyBusEdgeComponent);
