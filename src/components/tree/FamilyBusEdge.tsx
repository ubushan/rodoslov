"use client";

import { memo } from "react";
import { useNodes, useEdges, type EdgeProps } from "@xyflow/react";
import { primaryParentByChild } from "@/lib/layout";

const FALLBACK_W = 208;
const FALLBACK_H = 104;

/**
 * Ребро «родитель — ребёнок» в стиле MyHeritage (нисходящая пирамида, компакт):
 *  - пара родителей снизу соединена скобкой;
 *  - от середины скобки вниз опускается общая шина;
 *  - от шины к каждому ребёнку идёт короткий вертикальный отвод.
 *
 * Каждое ребро семьи рисует одни и те же скобку и шину, поэтому совпадающие
 * сегменты сливаются в одну линию. Позиции берём из хранилища React Flow —
 * при перетаскивании карточек линии пересчитываются на лету.
 */
function FamilyBusEdgeComponent({ source, target, targetX, targetY }: EdgeProps) {
  const nodes = useNodes();
  const edges = useEdges();
  const kindOf = (id: string) => (edges.find((e) => e.id === id)?.data as { kind?: string } | undefined)?.kind;

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  // оба конца в подсвеченной линии по отцу — рисуем жирнее
  const onPaternalLine = (id: string | null) => {
    if (!id) return false;
    const n = nodeById.get(id);
    return !!n && !!(n.data as { highlighted?: boolean } | undefined)?.highlighted;
  };
  const bold = onPaternalLine(source) && onPaternalLine(target);
  const bottom = (id: string) => {
    const n = nodeById.get(id);
    const w = n?.measured?.width ?? FALLBACK_W;
    const h = n?.measured?.height ?? FALLBACK_H;
    return { x: (n?.position.x ?? 0) + w / 2, y: (n?.position.y ?? 0) + h };
  };

  // пара родителей (сам родитель + его супруг, если есть)
  const spouseEdge = edges.find(
    (e) => kindOf(e.id) === "spouse" && (e.source === source || e.target === source)
  );
  const spouseId = spouseEdge ? (spouseEdge.source === source ? spouseEdge.target : spouseEdge.source) : null;
  const parentIds = new Set([source]);
  if (spouseId) parentIds.add(spouseId);

  const parents = [...parentIds].map((id) => ({ id, ...bottom(id) })).sort((a, b) => a.x - b.x);

  // дети этой семьи. Ребёнок рисуется только от основного родителя —
  // то же правило использует раскладка, иначе линия ушла бы в чужую ветвь
  const parentEdges = edges.filter((e) => kindOf(e.id) === "parent");
  const primaryParent = primaryParentByChild(parentEdges);
  const kids = parentEdges
    .filter((e) => parentIds.has(e.source) && primaryParent.get(e.target) === e.source)
    .map((e) => nodeById.get(e.target))
    .filter((n): n is NonNullable<typeof n> => !!n)
    .map((n) => {
      const w = n.measured?.width ?? FALLBACK_W;
      const h = n.measured?.height ?? FALLBACK_H;
      return { x: n.position.x + w / 2, top: n.position.y, bottom: n.position.y + h };
    });
  if (!kids.length) return null;

  const bracketY = Math.max(...parents.map((p) => p.y)) + 12;
  const dropX = (parents[0].x + parents[parents.length - 1].x) / 2;
  const busY = Math.min(...kids.map((k) => k.top)) - 18;

  // скобка пары (или короткий стояк для одиночного родителя)
  const bracket =
    parents.length > 1
      ? roundedPath(
          [
            { x: parents[0].x, y: parents[0].y },
            { x: parents[0].x, y: bracketY },
            { x: parents[1].x, y: bracketY },
            { x: parents[1].x, y: parents[1].y },
          ],
          RADIUS
        )
      : `M ${parents[0].x},${parents[0].y} V ${bracketY}`;

  // стояк от скобки к шине, участок шины до ребёнка, отвод к ребёнку
  const run = roundedPath(
    [
      { x: dropX, y: bracketY },
      { x: dropX, y: busY },
      { x: targetX, y: busY },
      { x: targetX, y: targetY },
    ],
    RADIUS
  );

  return (
    <path
      d={`${bracket} ${run}`}
      fill="none"
      stroke="#7a8ca6"
      strokeWidth={bold ? 3 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

const RADIUS = 10;

/** Ломаная со скруглёнными углами: на каждом изломе — дуга радиусом не больше половины соседних отрезков. */
function roundedPath(points: { x: number; y: number }[], radius: number): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x},${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const next = points[i + 1];
    const inLen = Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y);
    const outLen = Math.abs(next.x - cur.x) + Math.abs(next.y - cur.y);
    const r = Math.min(radius, inLen / 2, outLen / 2);

    const inX = cur.x - Math.sign(cur.x - prev.x) * r;
    const inY = cur.y - Math.sign(cur.y - prev.y) * r;
    const outX = cur.x + Math.sign(next.x - cur.x) * r;
    const outY = cur.y + Math.sign(next.y - cur.y) * r;

    d += ` L ${inX},${inY} Q ${cur.x},${cur.y} ${outX},${outY}`;
  }

  const last = points[points.length - 1];
  return `${d} L ${last.x},${last.y}`;
}

export const FamilyBusEdge = memo(FamilyBusEdgeComponent);
