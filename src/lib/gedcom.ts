import type { Gender, Person, Relationship } from "./types";

/**
 * GEDCOM 5.5.1 — обмен древами с другими генеалогическими программами.
 * Экспорт собирает стандартные INDI/FAM записи; разбор на входе принимает
 * и «стандартный» GEDCOM, и характерные для российских программ варианты
 * (русские названия месяцев, даты вида ДД.ММ.ГГГГ).
 */

const MONTHS_EN = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const MONTHS_RU = ["ЯНВ", "ФЕВ", "МАР", "АПР", "МАЙ", "ИЮН", "ИЮЛ", "АВГ", "СЕН", "ОКТ", "НОЯ", "ДЕК"];

// ---------------------------------------------------------------------
// Экспорт
// ---------------------------------------------------------------------

/** «12 MAY 1938» из ISO-даты, иначе просто год. */
function dateToGed(iso: string | null, year: number | null): string | null {
  if (iso) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (match) {
      const month = Number(match[2]);
      if (month >= 1 && month <= 12) return `${Number(match[3])} ${MONTHS_EN[month - 1]} ${match[1]}`;
    }
    return iso;
  }
  return year ? String(year) : null;
}

/** Многострочный и длинный текст — на NOTE с продолжениями CONT/CONC. */
function textBlock(level: number, tag: string, value: string | null | undefined): string[] {
  if (!value) return [];
  const MAX = 190;
  const out: string[] = [];
  for (const [index, line] of value.replace(/\r/g, "").split("\n").entries()) {
    const head = index === 0 ? tag : "CONT";
    let rest = line;
    let piece = 0;
    if (!rest.trim()) {
      out.push(`${level} ${head}`);
      continue;
    }
    while (rest.length > 0) {
      const chunk = rest.slice(0, MAX);
      rest = rest.slice(MAX);
      const useTag = piece === 0 ? head : "CONC";
      // только первая строка первого блока на уровне тега; CONT и CONC — на уровень ниже
      const useLevel = index === 0 && piece === 0 ? level : level + 1;
      out.push(`${useLevel} ${useTag} ${chunk.startsWith("@") ? "@ " + chunk : chunk}`);
      piece++;
    }
  }
  return out;
}

export function exportGedcom(persons: Person[], relationships: Relationship[]): string {
  const out: string[] = ["0 HEAD", "1 SOUR RODOSLOV", "1 GEDC", "2 VERS 5.5.1", "2 FORM LINEAGE-LINKED", "1 CHAR UTF-8"];

  const byId = new Map(persons.map((person) => [person.id, person]));
  const xref = new Map<string, string>();
  persons.forEach((person, index) => xref.set(person.id, `@I${index + 1}@`));

  type Fam = { id: string; husb?: string; wife?: string; children: string[]; couple: boolean };
  const fams: Fam[] = [];
  const pairKey = (a: string, b: string) => [a, b].sort().join("|");
  const famOfPair = new Map<string, Fam>();
  const famOfSingle = new Map<string, Fam>();

  // семья на каждую супружескую пару
  for (const rel of relationships) {
    if (rel.kind !== "spouse") continue;
    const a = byId.get(rel.from_person_id);
    const b = byId.get(rel.to_person_id);
    if (!a || !b) continue;
    const key = pairKey(a.id, b.id);
    if (famOfPair.has(key)) continue;
    const husb = a.gender === "female" ? b : a;
    const wife = a.gender === "female" ? a : b;
    const fam: Fam = { id: `F${fams.length + 1}`, husb: husb.id, wife: wife.id, children: [], couple: true };
    fams.push(fam);
    famOfPair.set(key, fam);
  }

  // дети: в семью родителей, если те в браке, иначе в одиночные семьи
  const parentsByChild = new Map<string, string[]>();
  for (const rel of relationships) {
    if (rel.kind !== "parent") continue;
    const list = parentsByChild.get(rel.to_person_id) ?? [];
    if (!list.includes(rel.from_person_id)) list.push(rel.from_person_id);
    parentsByChild.set(rel.to_person_id, list);
  }

  for (const [childId, parents] of parentsByChild) {
    for (let i = 0; i < parents.length; i++) {
      for (let j = i + 1; j < parents.length; j++) {
        const fam = famOfPair.get(pairKey(parents[i], parents[j]));
        if (fam && !fam.children.includes(childId)) fam.children.push(childId);
      }
    }
    for (const parent of parents) {
      const inCouple = parents.some((other) => other !== parent && famOfPair.has(pairKey(parent, other)));
      if (inCouple) continue;
      let fam = famOfSingle.get(parent);
      if (!fam) {
        const parentPerson = byId.get(parent);
        const isWife = parentPerson?.gender === "female";
        fam = {
          id: `F${fams.length + 1}`,
          husb: isWife ? undefined : parent,
          wife: isWife ? parent : undefined,
          children: [],
          couple: false,
        };
        fams.push(fam);
        famOfSingle.set(parent, fam);
      }
      if (!fam.children.includes(childId)) fam.children.push(childId);
    }
  }

  for (const person of persons) {
    const id = xref.get(person.id)!;
    out.push(`0 ${id} INDI`);
    const given = [person.first_name, person.middle_name].filter(Boolean).join(" ");
    out.push(`1 NAME ${given} /${person.last_name || "?"}/`.trim());
    if (person.maiden_name) {
      out.push(`1 NAME ${given} /${person.maiden_name}/`);
      out.push("2 TYPE maiden");
    }
    if (person.gender === "male") out.push("1 SEX M");
    if (person.gender === "female") out.push("1 SEX F");

    const birthDate = dateToGed(person.birth_date, person.birth_year);
    if (birthDate || person.birth_place) {
      out.push("1 BIRT");
      if (birthDate) out.push(`2 DATE ${birthDate}`);
      if (person.birth_place) out.push(`2 PLAC ${person.birth_place}`);
    }
    if (!person.is_living) {
      const deathDate = dateToGed(person.death_date, person.death_year);
      if (deathDate || person.death_place) {
        out.push("1 DEAT");
        if (deathDate) out.push(`2 DATE ${deathDate}`);
        if (person.death_place) out.push(`2 PLAC ${person.death_place}`);
      }
    }
    if (person.residence) {
      out.push("1 RESI");
      out.push(`2 PLAC ${person.residence}`);
    }
    out.push(...textBlock(1, "NOTE", person.bio));

    for (const fam of fams) {
      if (fam.couple && (fam.husb === person.id || fam.wife === person.id)) out.push(`1 FAMS @${fam.id}@`);
    }
    for (const fam of fams) {
      if (fam.children.includes(person.id)) out.push(`1 FAMC @${fam.id}@`);
    }
  }

  for (const fam of fams) {
    out.push(`0 @${fam.id}@ FAM`);
    if (fam.husb) out.push(`1 HUSB ${xref.get(fam.husb)}`);
    if (fam.wife) out.push(`1 WIFE ${xref.get(fam.wife)}`);
    for (const child of fam.children) out.push(`1 CHIL ${xref.get(child)}`);
  }

  out.push("0 TRLR");
  return out.join("\n") + "\n";
}

// ---------------------------------------------------------------------
// Импорт
// ---------------------------------------------------------------------

export type ParsedPerson = {
  xref: string;
  last_name: string;
  first_name: string;
  middle_name: string;
  maiden_name: string | null;
  gender: Gender;
  birth_date: string | null;
  birth_year: number | null;
  birth_place: string | null;
  death_date: string | null;
  death_year: number | null;
  death_place: string | null;
  residence: string | null;
  bio: string | null;
};

export type ParsedFamily = { xref: string; husb: string | null; wife: string | null; children: string[] };

export type GedcomParseResult = { persons: ParsedPerson[]; families: ParsedFamily[] };

type Line = { level: number; tag: string; value: string };
type Record = { tag: string; xref: string; lines: Line[] };

function tokenize(text: string): Record[] {
  const records: Record[] = [];
  let current: Record | null = null;
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const match = /^(\d+)\s+(@[^@]+@|[A-Za-z_0-9]+)\s*(.*)$/.exec(raw);
    if (!match) continue;
    const line: Line = { level: Number(match[1]), tag: match[2], value: match[3].trimEnd() };
    if (line.level === 0) {
      current = line.tag.startsWith("@")
        ? { tag: line.value, xref: line.tag, lines: [] }
        : { tag: line.tag, xref: "", lines: [] };
      records.push(current);
    } else if (current) {
      current.lines.push(line);
    }
  }
  return records;
}

function parseName(value: string): { given: string; surname: string } {
  const match = /^(.*?)\/(.*?)\/(.*)$/.exec(value.trim());
  if (!match) return { given: value.trim(), surname: "" };
  return { given: match[1].trim(), surname: match[2].trim() || match[3].trim() };
}

function splitGiven(given: string): [string, string] {
  const parts = given.split(/\s+/).filter(Boolean);
  return [parts[0] ?? "", parts.slice(1).join(" ")];
}

function monthNumber(token: string): number | null {
  const upper = token.toUpperCase();
  const en = MONTHS_EN.indexOf(upper.slice(0, 3));
  if (en >= 0) return en + 1;
  const ru = MONTHS_RU.indexOf(upper.slice(0, 3));
  return ru >= 0 ? ru + 1 : null;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function gedDate(value: string): { iso: string | null; year: number | null } {
  const v = value.trim().toUpperCase();
  const yearMatch = v.match(/\b(1[6-9]\d{2}|20\d{2})\b/);
  const year = yearMatch ? Number(yearMatch[0]) : null;

  // «12 MAY 1938» или «12 МАЙ 1938»
  const named = v.match(/\b(\d{1,2})\s+([A-ZА-ЯЁ]{3,})\s+(1[6-9]\d{2}|20\d{2})\b/);
  if (named) {
    const month = monthNumber(named[2]);
    if (month) return { iso: `${named[3]}-${pad2(month)}-${pad2(Number(named[1]))}`, year };
  }
  // ISO-дата без имени месяца
  const iso = v.match(/\b(1[6-9]\d{2}|20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return { iso: `${iso[1]}-${pad2(Number(iso[2]))}-${pad2(Number(iso[3]))}`, year };
  // «12.05.1938» (день.месяц.год, как в российских программах)
  const dotted = v.match(/\b(\d{1,2})\.(\d{1,2})\.(1[6-9]\d{2}|20\d{2})\b/);
  if (dotted) return { iso: `${dotted[3]}-${pad2(Number(dotted[2]))}-${pad2(Number(dotted[1]))}`, year };

  return { iso: null, year };
}

function interpretIndi(record: Record): ParsedPerson {
  const nameEntries: { given: string; surname: string; type: string | null }[] = [];
  for (let i = 0; i < record.lines.length; i++) {
    const line = record.lines[i];
    if (line.level === 1 && line.tag === "NAME") {
      const parsed = parseName(line.value);
      let type: string | null = null;
      const next = record.lines[i + 1];
      if (next && next.level === 2 && next.tag === "TYPE") type = next.value.trim().toLowerCase();
      nameEntries.push({ ...parsed, type });
    }
  }

  const primary = nameEntries.find((entry) => entry.type !== "maiden") ?? nameEntries[0];
  const maiden = nameEntries.find((entry) => entry.type === "maiden");
  const [firstName, middleName] = primary ? splitGiven(primary.given) : ["", ""];

  let gender: Gender = "unknown";
  let section = "";
  let birthDate = ""; let birthPlace = ""; let deathDate = ""; let deathPlace = "";
  let residence = "";
  const notes: string[] = [];

  for (const line of record.lines) {
    if (line.level === 1) {
      section = line.tag;
      if (line.tag === "SEX") {
        gender = line.value.toUpperCase().startsWith("M") ? "male" : line.value.toUpperCase().startsWith("F") ? "female" : "unknown";
      } else if (line.tag === "NOTE") {
        notes.push(line.value);
      }
      continue;
    }
    if (line.level === 2 && line.tag === "PLAC") {
      if (section === "BIRT") birthPlace = line.value;
      else if (section === "DEAT") deathPlace = line.value;
      else if (section === "RESI") residence = line.value;
      continue;
    }
    if (line.level === 2 && line.tag === "DATE") {
      if (section === "BIRT") birthDate = line.value;
      else if (section === "DEAT") deathDate = line.value;
      continue;
    }
    if (line.tag === "CONT") notes.push("\n" + line.value);
    if (line.tag === "CONC") notes.push(line.value);
  }

  const birth = gedDate(birthDate);
  const death = gedDate(deathDate);

  return {
    xref: record.xref,
    last_name: primary?.surname ?? "",
    first_name: firstName,
    middle_name: middleName,
    maiden_name: maiden ? maiden.surname || null : null,
    gender,
    birth_date: birth.iso,
    birth_year: birth.year,
    birth_place: birthPlace || null,
    death_date: death.iso,
    death_year: death.year,
    death_place: deathPlace || null,
    residence: residence || null,
    bio: notes.join("").trim() || null,
  };
}

export function parseGedcom(text: string): GedcomParseResult {
  const records = tokenize(text);
  const persons: ParsedPerson[] = [];
  const families: ParsedFamily[] = [];

  for (const record of records) {
    if (record.tag === "INDI") persons.push(interpretIndi(record));
    else if (record.tag === "FAM") {
      const husb = record.lines.find((l) => l.tag === "HUSB")?.value ?? null;
      const wife = record.lines.find((l) => l.tag === "WIFE")?.value ?? null;
      const children = record.lines.filter((l) => l.tag === "CHIL").map((l) => l.value);
      families.push({ xref: record.xref, husb, wife, children });
    }
  }

  return { persons, families };
}
