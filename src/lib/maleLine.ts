import type { Person, Relationship } from "./types";

/**
 * Мужская линия древа: от старшего предка вниз только по сыновьям.
 * Дочери, зятья и их дети в линию не входят — как и жёны: остаются
 * только мужчины по крови.
 *
 * Старший предок — корень (человек без родителей), у которого мужская
 * линия самая длинная. Так древо не «переключается» на боковую ветку
 * из-за того, что у кого-то больше сыновей.
 */
export function maleLineIds(persons: Person[], relationships: Relationship[]): Set<string> {
  const byId = new Map(persons.map((person) => [person.id, person]));
  const childrenOf = new Map<string, string[]>();
  const hasParent = new Set<string>();

  for (const rel of relationships) {
    if (rel.kind !== "parent") continue;
    childrenOf.set(rel.from_person_id, [...(childrenOf.get(rel.from_person_id) ?? []), rel.to_person_id]);
    hasParent.add(rel.to_person_id);
  }

  /** Мужчины линии, начиная с этого человека (сам он тоже входит). */
  const lineFrom = (startId: string): string[] => {
    const out: string[] = [];
    const queue = [startId];
    while (queue.length) {
      const id = queue.shift()!;
      out.push(id);
      for (const childId of childrenOf.get(id) ?? []) {
        if (byId.get(childId)?.gender === "male") queue.push(childId);
      }
    }
    return out;
  };

  const roots = persons.filter((person) => !hasParent.has(person.id));

  let best: string[] = [];
  let bestIsMale = false;
  for (const root of roots) {
    // если предок — женщина, линия начинается с её сыновей
    const line =
      root.gender === "male"
        ? lineFrom(root.id)
        : (childrenOf.get(root.id) ?? [])
            .filter((id) => byId.get(id)?.gender === "male")
            .flatMap((id) => lineFrom(id));

    const isMale = root.gender === "male";
    if (line.length > best.length || (line.length === best.length && isMale && !bestIsMale)) {
      best = line;
      bestIsMale = isMale;
    }
  }

  return new Set(best);
}
