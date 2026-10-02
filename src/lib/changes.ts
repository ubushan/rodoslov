/**
 * Разбор правок карточки: подписи полей и человекочитаемая разница.
 * Используется и в истории карточки, и в истории древа.
 */

export const CHANGE_FIELDS: [string, string][] = [
  ["last_name", "Фамилия"],
  ["first_name", "Имя"],
  ["middle_name", "Отчество"],
  ["maiden_name", "Девичья фамилия"],
  ["other_names", "Другие имена"],
  ["gender", "Пол"],
  ["birth_year", "Год рождения"],
  ["birth_date", "Дата рождения"],
  ["birth_place", "Место рождения"],
  ["residence", "Проживание"],
  ["is_living", "Жив"],
  ["death_year", "Год смерти"],
  ["death_date", "Дата смерти"],
  ["death_place", "Место смерти"],
  ["bio", "Биография"],
];

/** «12.05.1938» из ISO-даты */
function formatDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : iso;
}

export function formatChangeValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "gender") {
    return value === "male" ? "мужской" : value === "female" ? "женский" : "не указан";
  }
  if (key === "is_living") return value ? "жив" : "умер";
  if (key === "birth_date" || key === "death_date") return formatDate(String(value));
  return String(value);
}

/**
 * Список изменений «Поле: было → стало».
 * Без «до» возвращает одну строку про создание карточки.
 */
export function describeChange(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined
): string[] {
  if (!before && after) {
    const name = [after.first_name, after.last_name].filter(Boolean).join(" ") || "без имени";
    return [`создал(а) карточку «${name}»`];
  }
  if (!before || !after) return [];

  const parts: string[] = [];
  for (const [key, label] of CHANGE_FIELDS) {
    if (before[key] === after[key]) continue;
    parts.push(`${label}: ${formatChangeValue(key, before[key])} → ${formatChangeValue(key, after[key])}`);
  }
  return parts.length ? parts : ["без видимых изменений"];
}
