import type { Person } from "./types";

/** «Иванова Мария Петровна» */
export function fullName(p: Pick<Person, "last_name" | "first_name" | "middle_name">) {
  const name = [p.last_name, p.first_name, p.middle_name].filter(Boolean).join(" ").trim();
  return name || "Без имени";
}

/** «Мария Иванова» — для компактной карточки */
export function shortName(p: Pick<Person, "last_name" | "first_name">) {
  return [p.first_name, p.last_name].filter(Boolean).join(" ").trim() || "Без имени";
}

/** «1924 — 1991» либо «р. 1978» */
export function lifespan(p: Pick<Person, "birth_year" | "death_year" | "is_living">) {
  if (!p.birth_year && !p.death_year) return null;
  if (p.is_living) return p.birth_year ? `р. ${p.birth_year}` : null;
  return `${p.birth_year ?? "?"} — ${p.death_year ?? "?"}`;
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
