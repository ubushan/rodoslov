import type { Person, Relationship } from "./types";

/**
 * Семейная ветка человека: он сам, его супруги и все потомки
 * (вместе с их супругами) — то, что показываем на отдельной странице ветки.
 */
export function familyBranch(
  startId: string,
  persons: Person[],
  relationships: Relationship[]
): Set<string> {
  const byId = new Map(persons.map((p) => [p.id, p]));
  const childrenOf = new Map<string, string[]>();
  const spousesOf = new Map<string, string[]>();

  for (const r of relationships) {
    if (r.kind === "parent") {
      childrenOf.set(r.from_person_id, [...(childrenOf.get(r.from_person_id) ?? []), r.to_person_id]);
    } else if (r.kind === "spouse") {
      spousesOf.set(r.from_person_id, [...(spousesOf.get(r.from_person_id) ?? []), r.to_person_id]);
      spousesOf.set(r.to_person_id, [...(spousesOf.get(r.to_person_id) ?? []), r.from_person_id]);
    }
  }

  const branch = new Set<string>([startId]);
  const queue = [startId];

  while (queue.length) {
    const id = queue.shift()!;
    // супруги входят в ветку, но потомков через них не набираем
    for (const spouse of spousesOf.get(id) ?? []) {
      if (byId.has(spouse) && !branch.has(spouse)) branch.add(spouse);
    }
    for (const child of childrenOf.get(id) ?? []) {
      if (!byId.has(child) || branch.has(child)) continue;
      branch.add(child);
      queue.push(child);
    }
  }

  return branch;
}
