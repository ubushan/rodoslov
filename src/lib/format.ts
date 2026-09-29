import type { Person } from "./types";

/** «Иванова Мария Петровна» */
export function fullName(p: Pick<Person, "last_name" | "first_name" | "middle_name">) {
  const name = [p.last_name, p.first_name, p.middle_name].filter(Boolean).join(" ").trim();
  return name || "Без имени";
}

/** «Мария Иванова (Лебедева)» — для компактной карточки */
export function shortName(p: Pick<Person, "last_name" | "first_name" | "maiden_name">) {
  const name = [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || "Без имени";
  return p.maiden_name ? `${name} (${p.maiden_name})` : name;
}

/** «12.05.1938» из ISO-даты. Если дата неполная или кривая — как есть. */
export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}.${m[2]}.${m[1]}`;
}

/** «29.09.2026, 14:35» — для списков админки */
export function formatDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString("ru-RU");
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time}`;
}

/** Дата рождения, как её показывать: полная дата, иначе год, иначе null */
export function birthLabel(p: Pick<Person, "birth_date" | "birth_year">) {
  return formatDate(p.birth_date) ?? (p.birth_year ? String(p.birth_year) : null);
}

/** Дата смерти: полная дата, иначе год, иначе null */
export function deathLabel(p: Pick<Person, "death_date" | "death_year">) {
  return formatDate(p.death_date) ?? (p.death_year ? String(p.death_year) : null);
}

/** «12.05.1938 — 20.01.2010» либо «1978» */
export function lifespan(
  p: Pick<Person, "birth_date" | "birth_year" | "death_date" | "death_year" | "is_living">
) {
  const b = birthLabel(p);
  if (!b && !(p.is_living ? null : deathLabel(p))) return null;
  if (p.is_living) return b ?? null;
  return `${b ?? "?"} — ${deathLabel(p) ?? "?"}`;
}

function parseIsoDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Полных лет на сегодня, а для умерших — на дату смерти. */
export function ageYears(
  p: Pick<Person, "birth_date" | "birth_year" | "death_date" | "death_year" | "is_living">
): number | null {
  const start =
    parseIsoDate(p.birth_date) ?? (p.birth_year ? new Date(p.birth_year, 0, 1) : null);
  if (!start) return null;

  let end: Date | null;
  if (p.is_living) {
    end = new Date();
  } else {
    end = parseIsoDate(p.death_date) ?? (p.death_year ? new Date(p.death_year, 11, 31) : null);
  }
  if (!end) return null;

  let years = end.getFullYear() - start.getFullYear();
  const m = end.getMonth() - start.getMonth();
  if (m < 0 || (m === 0 && end.getDate() < start.getDate())) years -= 1;
  return years >= 0 ? years : null;
}

/** «87 лет», «41 год», «3 года» */
export function yearsWord(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "год";
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return "года";
  return "лет";
}

/** «1 человек», «3 человека», «12 человек» */
export function peopleWord(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  return m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? "человека" : "человек";
}

export function initials(p: Pick<Person, "last_name" | "first_name">) {
  return [p.first_name?.[0], p.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "?";
}

export function publicUrl(supabaseUrl: string, bucket: string, path: string | null) {
  if (!path) return null;
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

export const ROLE_LABEL: Record<string, string> = {
  owner: "Владелец",
  editor: "Редактор",
  viewer: "Зритель",
};

export const ROLE_HINT: Record<string, string> = {
  owner: "Управляет участниками и может удалить древо",
  editor: "Добавляет и меняет карточки и связи",
  viewer: "Смотрит древо и скачивает картинку",
};
