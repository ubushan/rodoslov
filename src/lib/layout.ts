import dagre from "dagre";
import type { Node, Edge } from "@xyflow/react";
import type { Person } from "./types";

export { CARD_W, CARD_H } from "./place";
import { CARD_W, CARD_H } from "./place";

const NODE_GAP = 34; // между карточками в одной семье — как в прототипе (пары и братья)
const BRANCH_GAP = 150; // между ветвями внутри семьи — у каждой своя пирамида
const FAMILY_GAP = 260; // между семьями — чтобы границы семей читались сразу
/** Зазор между поколениями по вертикали: у прототипа 56–82px, берём середину. */
const RANK_GAP = 64;

type Placed = { x: number; y: number; w: number; h: number };

/**
 * Основной родитель ребёнка: источник первой по порядку связи «родитель — ребёнок».
 * То же правило применяет FamilyBusEdge, иначе линия пойдёт к чужой ветви.
 */
export function primaryParentByChild(parentEdges: { source: string; target: string }[]) {
  const map = new Map<string, string>();
  for (const e of parentEdges) if (!map.has(e.target)) map.set(e.target, e.source);
  return map;
}

function sizeOf(n: Node) {
  return { width: n.measured?.width ?? CARD_W, height: n.measured?.height ?? CARD_H };
}

/** Старшие — левее; у кого дата неизвестна — правее. */
function birthSortKey(n: Node): string {
  const p = n.data?.person as Person | undefined;
  if (p?.birth_date) return `d${p.birth_date}`;
  if (p?.birth_year) return `y${String(p.birth_year).padStart(4, "0")}`;
  return "z";
}

/**
 * Раскладывает древо пирамидой: каждый человек (или пара) стоит по центру
 * над своими детьми, дети расходятся от оси в стороны — и так на каждом
 * уровне. Семьи разделены заметным зазором.
 *
 * Сначала снизу вверх считаем ширину поддерева каждой семьи (чтобы ветви
 * соседей не пересекались), затем сверху вниз расставляем центры: слот
 * каждой семьи центрируется на оси родителей, дети — на оси своей семьи.
 */
export function autoLayout(nodes: Node[], edges: Edge[]) {
  const parentEdges = edges.filter((e) => e.data?.kind === "parent");
  const spouseEdges = edges.filter((e) => e.data?.kind === "spouse");

  // ---- опорные центры от dagre: только иерархия родитель → ребёнок ----
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: NODE_GAP, ranksep: RANK_GAP, marginx: 40, marginy: 40 });
  nodes.forEach((n) => g.setNode(n.id, sizeOf(n)));
  parentEdges.forEach((e) => g.setEdge(e.source, e.target, { weight: 2, minlen: 1 }));
  dagre.layout(g);

  const size = new Map(nodes.map((n) => [n.id, sizeOf(n)]));
  const anchor = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    const p = g.node(n.id);
    anchor.set(n.id, { x: p.x, y: p.y });
  }

  // ---- пары супругов: каждый человек относится к «единице» — паре или себе ----
  const coupleOf = new Map<string, string>(); // personId -> canonical coupleId
  const coupleMembers = new Map<string, string[]>();
  for (const e of spouseEdges) {
    const a = coupleOf.get(e.source);
    const b = coupleOf.get(e.target);
    if (a !== undefined && b !== undefined && a !== b) {
      for (const [pid, cid] of coupleOf) if (cid === b) coupleOf.set(pid, a);
      coupleMembers.set(a, [...(coupleMembers.get(a) ?? []), ...(coupleMembers.get(b) ?? [])]);
      coupleMembers.delete(b);
      continue;
    }
    if (a === undefined && b === undefined) {
      coupleOf.set(e.source, e.source);
      coupleOf.set(e.target, e.source);
      coupleMembers.set(e.source, [e.source, e.target]);
    }
  }
  const unitOf = new Map<string, string>(); // personId -> unitId
  for (const n of nodes) unitOf.set(n.id, coupleOf.get(n.id) ?? n.id);
  const unitMembers = (unitId: string): string[] => coupleMembers.get(unitId) ?? [unitId];
  const unitWidth = (unitId: string) =>
    unitMembers(unitId).reduce((s, id) => s + size.get(id)!.width, 0) +
    NODE_GAP * (unitMembers(unitId).length - 1);

  // ---- супругов выравниваем по вертикали (центры на одной линии) ----
  const hierarchical = new Set<string>();
  for (const e of parentEdges) {
    hierarchical.add(e.source);
    hierarchical.add(e.target);
  }
  for (const e of spouseEdges) {
    // Выравниваем того из пары, кто не связан с иерархией: раньше двигалась
    // всегда цель связи, и при обратном порядке пары супруги расходились по рядам.
    let anchorId: string;
    let follower: string;
    if (hierarchical.has(e.source) && !hierarchical.has(e.target)) {
      anchorId = e.source;
      follower = e.target;
    } else if (hierarchical.has(e.target) && !hierarchical.has(e.source)) {
      anchorId = e.target;
      follower = e.source;
    } else {
      anchorId = anchor.get(e.source)!.y <= anchor.get(e.target)!.y ? e.source : e.target;
      follower = anchorId === e.source ? e.target : e.source;
    }
    anchor.set(follower, { ...anchor.get(follower)!, y: anchor.get(anchorId)!.y });
  }

  // ---- ранги по вертикали ----
  const bucket = (y: number) => Math.round(y / 12) * 12;
  const rankY = [...new Set(nodes.map((n) => bucket(anchor.get(n.id)!.y)))].sort((a, b) => a - b);
  const rankOf = new Map<number, string[]>();
  for (const n of nodes) {
    const y = bucket(anchor.get(n.id)!.y);
    rankOf.set(y, [...(rankOf.get(y) ?? []), n.id]);
  }

  // ---- кто чей ребёнок (в терминах единиц) ----
  const parentsOf = new Map<string, Set<string>>();
  for (const e of parentEdges) {
    const u = unitOf.get(e.source) ?? e.source;
    if (!parentsOf.has(e.target)) parentsOf.set(e.target, new Set());
    parentsOf.get(e.target)!.add(u);
  }

  const compareBirth = (a: string, b: string) => {
    // у пары берём самого старшего из двоих
    const keyOf = (uid: string) =>
      unitMembers(uid)
        .map((m) => birthSortKey(nodes.find((n) => n.id === m)!))
        .sort()[0] ?? "z";
    const ka = keyOf(a);
    const kb = keyOf(b);
    if (ka !== kb) return ka < kb ? -1 : 1;
    return anchor.get(unitMembers(a)[0])!.x - anchor.get(unitMembers(b)[0])!.x;
  };

  // К какой семье относится пара: берём основного родителя первого супруга,
  // у которого он есть. Так ребёнок всегда попадает в одну ветвь — даже если
  // отец и мать не отмечены супругами.
  const primaryParent = primaryParentByChild(parentEdges);
  const parentUnitOf = (uid: string): string | null => {
    for (const m of unitMembers(uid)) {
      const p = primaryParent.get(m);
      if (p) return unitOf.get(p) ?? p;
    }
    return null;
  };

  // ---- структура каждого ранга: кластеры детей и корни ----
  type RankData = {
    yCenter: number;
    clusters: Map<string, string[]>; // parentUnit -> [unitIds], уже по старшинству
    rootUnits: string[];
    units: string[];
  };
  const childrenOf = new Map<string, string[]>(); // parentUnit -> [unitIds]
  const rankData: RankData[] = rankY.map((yb) => {
    const ids = rankOf.get(yb)!;
    const yCenter = Math.round(ids.reduce((s, id) => s + anchor.get(id)!.y, 0) / ids.length);
    const units = [...new Set(ids.map((id) => unitOf.get(id)!))];
    const clusters = new Map<string, string[]>();
    const rootUnits: string[] = [];
    for (const uid of units) {
      const parentUnit = parentUnitOf(uid);
      if (parentUnit) {
        const arr = clusters.get(parentUnit) ?? [];
        if (!arr.includes(uid)) arr.push(uid);
        clusters.set(parentUnit, arr);
        const kids = childrenOf.get(parentUnit) ?? [];
        if (!kids.includes(uid)) kids.push(uid);
        childrenOf.set(parentUnit, kids);
      } else {
        rootUnits.push(uid);
      }
    }
    for (const arr of clusters.values()) arr.sort(compareBirth);
    return { yCenter, clusters, rootUnits, units };
  });

  // ---- ширина поддеревьев: снизу вверх ----
  // Между ветвями зазор больше, чем между одиночками, — у каждой ветви
  // своя пирамида и её границы не задевают соседнюю.
  const gapBetween = (a: string, b: string) =>
    (childrenOf.get(a)?.length ?? 0) > 0 || (childrenOf.get(b)?.length ?? 0) > 0
      ? BRANCH_GAP
      : NODE_GAP;

  const subtreeW = new Map<string, number>();
  for (let ri = rankData.length - 1; ri >= 0; ri--) {
    for (const uid of rankData[ri].units) {
      const kids = childrenOf.get(uid) ?? [];
      let kidsW = 0;
      kids.forEach((c, i) => {
        if (i) kidsW += gapBetween(kids[i - 1], c);
        kidsW += subtreeW.get(c) ?? 0;
      });
      subtreeW.set(uid, Math.max(unitWidth(uid), kidsW));
    }
  }

  // ---- размещение сверху вниз: каждая семья — на оси родителей ----
  const final = new Map<string, Placed>();
  const placed = new Map<string, number>(); // unitId -> центр по горизонтали

  for (let ri = 0; ri < rankData.length; ri++) {
    const { yCenter, clusters, rootUnits } = rankData[ri];

    const slots: { key: number; parentUnit: string | null; units: string[] }[] = [
      ...[...clusters.entries()].map(([parentUnit, units]) => ({
        key: placed.get(parentUnit) ?? anchor.get(unitMembers(parentUnit)[0])!.x,
        parentUnit,
        units,
      })),
      ...rootUnits.map((uid) => ({
        key: anchor.get(unitMembers(uid)[0])!.x,
        parentUnit: null as string | null,
        units: [uid],
      })),
    ];
    slots.sort((a, b) => a.key - b.key);

    let cursor: number | null = null;
    let prevParent: string | null = null;
    // между ветвями братьев и сестёр хватает BRANCH_GAP — тогда каждая пирамида
    // остаётся по центру своего родителя и не задевает соседнюю
    const gapBetweenSlots = (a: string | null, b: string | null) => {
      if (!a || !b) return FAMILY_GAP;
      const pa = parentUnitOf(a);
      const pb = parentUnitOf(b);
      return pa && pb && pa === pb ? BRANCH_GAP : FAMILY_GAP;
    };

    for (const slot of slots) {
      // ширина слота считается с теми же зазорами, что и расстановка ниже,
      // иначе центр слота не совпадёт с осью родителей
      let totalW = 0;
      slot.units.forEach((u, i) => {
        if (i) totalW += gapBetween(slot.units[i - 1], u);
        totalW += subtreeW.get(u) ?? unitWidth(u);
      });

      let start: number;
      if (slot.parentUnit) {
        // кластер детей центрируется на оси родителей; если родитель почему-то
        // ещё не размещён (аномалия в данных) — берём опорную координату dagre
        const axis =
          placed.get(slot.parentUnit) ??
          anchor.get(unitMembers(slot.parentUnit)[0])?.x ??
          0;
        const ideal = axis - totalW / 2;
        start =
          cursor == null
            ? ideal
            : Math.max(cursor + gapBetweenSlots(prevParent, slot.parentUnit), ideal);
      } else {
        start =
          cursor == null ? -totalW / 2 : cursor + gapBetweenSlots(prevParent, null);
      }

      let x = start;
      let prevUnit: string | null = null;
      for (const uid of slot.units) {
        if (prevUnit) x += gapBetween(prevUnit, uid);
        const span = subtreeW.get(uid) ?? unitWidth(uid);
        const center = x + span / 2;
        placed.set(uid, center);
        // члены пары — вокруг центра юнита
        const mw = unitWidth(uid);
        let mx = center - mw / 2;
        for (const mid of unitMembers(uid)) {
          const { width, height } = size.get(mid)!;
          final.set(mid, { x: mx, y: yCenter - height / 2, w: width, h: height });
          mx += width + NODE_GAP;
        }
        x += span;
        prevUnit = uid;
      }
      cursor = x;
      prevParent = slot.parentUnit;
    }
  }

  return nodes.map((n) => {
    const p = final.get(n.id)!;
    return { ...n, position: { x: p.x, y: p.y } };
  });
}
