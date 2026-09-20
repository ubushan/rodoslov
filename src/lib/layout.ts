import dagre from "dagre";
import type { Node, Edge } from "@xyflow/react";

export const CARD_W = 208;
export const CARD_H = 104;

/**
 * Раскладывает древо сверху вниз: поколения ложатся рядами,
 * супруги остаются на одном уровне рядом друг с другом.
 */
export function autoLayout(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 46, ranksep: 96, marginx: 40, marginy: 40 });

  nodes.forEach((n) => g.setNode(n.id, { width: CARD_W, height: CARD_H }));

  edges.forEach((e) => {
    if (e.data?.kind === "spouse") {
      // супруги не задают иерархию, но держатся рядом
      g.setEdge(e.source, e.target, { weight: 0, minlen: 0 });
    } else {
      g.setEdge(e.source, e.target, { weight: 2, minlen: 1 });
    }
  });

  dagre.layout(g);

  return nodes.map((n) => {
    const p = g.node(n.id);
    return { ...n, position: { x: p.x - CARD_W / 2, y: p.y - CARD_H / 2 } };
  });
}
