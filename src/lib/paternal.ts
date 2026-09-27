import type { Person, Relationship } from "./types";

/**
 * Родня по отцу:
 *  - прямая мужская линия вверх: сам человек, отец, дед и так далее;
 *  - родные дяди — братья отца (общие с ним родители);
 *  - мужская линия вниз от каждого дяди: его сыновья, внуки и так далее.
 * Женщины и потомки дочерей в подсветку не попадают.
 */
export function paternalLine(
  startId: string,
  persons: Person[],
  relationships: Relationship[]
): Set<string> {
  const byId = new Map(persons.map((p) => [p.id, p]));
  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();

  for (const r of relationships) {
    if (r.kind !== "parent") continue;
    parentsOf.set(r.to_person_id, [...(parentsOf.get(r.to_person_id) ?? []), r.from_person_id]);
    childrenOf.set(r.from_person_id, [...(childrenOf.get(r.from_person_id) ?? []), r.to_person_id]);
  }

  const line = new Set<string>([startId]);
  const fathers = (id: string) =>
    (parentsOf.get(id) ?? []).filter((pid) => byId.get(pid)?.gender === "male");

  // 1. вверх по прямой мужской линии
  let current = startId;
  let fatherId: string | null = null;
  for (;;) {
    const father = fathers(current).find((id) => !line.has(id));
    if (!father) break;
    line.add(father);
    if (current === startId) fatherId = father;
    current = father;
  }
  if (!fatherId) return line;

  // 2. родные дяди: мужчины, у которых те же родители, что и у отца
  const grandparents = parentsOf.get(fatherId) ?? [];
  if (grandparents.length) {
    for (const p of persons) {
      if (p.id === fatherId || line.has(p.id) || p.gender !== "male") continue;
      const own = parentsOf.get(p.id) ?? [];
      const sameParents =
        own.length === grandparents.length && grandparents.every((id) => own.includes(id));
      if (!sameParents) continue;
      line.add(p.id);
      // 3. мужская линия вниз от дяди
      addMaleLine(p.id, line, childrenOf, byId);
    }
  }

  return line;
}

/** Сыновья, внуки и далее — только по мужской линии. */
function addMaleLine(
  id: string,
  line: Set<string>,
  childrenOf: Map<string, string[]>,
  byId: Map<string, Person>
) {
  for (const childId of childrenOf.get(id) ?? []) {
    if (line.has(childId)) continue;
    if (byId.get(childId)?.gender !== "male") continue;
    line.add(childId);
    addMaleLine(childId, line, childrenOf, byId);
  }
}
