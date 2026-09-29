import type { Person, Relationship } from "./types";

/**
 * Где встанет новая карточка. Раскладка берёт реальные размеры из DOM, но новая
 * карточка ставится ещё до отрисовки — поэтому здесь константы, совпадающие
 * с классами w-[236px] и min-h-[104px] в PersonNode.
 */
export const CARD_W = 236;
export const CARD_H = 104;

const SIDE_GAP = 46; // зазор между карточками в одном ряду — как NODE_GAP в раскладке
const ROW_GAP = 128; // зазор между поколениями

/** Кем приходится новый человек тому, от чьей карточки его добавляют. */
export type NewRelative = "child" | "spouse" | "father" | "mother" | "brother" | "sister";

type Rect = { x: number; y: number; w: number; h: number };

const rectAt = (x: number, y: number): Rect => ({ x, y, w: CARD_W, h: CARD_H });

/** Карточки в одном ряду столкнулись, если между ними меньше бокового зазора. */
function clash(a: Rect, b: Rect) {
  const sameRow = Math.abs(a.y - b.y) < Math.min(a.h, b.h) * 0.6;
  const gapX = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
  return sameRow && gapX < SIDE_GAP;
}

/** Сдвигаем вбок, пока место занято: новый ребёнок встаёт правее братьев и сестёр. */
function freeSpot(spot: Rect, occupied: Rect[], dx: number): Rect {
  let out = spot;
  for (let i = 0; i < 40 && occupied.some((o) => clash(out, o)); i++) {
    out = { ...out, x: out.x + dx };
  }
  return out;
}

/**
 * Позиция новой карточки: со связью — вплотную к родственнику (супруг(а) в тот же
 * ряд, ребёнок по центру под родителями, отец и мать рядом над ребёнком);
 * без связи — сверху по центру древа.
 */
export function placeNewPerson({
  persons,
  relationships,
  anchor,
  relation,
  gender,
}: {
  persons: Person[];
  relationships: Relationship[];
  anchor: Person | null;
  relation: NewRelative | null;
  /** пол нового человека: отец встаёт слева от матери */
  gender?: string;
}): { x: number; y: number } {
  const occupied = persons.map((p) => rectAt(p.pos_x, p.pos_y));

  if (!anchor || !relation) {
    if (!persons.length) return { x: 0, y: 0 };
    const minX = Math.min(...persons.map((p) => p.pos_x));
    const maxX = Math.max(...persons.map((p) => p.pos_x + CARD_W));
    const minY = Math.min(...persons.map((p) => p.pos_y));
    const spot = rectAt((minX + maxX) / 2 - CARD_W / 2, minY - CARD_H - ROW_GAP);
    const free = freeSpot(spot, occupied, CARD_W + SIDE_GAP);
    return { x: free.x, y: free.y };
  }

  const byId = new Map(persons.map((p) => [p.id, p]));
  const spousesOf = (id: string) =>
    relationships
      .filter((r) => r.kind === "spouse" && (r.from_person_id === id || r.to_person_id === id))
      .map((r) => byId.get(r.from_person_id === id ? r.to_person_id : r.from_person_id))
      .filter((p): p is Person => !!p);

  if (relation === "spouse") {
    // супруг(а) — в тот же ряд, вплотную к паре: иначе рамка пары не нарисуется
    const partners = [anchor, ...spousesOf(anchor.id)];
    const left = Math.min(...partners.map((p) => p.pos_x));
    const right = Math.max(...partners.map((p) => p.pos_x + CARD_W));
    const rightSpot = rectAt(right + SIDE_GAP, anchor.pos_y);
    const leftSpot = rectAt(left - SIDE_GAP - CARD_W, anchor.pos_y);
    if (!occupied.some((o) => clash(rightSpot, o))) return { x: rightSpot.x, y: rightSpot.y };
    if (!occupied.some((o) => clash(leftSpot, o))) return { x: leftSpot.x, y: leftSpot.y };
    const free = freeSpot(rightSpot, occupied, CARD_W + SIDE_GAP);
    return { x: free.x, y: free.y };
  }

  if (relation === "brother" || relation === "sister") {
    // брат или сестра — в тот же ряд, сразу за карточкой (и за уже добавленными
    // братьями и сёстрами: место занято — сдвигаемся вправо)
    const spot = rectAt(anchor.pos_x + CARD_W + SIDE_GAP, anchor.pos_y);
    const free = freeSpot(spot, occupied, CARD_W + SIDE_GAP);
    return { x: free.x, y: free.y };
  }

  if (relation === "child") {
    // ребёнок — под родителями, по центру их союза
    const parents = [anchor, ...spousesOf(anchor.id)];
    const axis =
      (Math.min(...parents.map((p) => p.pos_x)) +
        Math.max(...parents.map((p) => p.pos_x + CARD_W))) /
      2;
    const bottom = Math.max(...parents.map((p) => p.pos_y + CARD_H));
    const spot = rectAt(axis - CARD_W / 2, bottom + ROW_GAP);
    const free = freeSpot(spot, occupied, CARD_W + SIDE_GAP);
    return { x: free.x, y: free.y };
  }

  // отец или мать — рядом с уже известным вторым родителем, в ряду выше
  const other = relationships
    .filter((r) => r.kind === "parent" && r.to_person_id === anchor.id)
    .map((r) => byId.get(r.from_person_id))
    .find((p): p is Person => !!p);
  const isFather = relation === "father" || (relation === "mother" ? false : gender === "male");

  if (other) {
    const spot = rectAt(
      isFather ? other.pos_x - SIDE_GAP - CARD_W : other.pos_x + CARD_W + SIDE_GAP,
      other.pos_y
    );
    const free = freeSpot(spot, occupied, isFather ? -(CARD_W + SIDE_GAP) : CARD_W + SIDE_GAP);
    return { x: free.x, y: free.y };
  }

  const spot = rectAt(anchor.pos_x, anchor.pos_y - CARD_H - ROW_GAP);
  const free = freeSpot(spot, occupied, CARD_W + SIDE_GAP);
  return { x: free.x, y: free.y };
}
