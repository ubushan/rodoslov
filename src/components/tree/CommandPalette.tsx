"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { lifespan, peopleWord, shortName } from "@/lib/format";
import type { Person } from "@/lib/types";

/** Склонение по числу: 1 связь, 2 связи, 5 связей. */
function linksWord(n: number): string {
  const tail = n % 100;
  if (tail >= 11 && tail <= 14) return "связей";
  switch (n % 10) {
    case 1:
      return "связь";
    case 2:
    case 3:
    case 4:
      return "связи";
    default:
      return "связей";
  }
}

/** Действие палитры: их список собирает холст — палитра только ищет и рисует. */
export type PaletteAction = {
  id: string;
  title: string;
  hint: string;
  /** подсказка горячей клавиши; показываем только то, что правда работает */
  kbd?: string;
  icon: PaletteIcon;
  run: () => void;
};

export type PaletteIcon =
  | "plus"
  | "layout"
  | "filter"
  | "fit"
  | "image"
  | "file"
  | "theme"
  | "place"
  | "person"
  | "search";

type Props = {
  open: boolean;
  onClose: () => void;
  /** люди, которые сейчас есть на холсте */
  persons: Person[];
  relationshipsCount: number;
  actions: PaletteAction[];
  onPickPerson: (id: string) => void;
  onPickPlace: (place: string) => void;
};

/* ---------------------------------------------------------------------
   Поиск: подстрока + совпадение по началам слов. Без библиотек.
   --------------------------------------------------------------------- */

function normalize(text: string) {
  return text.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

/** Чем больше очков, тем выше строка; 0 — не подходит. */
function fuzzy(haystack: string, needle: string) {
  const h = normalize(haystack);
  const n = normalize(needle);
  if (!n) return 1;
  const idx = h.indexOf(n);
  if (idx >= 0) return 1000 - idx - (h.length - n.length) * 0.1;

  const words = h.split(" ");
  const needles = n.split(" ");
  let score = 0;
  let wi = 0;
  for (let i = 0; i < needles.length && wi < words.length; i++) {
    let found = false;
    while (wi < words.length) {
      const word = words[wi++];
      if (word.indexOf(needles[i]) === 0) {
        score += 40;
        found = true;
        break;
      }
    }
    if (!found) return 0;
  }
  return score;
}

/** Разбивает строку на «до · совпадение · после», чтобы подсветить находку. */
function splitMatch(text: string, query: string): [string, string, string] {
  const needle = normalize(query).split(" ")[0];
  if (!needle) return [text, "", ""];
  const index = normalize(text).indexOf(needle);
  if (index < 0) return [text, "", ""];
  return [text.slice(0, index), text.slice(index, index + needle.length), text.slice(index + needle.length)];
}

function Highlight({ text, query }: { text: string; query: string }) {
  const [before, match, after] = splitMatch(text, query);
  if (!match) return <>{text}</>;
  return (
    <>
      {before}
      <mark className="bg-transparent font-semibold text-brass-ink">{match}</mark>
      {after}
    </>
  );
}

/* ---------------------------------------------------------------------
   Иконки: те же штрихи, что у дока
   --------------------------------------------------------------------- */

function Icon({ name }: { name: PaletteIcon }) {
  const common = {
    width: 17,
    height: 17,
    viewBox: "0 0 18 18",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "plus":
      return (
        <svg {...common}>
          <path d="M9 3.5v11M3.5 9h11" />
        </svg>
      );
    case "layout":
      return (
        <svg {...common}>
          <rect x="2.5" y="2.5" width="5" height="4" rx="1" />
          <rect x="10.5" y="2.5" width="5" height="4" rx="1" />
          <rect x="6.5" y="11.5" width="5" height="4" rx="1" />
          <path d="M5 6.5v2.5h8V6.5" />
        </svg>
      );
    case "filter":
      return (
        <svg {...common}>
          <path d="M3 5h12M5.5 9h7M7.5 13h3" />
        </svg>
      );
    case "fit":
      return (
        <svg {...common}>
          <path d="M4 8V4h4M16 12v4h-4M16 8V4h-4M4 12v4h4" />
        </svg>
      );
    case "image":
      return (
        <svg {...common}>
          <rect x="2.5" y="4" width="13" height="10" rx="1.6" />
          <path d="M2.5 11l3.2-2.6 3 2.4 2.3-1.8 4 3.2" />
          <circle cx="6.6" cy="7.2" r="1" />
        </svg>
      );
    case "file":
      return (
        <svg {...common}>
          <path d="M5 2.5h5.5L13 5v10.5H5z" />
          <path d="M10.5 2.5V5H13M7 9h4M7 12h4" />
        </svg>
      );
    case "theme":
      return (
        <svg {...common}>
          <circle cx="9" cy="9" r="3.2" />
          <path d="M9 2.2v1.6M9 14.2v1.6M2.2 9h1.6M14.2 9h1.6M4.2 4.2l1.1 1.1M12.7 12.7l1.1 1.1M13.8 4.2l-1.1 1.1M5.3 12.7l-1.1 1.1" />
        </svg>
      );
    case "place":
      return (
        <svg {...common}>
          <path d="M9 16s5-4.4 5-8.2A5 5 0 0 0 4 7.8C4 11.6 9 16 9 16Z" />
          <circle cx="9" cy="7.8" r="1.7" />
        </svg>
      );
    case "person":
      return (
        <svg {...common}>
          <circle cx="9" cy="7" r="2.8" />
          <path d="M3.8 15c.5-2.5 2.7-4 5.2-4s4.7 1.5 5.2 4" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="4.8" />
          <path d="M11.6 11.6 15 15" />
        </svg>
      );
  }
}

type Row =
  | {
      key: string;
      group: "Люди";
      score: number;
      person: Person;
      lead: string;
      trail: string;
    }
  | { key: string; group: "Места"; score: number; place: string; lead: string; trail: string }
  | {
      key: string;
      group: "Действия";
      score: number;
      action: PaletteAction;
      lead: string;
      trail: string;
    };

/** «Рязань» — место человека: где родился, где живёт, где похоронен */
function placeOf(person: Person) {
  return person.birth_place ?? person.residence ?? person.death_place ?? "";
}

function placesOf(persons: Person[]) {
  const counts = new Map<string, number>();
  for (const person of persons) {
    for (const value of [person.birth_place, person.residence, person.death_place]) {
      const place = value?.trim();
      if (!place) continue;
      counts.set(place, (counts.get(place) ?? 0) + 1);
    }
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count }));
}

/**
 * Командная палитра ⌘K: люди, места и действия древа. Открывается по
 * горячей клавише, по событию `studio:palette` из шапки и по `?palette=1`.
 * Ничего не пишет в базу — только ищет и запускает уже существующие действия.
 */
export function CommandPalette({
  open,
  onClose,
  persons,
  relationshipsCount,
  actions,
  onPickPerson,
  onPickPlace,
}: Props) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const rows = useMemo<Row[]>(() => {
    const list: Row[] = [];

    const people = persons
      .map((person) => ({
        person,
        score: Math.max(
          fuzzy([person.last_name, person.first_name, person.middle_name, person.maiden_name].filter(Boolean).join(" "), query),
          fuzzy(placeOf(person), query) * 0.6,
          query ? 0 : 10
        ),
      }))
      .filter((entry) => entry.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          (a.person.birth_year ?? 9999) - (b.person.birth_year ?? 9999) ||
          a.person.last_name.localeCompare(b.person.last_name)
      )
      .slice(0, 6);
    for (const { person, score } of people) {
      list.push({
        key: `p-${person.id}`,
        group: "Люди",
        score,
        person,
        lead: shortName(person),
        trail: [lifespan(person), placeOf(person)].filter(Boolean).join(" · ") || "нет дат и места",
      });
    }

    for (const place of placesOf(persons)) {
      const score = fuzzy(place.name, query);
      if (score <= 0) continue;
      list.push({
        key: `pl-${place.name}`,
        group: "Места",
        score,
        place: place.name,
        lead: place.name,
        trail: `${place.count} ${place.count === 1 ? "человек" : place.count < 5 ? "человека" : "человек"}`,
      });
    }

    for (const action of actions) {
      const score = Math.max(fuzzy(action.title, query), query ? 0 : 6);
      if (score <= 0) continue;
      list.push({
        key: action.id,
        group: "Действия",
        score,
        action,
        lead: action.title,
        trail: action.hint,
      });
    }

    return list;
  }, [persons, actions, query]);

  // при новом запросе активной снова становится первая строка
  useEffect(() => {
    setIndex(0);
  }, [query]);

  // открытие: пустой запрос и фокус в поле
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setIndex(0);
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  // активная строка всегда видна
  useEffect(() => {
    if (!open) return;
    const active = bodyRef.current?.querySelector('[data-active="true"]');
    active?.scrollIntoView({ block: "nearest" });
  }, [open, index, rows]);

  function run(row: Row | undefined) {
    if (!row) return;
    onClose();
    if (row.group === "Люди") onPickPerson(row.person.id);
    else if (row.group === "Места") onPickPlace(row.place);
    else row.action.run();
  }

  // Клавиши палитры: стрелки, Enter, Esc. Слушаем окно, а не поле, —
  // фокус может уехать на кнопку строки.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setIndex((current) => (rows.length ? (current + 1) % rows.length : 0));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setIndex((current) => (rows.length ? (current - 1 + rows.length) % rows.length : 0));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        run(rows[Math.min(index, rows.length - 1)]);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rows, index, onClose, onPickPerson, onPickPlace]);

  if (!open) return null;

  const activeRow = rows[Math.min(index, Math.max(0, rows.length - 1))];
  // Группы всегда в одном порядке: Люди · Места · Действия
  const GROUPS: Row["group"][] = ["Люди", "Места", "Действия"];

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      <div
        className="absolute inset-0 bg-[var(--p-scrim)] backdrop-blur-[1.5px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Командная палитра"
        className="absolute inset-x-0 bottom-0 flex max-h-[84%] flex-col overflow-hidden rounded-t-[22px] border border-[var(--p-line-3)] bg-[var(--p-glass-2)] shadow-[var(--p-shadow-sheet)] backdrop-blur-[20px] sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-11 sm:max-h-[calc(100%-88px)] sm:w-[min(600px,calc(100%-32px))] sm:-translate-x-1/2 sm:rounded-2xl sm:shadow-[var(--shadow-lift)]"
      >
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-[var(--p-line)] px-3.5 text-ink-400">
          <Icon name="search" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Человек, место или действие"
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded="true"
            aria-controls="studio-palette-body"
            aria-activedescendant={activeRow ? `studio-palette-${activeRow.key}` : undefined}
            aria-label="Поиск по людям, местам и действиям"
            className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ink-800 outline-none placeholder:text-ink-400"
          />
          <span
            aria-hidden="true"
            className="hidden shrink-0 rounded-[6px] border border-b-2 border-[var(--p-line)] bg-[var(--p-row-bg)] px-1.5 py-px font-mono text-[11px] text-ink-500 sm:block"
          >
            esc
          </span>
        </div>

        <div
          ref={bodyRef}
          id="studio-palette-body"
          role="listbox"
          aria-label="Результаты"
          className="min-h-0 flex-1 overflow-y-auto py-1"
        >
          {!rows.length && (
            <div className="flex flex-col items-center gap-1.5 px-5 py-9 text-center">
              <Icon name="search" />
              <b className="text-[14px] font-medium text-ink-600">Ничего не нашлось</b>
              <span className="text-[12.5px] text-ink-400">
                Попробуйте имя, место или действие — «экспорт», «тема», «раскладка».
              </span>
            </div>
          )}

          {GROUPS.map((group) => {
            const items = rows.filter((row) => row.group === group);
            // «Места» показываем всегда: в древе без мест группа честно молчит
            const silentPlaces = group === "Места" && !query && !items.length;
            if (!items.length && !silentPlaces) return null;
            return (
              <div key={group} role="group" aria-label={group}>
                <p className="mb-0.5 mt-2 px-5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-400">
                  {group}
                </p>
                {!items.length && (
                  <p className="px-5 pb-1 text-[12.5px] leading-relaxed text-ink-400">
                    В этом древе пока не указано ни одного места рождения или проживания.
                  </p>
                )}
                {items.map((row) => {
                  const i = rows.indexOf(row);
                  const isActive = i === index;
                  return (
                  <button
                    type="button"
                    key={row.key}
                    id={`studio-palette-${row.key}`}
                    role="option"
                    aria-selected={isActive}
                    data-active={isActive}
                    onMouseMove={() => setIndex(i)}
                    onClick={() => run(row)}
                    className={`mx-2 flex min-h-[42px] w-[calc(100%-16px)] items-center gap-2.5 rounded-[10px] px-3 py-1 text-left text-[13.5px] transition-colors ${
                      isActive
                        ? "bg-[var(--p-acc-bg)] text-ink-800 shadow-[inset_2px_0_0_var(--color-brass-500)]"
                        : "text-ink-700 hover:bg-[var(--p-hover-bg)]"
                    }`}
                  >
                    {row.group === "Люди" ? (
                      <span
                        aria-hidden="true"
                        className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-[var(--p-row-bg)]"
                      >
                        {row.person.photo_path ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/photos/${row.person.photo_path}`}
                            alt=""
                            className="h-[30px] w-[30px] rounded-full object-cover"
                          />
                        ) : row.person.gender !== "unknown" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={row.person.gender === "male" ? "/avatars/male.png" : "/avatars/female.png"}
                            alt=""
                            className="h-[30px] w-[30px] rounded-full"
                          />
                        ) : (
                          <Icon name="person" />
                        )}
                      </span>
                    ) : (
                      <span
                        aria-hidden="true"
                        className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[9px] border border-[var(--p-line)] bg-[var(--p-field-bg)] text-ink-500"
                      >
                        <Icon name={row.group === "Места" ? "place" : row.action.icon} />
                      </span>
                    )}

                    <span className="min-w-0 flex-1 truncate">
                      <Highlight text={row.lead} query={query} />
                    </span>

                    {row.group === "Действия" && row.action.kbd && (
                      <span
                        aria-hidden="true"
                        className="shrink-0 rounded-[6px] border border-[var(--p-line)] bg-[var(--p-row-bg)] px-1.5 py-px font-mono text-[11px] text-ink-500"
                      >
                        {row.action.kbd}
                      </span>
                    )}

                    <em className="hidden shrink-0 truncate text-[12.5px] not-italic text-ink-400 sm:block sm:max-w-[240px]">
                      {row.group === "Действия" ? row.action.hint : row.trail}
                    </em>
                  </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--p-line)] px-4 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 text-[11.5px] text-ink-400">
          <span className="truncate">↑↓ выбрать · ↵ открыть · esc закрыть</span>
          <span className="hidden truncate sm:block">
            {persons.length} {peopleWord(persons.length)} на холсте · {relationshipsCount}{" "}
            {linksWord(relationshipsCount)}
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
