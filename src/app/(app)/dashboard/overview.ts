/**
 * Помощники блоков «Древ»: подписи событий, относительное время, ближайшие
 * дни рождения и разбор ссылок-приглашений. Только чистые функции — данные
 * приходят выборками из page.tsx, здесь они превращаются в подписи.
 */

import { formatDate } from "@/lib/format";

/* ---------------------------------------------------------------------
   Склонения и подписи
   --------------------------------------------------------------------- */

function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

/** «1 день», «3 дня», «12 дней» */
export const daysWord = (n: number) => plural(n, "день", "дня", "дней");
/** «1 событие», «3 события», «12 событий» */
export const eventsWord = (n: number) => plural(n, "событие", "события", "событий");

/** «через 5 дней»; сегодня и завтра — словами, так короче читается */
export function inDaysWord(days: number): string {
  if (days <= 0) return "сегодня";
  if (days === 1) return "завтра";
  return `через ${days} ${daysWord(days)}`;
}

/** «2 часа назад», «вчера», «3 дня назад» — компактная метка времени */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const seconds = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  if (seconds < 60) return "только что";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} ${plural(minutes, "минуту", "минуты", "минут")} назад`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${plural(hours, "час", "часа", "часов")} назад`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "вчера";
  if (days < 30) return `${days} ${daysWord(days)} назад`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ${plural(months, "месяц", "месяца", "месяцев")} назад`;
  return `${Math.floor(months / 12)} ${plural(Math.floor(months / 12), "год", "года", "лет")} назад`;
}

/* ---------------------------------------------------------------------
   События древа (tree_events)
   --------------------------------------------------------------------- */

export type EventKind = { label: string; dot: string };

const EVENT_KIND: Record<string, EventKind> = {
  person_created: { label: "Карточка", dot: "bg-male" },
  person_updated: { label: "Карточка", dot: "bg-male" },
  person_deleted: { label: "Карточка", dot: "bg-male" },
  relation_added: { label: "Связь", dot: "bg-ink-300" },
  relation_removed: { label: "Связь", dot: "bg-ink-300" },
  tree_created: { label: "Древо", dot: "bg-brass-500" },
  tree_renamed: { label: "Древо", dot: "bg-brass-500" },
  member_added: { label: "Участник", dot: "bg-female" },
  member_role: { label: "Роль", dot: "bg-female" },
  member_removed: { label: "Участник", dot: "bg-female" },
  invite_created: { label: "Приглашение", dot: "bg-brass-500" },
  invite_revoked: { label: "Приглашение", dot: "bg-brass-500" },
  import: { label: "Импорт", dot: "bg-ink-300" },
};

const UNKNOWN_KIND: EventKind = { label: "Событие", dot: "bg-ink-300" };

export function eventKind(kind: string): EventKind {
  return EVENT_KIND[kind] ?? UNKNOWN_KIND;
}

/* ---------------------------------------------------------------------
   Ближайшие дни рождения (persons)
   --------------------------------------------------------------------- */

const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

export type LivingPerson = {
  id: string;
  tree_id: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  birth_date: string | null;
};

export type UpcomingDate = {
  personId: string;
  treeId: string;
  name: string;
  /** «2 октября» — день и месяц без года */
  dateLabel: string;
  /** Сколько дней до даты: 0 — сегодня, 1 — завтра */
  days: number;
  /** Сколько лет исполнится */
  turning: number;
};

/** «Мария Петровна», иначе полное имя, иначе «Без имени» */
function birthdayName(p: LivingPerson): string {
  const short = [p.first_name, p.middle_name].filter(Boolean).join(" ").trim();
  if (short) return short;
  return [p.last_name, p.first_name].filter(Boolean).join(" ").trim() || "Без имени";
}

/**
 * Ближайшие по календарю дни рождения: берёт живых людей с полной датой
 * рождения, считает следующую годовщину и сортирует по близости.
 */
export function upcomingDates(
  people: LivingPerson[],
  limit = 5,
  now: Date = new Date()
): UpcomingDate[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const out: UpcomingDate[] = [];

  for (const person of people) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(person.birth_date ?? "");
    if (!match) continue;

    const birthYear = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;

    // 29 февраля в невисокосный год JS переносит на 1 марта — это допустимо
    let next = new Date(today.getFullYear(), month - 1, day);
    if (next.getTime() < today.getTime()) {
      next = new Date(today.getFullYear() + 1, month - 1, day);
    }

    const days = Math.round((next.getTime() - today.getTime()) / 86400000);
    const turning = next.getFullYear() - birthYear;
    // битая или будущая дата рождения — не выдумываем возраст
    if (turning < 1 || turning > 130) continue;

    out.push({
      personId: person.id,
      treeId: person.tree_id,
      name: birthdayName(person),
      dateLabel: `${day} ${MONTHS[month - 1]}`,
      days,
      turning,
    });
  }

  out.sort((a, b) => a.days - b.days);
  return out.slice(0, limit);
}

/* ---------------------------------------------------------------------
   Ссылки-приглашения (tree_invites)
   --------------------------------------------------------------------- */

export type Invite = {
  id: string;
  tree_id: string;
  token: string;
  role: string;
  expires_at: string | null;
  max_uses: number | null;
  uses: number;
};

/** Только живые ссылки: не истекли и не выбрали свой предел переходов */
export function activeInvites(rows: Invite[], now: Date = new Date()): Invite[] {
  return rows.filter((row) => {
    if (row.expires_at && new Date(row.expires_at).getTime() <= now.getTime()) return false;
    const max = row.max_uses === null || row.max_uses === undefined ? null : Number(row.max_uses);
    if (max !== null && Number(row.uses ?? 0) >= max) return false;
    return true;
  });
}

/** «до 12.10.2026» либо «бессрочно» */
export function expiryLabel(iso: string | null): string {
  if (!iso) return "бессрочно";
  return `до ${formatDate(iso) ?? iso}`;
}

/** «3 перехода», «1 переход», «10 переходов» */
export function usesWord(n: number): string {
  return plural(n, "переход", "перехода", "переходов");
}

/**
 * Подпись к большому числу переходов: само число крупно слева, поэтому
 * повторять его здесь не нужно — «из 10 переходов», «3 перехода · без ограничения».
 */
export function usesLabel(used: number, max: number | null): string {
  if (max === null) return `${usesWord(used)} · без ограничения`;
  return `из ${max} ${usesWord(max)}`;
}

/** По скольким переходам из скольких: для полоски прогресса */
export function usesPercent(used: number, max: number | null): number | null {
  if (!max || max <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((used / max) * 100)));
}
