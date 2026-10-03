"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Gender } from "@/lib/types";

/** Строка списка: всё уже посчитано на сервере, клиент только ищет и фильтрует. */
export type PeopleRow = {
  id: string;
  name: string;
  maiden: string | null;
  gender: Gender;
  years: string | null;
  place: string | null;
  generation: number | null;
  isLiving: boolean;
  /** есть ли хоть одна дата — для фильтра «Без дат» */
  hasDates: boolean;
};

const FILTERS = [
  { key: "all", label: "Все" },
  { key: "male", label: "Мужчины" },
  { key: "female", label: "Женщины" },
  { key: "living", label: "Живые" },
  { key: "nodate", label: "Без дат" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

/** «ё» и регистр не мешают поиску — как в прототипе. */
function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** «III» — поколение подписано так же, как в прототипе. */
function roman(n: number): string {
  const table: Array<[number, string]> = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  let rest = n;
  for (const [value, sign] of table) {
    while (rest >= value) {
      out += sign;
      rest -= value;
    }
  }
  return out;
}

const FACE_COLOR: Record<Gender, string> = {
  male: "text-male",
  female: "text-female",
  unknown: "text-plain",
};

/** Силуэт по полу — та же «плитка», что в прототипе, но без картинок. */
function PersonFace({ gender }: { gender: Gender }) {
  return (
    <span
      aria-hidden="true"
      className="grid h-[30px] w-[30px] shrink-0 place-items-center overflow-hidden rounded-[9px] border border-[var(--p-line)] bg-[var(--p-row-bg)]"
    >
      <svg viewBox="0 0 30 30" width="30" height="30" className={FACE_COLOR[gender]}>
        <circle cx="15" cy="10.5" r="5" fill="currentColor" />
        <path d="M4.5 31c0-6 4.7-10.5 10.5-10.5S25.5 25 25.5 31z" fill="currentColor" />
      </svg>
    </span>
  );
}

function IconSearch() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="9" cy="9" r="5.2" />
      <path d="M13 13l4 4" />
    </svg>
  );
}

export function PeopleList({
  treeId,
  treeTitle,
  rows,
}: {
  treeId: string;
  treeTitle: string;
  rows: PeopleRow[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const found = useMemo(() => {
    const q = normalize(query);
    return rows.filter((row) => {
      if (filter === "male" && row.gender !== "male") return false;
      if (filter === "female" && row.gender !== "female") return false;
      if (filter === "living" && !row.isLiving) return false;
      if (filter === "nodate" && row.hasDates) return false;
      if (!q) return true;
      return (
        normalize(row.name).includes(q) ||
        (row.maiden ? normalize(row.maiden).includes(q) : false) ||
        (row.place ? normalize(row.place).includes(q) : false) ||
        (row.years ? normalize(row.years).includes(q) : false)
      );
    });
  }, [rows, query, filter]);

  function reset() {
    setQuery("");
    setFilter("all");
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-3 px-3 pb-4 pt-4 sm:px-5 sm:pb-6 sm:pt-6">
      <div className="shrink-0">
        <Link
          href={`/tree/${treeId}`}
          className="inline-flex items-center gap-1.5 text-sm text-ink-400 transition-colors hover:text-ink-700"
        >
          <span aria-hidden="true">←</span> К древу «{treeTitle}»
        </Link>
        <h1 className="mt-4 text-[28px] leading-tight text-ink-800 sm:text-[30px]">Люди</h1>
        <p className="mt-1.5 max-w-[58ch] text-sm leading-relaxed text-ink-500">
          Все, кто уже есть в древе. Ищите по имени и месту, отбирайте по полу и датам —
          строка ведёт в карточку человека.
        </p>
      </div>

      {/* Поиск и фильтры — стеклянная панель, как в прототипе */}
      <div className="glass flex shrink-0 flex-wrap items-center gap-2.5 px-3 py-2.5">
        <label className="flex h-9 min-w-0 flex-1 basis-[220px] items-center gap-2 rounded-[10px] border border-[var(--p-line)] bg-[var(--p-field-bg)] px-2.5 text-ink-400 transition-colors focus-within:border-[var(--p-acc-line)]">
          <IconSearch />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Имя или место — «Рязань», «Соколов»"
            aria-label="Поиск по имени и месту"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink-800 outline-none placeholder:text-ink-400"
          />
        </label>

        <div role="group" aria-label="Фильтры списка" className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((item) => {
            const on = filter === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                aria-pressed={on}
                className={`inline-flex h-[30px] items-center rounded-full border px-3 text-[12.5px] transition-colors ${
                  on
                    ? "border-transparent bg-fill font-semibold text-on-fill"
                    : "border-[var(--p-line)] bg-[var(--p-field-bg)] text-ink-500 hover:bg-[var(--p-hover-bg)] hover:text-ink-800"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <span
          role="status"
          className="whitespace-nowrap text-[12.5px] tabular-nums text-ink-400"
        >
          Показано {found.length} из {rows.length} человек
        </span>
      </div>

      {/* Список: шапка колонок на месте, строки прокручиваются */}
      <div className="glass flex min-h-0 flex-1 flex-col overflow-hidden">
        {rows.length === 0 ? (
          <div className="grid min-h-0 flex-1 place-items-center px-4 py-10">
            <p className="max-w-[46ch] text-center text-[14px] leading-relaxed text-ink-400">
              В этом древе пока нет людей. Карточки появятся здесь, как только их добавят
              на холсте.
            </p>
          </div>
        ) : found.length === 0 ? (
          <div className="grid min-h-0 flex-1 place-items-center px-4 py-10">
            <div className="text-center">
              <p className="text-[15px] text-ink-700">Никого не нашли</p>
              <p className="mx-auto mt-1.5 max-w-[46ch] text-[13.5px] leading-relaxed text-ink-400">
                Сбросьте фильтры или измените запрос — например, «Рязань» или «Соколов».
              </p>
              <button type="button" onClick={reset} className="btn-accent mt-4">
                Сбросить фильтры
              </button>
            </div>
          </div>
        ) : (
          <>
            <div
              aria-hidden="true"
              className="hidden shrink-0 grid-cols-[minmax(0,1.7fr)_120px_140px_minmax(0,1fr)] gap-3 border-b border-[var(--p-line)] bg-[var(--p-row-bg)] px-3.5 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-400 sm:grid"
            >
              <span>Человек</span>
              <span>Годы</span>
              <span>Поколение</span>
              <span>Место</span>
            </div>

            <ul className="min-h-0 flex-1 overflow-y-auto">
              {found.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/tree/${treeId}/person/${row.id}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-[var(--p-line-2)] px-3.5 py-2.5 text-ink-800 transition-colors last:border-b-0 hover:bg-[var(--p-hover-bg)] focus-visible:bg-[var(--p-acc-soft)] sm:grid-cols-[minmax(0,1.7fr)_120px_140px_minmax(0,1fr)]"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <PersonFace gender={row.gender} />
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] leading-snug">{row.name}</span>
                        {row.maiden && (
                          <span className="block truncate text-[11.5px] leading-snug text-ink-400">
                            в девичестве {row.maiden}
                          </span>
                        )}
                      </span>
                    </span>

                    <span className="justify-self-end whitespace-nowrap font-mono text-[12.5px] text-ink-600 sm:justify-self-start">
                      {row.years ?? "нет дат"}
                    </span>

                    <span className="col-span-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 sm:contents">
                      <span className="whitespace-nowrap text-[12.5px] text-ink-500">
                        {row.generation ? `${roman(row.generation)} поколение` : "—"}
                      </span>
                      <span className="min-w-0 truncate text-[12.5px] text-ink-500">
                        {row.place ?? "—"}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
