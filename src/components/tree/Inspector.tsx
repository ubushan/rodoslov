"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { NodeMenu, MenuItem } from "./NodeMenu";
import {
  ageYears,
  birthLabel,
  deathLabel,
  initials,
  lifespan,
  shortName,
  yearsWord,
} from "@/lib/format";
import type { NewRelative } from "@/lib/place";
import type { Person, Relationship } from "@/lib/types";

/**
 * Последняя правка карточки — строка из таблицы `person_changes`.
 * Готовится на сервере (см. tree/[treeId]/page.tsx), чтобы инспектор не ходил
 * в базу сам: он живёт в клиентском холсте.
 */
export type InspectorChange = {
  id: number;
  personId: string;
  author: string;
  /** «04.10.2026, 00:12» */
  at: string;
  /** «Место рождения: Рязань → Касимов» */
  summary: string;
};

type Props = {
  /** Все люди древа — по ним считаются родня, поколения и места */
  persons: Person[];
  relationships: Relationship[];
  /** id выделенных на холсте, в порядке холста */
  selectedIds: string[];
  /** правки карточек древа; null — истории нет (таблица недоступна) */
  changes: InspectorChange[] | null;
  canEdit: boolean;
  photoUrlFor: (person: Person) => string | null;
  /** у кого есть супруги или дети — только им доступна семейная ветка */
  branchable: Set<string>;
  onSelect: (id: string) => void;
  onOpenCard: (id: string) => void;
  /** «Правка» — та же карточка, но сразу у формы правки */
  onEditCard: (id: string) => void;
  /** «Открыть семейную ветку» — отдельная страница ветки человека */
  onBranch: (id: string) => void;
  /** добавление родственника: отец, мать, супруг(а), сын, дочь, брат, сестра.
      Пол передаём для «Сын»/«Дочь» — иначе оба пункта ведут к одной связи. */
  onAddRelative: (id: string, relation: NewRelative, gender?: "male" | "female") => void;
  onHide: (ids: string[]) => void;
  onClear: () => void;
};

/**
 * Поверхность инспектора. На телефоне — нижний лист, который поднят над
 * нижней панелью действий (её высота 58px + отступ 12px + зазор). На десктопе —
 * парящая стеклянная панель справа поверх холста: холст при этом на всю ширину
 * окна, а место под панель учитывает только «уместить» (см. TreeCanvas).
 */
const INSPECTOR_SURFACE =
  "absolute inset-x-0 bottom-[76px] z-30 flex max-h-[46%] flex-col gap-3 overflow-hidden rounded-[22px] border border-[var(--p-line)] bg-[var(--p-glass-2)] p-4 pb-6 shadow-[var(--p-shadow-sheet)] backdrop-blur-[14px] sm:inset-x-auto sm:bottom-3 sm:right-3 sm:top-3 sm:max-h-none sm:w-[320px] sm:rounded-[20px] sm:bg-[var(--p-glass)] sm:p-3.5 sm:shadow-[var(--shadow-lift)]";

const TABS = [
  { id: "facts", label: "Факты" },
  { id: "family", label: "Семья" },
  { id: "history", label: "История" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** «3 события», «1 правка» — счётчики в подписях карточки */
function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
function roman(n: number) {
  return ROMAN[n] ?? String(n);
}

/** Плюс — «Добавить родственника» */
function IconPlus() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M9 3.5v11M3.5 9h11" />
    </svg>
  );
}

/** Ветвь: карточка и её семья — «Открыть семейную ветку» */
function IconBranch() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="6.5" y="2.5" width="5" height="4" rx="1" />
      <rect x="2.5" y="11.5" width="5" height="4" rx="1" />
      <rect x="10.5" y="11.5" width="5" height="4" rx="1" />
      <path d="M9 6.5v2.5M5 11.5V9h8v2.5" />
    </svg>
  );
}

function genderLabel(person: Person) {
  if (person.gender === "male") return "Мужчина";
  if (person.gender === "female") return "Женщина";
  return "Пол не указан";
}

/** Глаз перечёркнут — «Скрыть на холсте» */
function IconEyeOff() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.6 6.3C4.3 4.6 6.6 3.6 9 3.6s4.7 1 6.4 2.7M3.9 12.4C5.1 13.6 6.9 14.4 9 14.4s3.9-.8 5.1-2" />
      <path d="M3 3l12 12" />
    </svg>
  );
}

/** Крестик — «Снять выделение» */
function IconClose() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M5.5 5.5l7 7M12.5 5.5l-7 7" />
    </svg>
  );
}

/**
 * Поколение = глубина от старших предков. Считается по связям «родитель —
 * ребёнок»: у корней I, у их детей II и так далее. Циклы в данных не вешают
 * обход — очередь ограничена счётчиком шагов.
 */
function generationMap(persons: Person[], relationships: Relationship[]) {
  const children = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const rel of relationships) {
    if (rel.kind !== "parent") continue;
    children.set(rel.from_person_id, [...(children.get(rel.from_person_id) ?? []), rel.to_person_id]);
    hasParent.add(rel.to_person_id);
  }

  const gen = new Map<string, number>();
  const queue: string[] = [];
  for (const person of persons) {
    if (!hasParent.has(person.id)) {
      gen.set(person.id, 1);
      queue.push(person.id);
    }
  }
  // если родителей нет ни у кого (или в данных цикл) — начинаем с первого
  if (!queue.length && persons.length) {
    gen.set(persons[0].id, 1);
    queue.push(persons[0].id);
  }

  let steps = 0;
  while (queue.length && steps++ < persons.length * 4) {
    const id = queue.shift()!;
    const depth = gen.get(id) ?? 1;
    for (const child of children.get(id) ?? []) {
      if ((gen.get(child) ?? 0) >= depth + 1) continue;
      gen.set(child, depth + 1);
      queue.push(child);
    }
  }
  for (const person of persons) if (!gen.has(person.id)) gen.set(person.id, 1);
  return gen;
}

/** Родня человека: родители, супруги, дети, внуки */
function kinOf(id: string, relationships: Relationship[]) {
  const parents: string[] = [];
  const spouses: string[] = [];
  const children: string[] = [];
  for (const rel of relationships) {
    if (rel.kind === "spouse") {
      if (rel.from_person_id === id) spouses.push(rel.to_person_id);
      else if (rel.to_person_id === id) spouses.push(rel.from_person_id);
    } else {
      if (rel.to_person_id === id) parents.push(rel.from_person_id);
      else if (rel.from_person_id === id) children.push(rel.to_person_id);
    }
  }
  const grandkids: string[] = [];
  for (const childId of children) {
    for (const rel of relationships) {
      if (rel.kind === "parent" && rel.from_person_id === childId) grandkids.push(rel.to_person_id);
    }
  }
  return {
    parents,
    spouses,
    children,
    grandkids: [...new Set(grandkids)].filter((g) => g !== id),
  };
}

/** Небольшой портрет для строк «Семьи»: фото, иначе силуэт по полу */
function Face({
  person,
  photoUrl,
  size = 22,
}: {
  person: Person;
  photoUrl: string | null;
  size?: number;
}) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  if (person.gender !== "unknown") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={person.gender === "male" ? "/avatars/male.png" : "/avatars/female.png"}
        alt=""
        className="shrink-0 rounded-full"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full bg-[var(--p-row-bg)] text-[10px] text-ink-500"
      style={{ width: size, height: size }}
    >
      {initials(person)}
    </span>
  );
}

/** Строка «подпись — значение»: факты и данные человека */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-t border-[var(--p-line-2)] py-2 first:border-t-0 first:pt-0">
      <span className="w-[74px] shrink-0 text-[12.5px] leading-5 text-ink-400">{label}</span>
      <span className="min-w-0 flex-1 text-[13px] leading-5 text-ink-700">{children}</span>
    </div>
  );
}

/** Кликабельная родня: клик переводит выделение на этого человека */
function KinChip({
  person,
  photoUrl,
  onSelect,
}: {
  person: Person;
  photoUrl: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(person.id)}
      title={`Выбрать на холсте: ${shortName(person)}`}
      className="inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--p-line)] bg-[var(--p-field-bg)] py-1 pl-1 pr-2.5 text-left text-[12.5px] text-ink-700 transition-colors hover:border-[var(--p-acc-line)] hover:bg-[var(--p-acc-bg)] hover:text-brass-ink"
    >
      <Face person={person} photoUrl={photoUrl} size={22} />
      <span className="min-w-0 truncate">{shortName(person)}</span>
      {lifespan(person) && (
        <span className="shrink-0 text-[11.5px] text-ink-400">{lifespan(person)}</span>
      )}
    </button>
  );
}

function KinRow({
  label,
  people,
  photoUrlFor,
  onSelect,
}: {
  label: string;
  people: Person[];
  photoUrlFor: (person: Person) => string | null;
  onSelect: (id: string) => void;
}) {
  if (!people.length) return null;
  return (
    <div className="flex flex-col gap-2 py-2 first:pt-0">
      <span className="text-[11.5px] uppercase tracking-[0.08em] text-ink-400">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {people.map((person) => (
          <KinChip
            key={person.id}
            person={person}
            photoUrl={photoUrlFor(person)}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Инспектор выделенного человека. На десктопе — панель 320px справа, на
 * телефоне — нижний лист с ручкой (как в студийном прототипе). Данные только
 * читает: выделение, вкладки и меню — состояние интерфейса.
 */
export function Inspector({
  persons,
  relationships,
  selectedIds,
  changes,
  canEdit,
  photoUrlFor,
  branchable,
  onSelect,
  onOpenCard,
  onEditCard,
  onBranch,
  onAddRelative,
  onHide,
  onClear,
}: Props) {
  const [tab, setTab] = useState<TabId>("facts");
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  // меню добавления родственника: переехало с карточки холста в панель деталей
  const [addMenu, setAddMenu] = useState<{ x: number; y: number } | null>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);

  const singleId = selectedIds.length === 1 ? selectedIds[0] : null;

  // при переходе к другому человеку возвращаемся к «Фактам»
  useEffect(() => {
    setTab("facts");
  }, [singleId]);

  const byId = useMemo(() => new Map(persons.map((person) => [person.id, person])), [persons]);
  const generations = useMemo(() => generationMap(persons, relationships), [persons, relationships]);
  const kin = useMemo(
    () => (singleId ? kinOf(singleId, relationships) : null),
    [singleId, relationships]
  );
  const personChanges = useMemo(
    () => (changes ?? []).filter((change) => change.personId === singleId),
    [changes, singleId]
  );

  const people = (ids: string[]) =>
    ids.map((id) => byId.get(id)).filter((p): p is Person => !!p);

  function openMore() {
    const rect = moreRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMenu({ x: Math.round(rect.right - 196), y: Math.round(rect.bottom + 8) });
  }

  function openAddMenu() {
    const rect = addRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAddMenu({ x: Math.round(rect.left), y: Math.round(rect.bottom + 8) });
  }

  // ---- никто не выбран: панели нет вовсе ----
  // В прототипе на десктопе висела заглушка «Выберите человека на холсте»,
  // но владелец просил её убрать: пустая панель закрывает холст и на телефоне,
  // и на компьютере. Панель появляется только при выбранных людях.
  if (!selectedIds.length) return null;

  const selected = people(selectedIds);
  const person = singleId ? byId.get(singleId) : undefined;

  // ---- мультивыделение: список людей и что с ними можно сделать ----
  if (!person) {
    return (
      <aside
        aria-label="Инспектор выделенного человека"
        className={INSPECTOR_SURFACE}
      >
        <span
          aria-hidden="true"
          className="mx-auto h-1 w-10 shrink-0 rounded-full bg-[var(--p-line-3)] sm:hidden"
        />
        <div className="flex items-center justify-between">
          <h3 className="text-[13px] uppercase tracking-[0.08em] text-ink-400">
            Выделено человек
          </h3>
          <span className="studio-chip tabular-nums">{selectedIds.length}</span>
        </div>
        <p className="font-display text-[17px] text-ink-800">
          {selected.map((p) => p.first_name || shortName(p)).join(", ")}
        </p>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            {selected.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p.id)}
                className="flex items-center gap-2 rounded-xl border border-[var(--p-line)] bg-[var(--p-field-bg)] px-2 py-1.5 text-left text-[13px] text-ink-700 transition-colors hover:border-[var(--p-acc-line)] hover:bg-[var(--p-acc-bg)] hover:text-brass-ink"
              >
                <Face person={p} photoUrl={photoUrlFor(p)} size={24} />
                <span className="min-w-0 flex-1 truncate">{shortName(p)}</span>
                <span className="shrink-0 text-[11.5px] text-ink-400">{lifespan(p) ?? "—"}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 hidden text-[12px] leading-relaxed text-ink-400 sm:block">
            Массовых правок нет: «Показать ветвь», «Скрыть на холсте» и «Снять выделение» — кнопки
            в пилюле над доком.
          </p>
        </div>

        {/* Массовые действия на телефоне: нижний лист перекрывает пилюлю над
            доком, поэтому те же три кнопки живут прямо здесь — как в прототипе,
            где на узком экране пилюля скрыта. */}
        <div className="grid shrink-0 gap-2 sm:hidden">
          <button
            type="button"
            onClick={() => onBranch(selectedIds[0])}
            disabled={!branchable.has(selectedIds[0])}
            title={
              branchable.has(selectedIds[0])
                ? "Показать ветвь первого выбранного"
                : "У первого выбранного нет супругов и детей"
            }
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] border border-[var(--p-line)] bg-[var(--p-field-bg)] px-3 text-[13px] text-ink-600 transition-colors hover:bg-[var(--p-hover-bg)] hover:text-ink-800 disabled:pointer-events-none disabled:opacity-45"
          >
            <IconBranch />
            Показать ветвь
          </button>
          <button
            type="button"
            onClick={() => onHide(selectedIds)}
            title="Скрыть на холсте — только отображение"
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] border border-[var(--p-line)] bg-[var(--p-field-bg)] px-3 text-[13px] text-ink-600 transition-colors hover:bg-[var(--p-hover-bg)] hover:text-ink-800"
          >
            <IconEyeOff />
            Скрыть на холсте
          </button>
          <button
            type="button"
            onClick={onClear}
            title="Снять выделение"
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] border border-[var(--p-line)] bg-[var(--p-field-bg)] px-3 text-[13px] text-ink-600 transition-colors hover:bg-[var(--p-hover-bg)] hover:text-ink-800"
          >
            <IconClose />
            Снять выделение
          </button>
        </div>
      </aside>
    );
  }

  const generation = generations.get(person.id) ?? 1;

  // Добавление родственников: меню переехало сюда с карточки холста, набор тот же.
  // Занятый родительский слот не предлагаем повторно, брата и сестру — только
  // когда у человека уже есть родители: родство считается по общим родителям.
  const parentGenders = relationships
    .filter((rel) => rel.kind === "parent" && rel.to_person_id === person.id)
    .map((rel) => byId.get(rel.from_person_id)?.gender ?? "unknown");
  const hasFather = parentGenders.includes("male");
  const hasMother = parentGenders.includes("female");
  const hasParents = hasFather || hasMother;
  const siblingHint = hasParents ? undefined : "Сначала укажите родителей";
  // супруга называем по полу того, от кого добавляем
  const spouseLabel =
    person.gender === "male" ? "Супруга" : person.gender === "female" ? "Супруг" : "Супруг(а)";
  const addOptions: {
    relation: NewRelative;
    label: string;
    hint?: string;
    disabled?: boolean;
    /** для «Сын»/«Дочь» — пол новой карточки, иначе пункты неразличимы */
    gender?: "male" | "female";
  }[] = [
    { relation: "father", label: "Отец", disabled: hasFather, hint: hasFather ? "Отец уже указан" : undefined },
    { relation: "mother", label: "Мать", disabled: hasMother, hint: hasMother ? "Мать уже указана" : undefined },
    { relation: "spouse", label: spouseLabel },
    // сын и дочь — одна связь «ребёнок»: пол уезжает на форму новой карточки
    { relation: "child", label: "Сын", gender: "male" },
    { relation: "child", label: "Дочь", gender: "female" },
    { relation: "brother", label: "Брат", disabled: !hasParents, hint: siblingHint },
    { relation: "sister", label: "Сестра", disabled: !hasParents, hint: siblingHint },
  ];
  const facts = [
    birthLabel(person) || person.birth_place
      ? {
          label: "Рождение",
          value: [birthLabel(person), person.birth_place].filter(Boolean).join(" · "),
        }
      : null,
    !person.is_living && (deathLabel(person) || person.death_place)
      ? {
          label: "Смерть",
          value: [deathLabel(person), person.death_place].filter(Boolean).join(" · "),
        }
      : null,
    kin && kin.spouses.length
      ? {
          label: "Брак",
          value: people(kin.spouses)
            .map((s) => `${shortName(s)}${lifespan(s) ? ` (${lifespan(s)})` : ""}`)
            .join(", "),
        }
      : null,
    people(kin?.parents ?? []).some((p) => p.gender === "male")
      ? {
          label: "Отец",
          value: people((kin?.parents ?? []).filter((id) => byId.get(id)?.gender === "male"))
            .map((p) => `${shortName(p)}${lifespan(p) ? ` (${lifespan(p)})` : ""}`)
            .join(", "),
        }
      : null,
    people(kin?.parents ?? []).some((p) => p.gender === "female")
      ? {
          label: "Мать",
          value: people((kin?.parents ?? []).filter((id) => byId.get(id)?.gender === "female"))
            .map((p) => `${shortName(p)}${lifespan(p) ? ` (${lifespan(p)})` : ""}`)
            .join(", "),
        }
      : null,
  ].filter((row): row is { label: string; value: string } => !!row && !!row.value);

  const age = ageYears(person);
  const eventsCount = facts.length + personChanges.length;

  return (
    <aside
      aria-label="Инспектор выделенного человека"
      className={INSPECTOR_SURFACE}
    >
      <span
        aria-hidden="true"
        className="mx-auto h-1 w-10 shrink-0 rounded-full bg-[var(--p-line-3)] sm:hidden"
      />

      {/* Шапка: портрет, имя, годы, место и поколение, чипы */}
      <div className="flex shrink-0 items-start gap-3">
        <Face person={person} photoUrl={photoUrlFor(person)} size={52} />
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[17px] leading-tight text-ink-800">{shortName(person)}</h3>
          <span className="mt-0.5 block text-[12.5px] text-ink-500">
            {lifespan(person) ?? "Годы неизвестны"}
            {age != null && (
              <span className="text-ink-400">
                {" "}
                · {age} {yearsWord(age)}
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-ink-400">
            {person.birth_place ?? person.residence ?? "Место не указано"} · {roman(generation)}{" "}
            поколение
          </span>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="studio-chip">{genderLabel(person)}</span>
            <span className="studio-chip">Поколение {roman(generation)}</span>
            <span
              className="studio-chip"
              style={{
                borderColor: "var(--p-acc-line)",
                background: "var(--p-acc-bg)",
                color: "var(--p-brass-ink)",
              }}
            >
              Выбран
            </span>
            <span className="studio-chip tabular-nums">
              {eventsCount} {plural(eventsCount, "событие", "события", "событий")}
            </span>
          </div>
        </div>
      </div>

      {/* Действия: карточка, правка и «…» */}
      <div className="flex shrink-0 flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onOpenCard(person.id)}
          className="btn-accent h-9 flex-1 text-[13px]"
        >
          Открыть карточку
        </button>
        {canEdit && (
          <button
            type="button"
            onClick={() => onEditCard(person.id)}
            className="inline-flex h-9 items-center rounded-[10px] border border-[var(--p-line)] bg-[var(--p-field-bg)] px-3 text-[13px] text-ink-600 transition-colors hover:bg-[var(--p-hover-bg)] hover:text-ink-800"
          >
            Правка
          </button>
        )}
        <button
          ref={moreRef}
          type="button"
          onClick={openMore}
          aria-label="Ещё действия"
          aria-haspopup="menu"
          aria-expanded={!!menu}
          title="Ещё действия"
          className="icon-btn h-9 w-9"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
            <circle cx="4" cy="9" r="1.5" />
            <circle cx="9" cy="9" r="1.5" />
            <circle cx="14" cy="9" r="1.5" />
          </svg>
        </button>

        {menu && (
          <NodeMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)}>
            <MenuItem
              label="Открыть карточку"
              onClick={() => {
                setMenu(null);
                onOpenCard(person.id);
              }}
            />
            <MenuItem
              label="Выбрать на холсте"
              onClick={() => {
                setMenu(null);
                onSelect(person.id);
              }}
            />
            <MenuItem
              label="Скрыть на холсте"
              onClick={() => {
                setMenu(null);
                onHide([person.id]);
              }}
            />
            <MenuItem
              label="Снять выделение"
              onClick={() => {
                setMenu(null);
                onClear();
              }}
            />
          </NodeMenu>
        )}
      </div>

      {/* Семья и родня: раньше это были кнопки на карточке холста, теперь они
          живут здесь — в панели деталей, которая открывается по клику. */}
      <div className="flex shrink-0 flex-col gap-2">
        {canEdit && (
          <button
            ref={addRef}
            type="button"
            onClick={openAddMenu}
            aria-haspopup="menu"
            aria-expanded={!!addMenu}
            title="Добавить родственника"
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] border border-[var(--p-line)] bg-[var(--p-field-bg)] px-3 text-[13px] text-ink-600 transition-colors hover:bg-[var(--p-hover-bg)] hover:text-ink-800"
          >
            <IconPlus />
            Добавить родственника
          </button>
        )}
        <button
          type="button"
          onClick={() => onBranch(person.id)}
          disabled={!branchable.has(person.id)}
          title={
            branchable.has(person.id)
              ? "Открыть семейную ветку"
              : "Нет супругов и детей — ветки не будет"
          }
          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] border border-[var(--p-line)] bg-[var(--p-field-bg)] px-3 text-[13px] text-ink-600 transition-colors hover:bg-[var(--p-hover-bg)] hover:text-ink-800 disabled:pointer-events-none disabled:opacity-45"
        >
          <IconBranch />
          Открыть семейную ветку
        </button>

        {addMenu && (
          <NodeMenu x={addMenu.x} y={addMenu.y} onClose={() => setAddMenu(null)}>
            {addOptions.map((option) => (
              <MenuItem
                key={option.label}
                label={option.label}
                hint={option.hint}
                disabled={option.disabled}
                onClick={() => {
                  setAddMenu(null);
                  onAddRelative(person.id, option.relation, option.gender);
                }}
              />
            ))}
          </NodeMenu>
        )}
      </div>

      {/* Вкладки разделов */}
      <div
        role="tablist"
        aria-label="Разделы инспектора"
        className="flex shrink-0 gap-0.5 border-b border-[var(--p-line)]"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-[13px] transition-colors ${
              tab === item.id
                ? "border-brass-500 text-ink-800"
                : "border-transparent text-ink-400 hover:text-ink-700"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Содержимое раздела */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-0.5">
        {tab === "facts" && (
          <div>
            {facts.length ? (
              facts.map((row) => (
                <Row key={row.label} label={row.label}>
                  {row.value}
                </Row>
              ))
            ) : (
              <p className="px-1 py-2 text-[12.5px] text-ink-400">
                Дат и мест пока нет — их можно добавить в карточке человека.
              </p>
            )}
          </div>
        )}

        {tab === "family" && (
          <div className="flex flex-col divide-y divide-[var(--p-line-2)]">
            <KinRow
              label={person.gender === "male" ? "Супруга" : person.gender === "female" ? "Супруг" : "Супруг(а)"}
              people={people(kin?.spouses ?? [])}
              photoUrlFor={photoUrlFor}
              onSelect={onSelect}
            />
            <KinRow
              label="Родители"
              people={people(kin?.parents ?? [])}
              photoUrlFor={photoUrlFor}
              onSelect={onSelect}
            />
            <KinRow
              label="Дети"
              people={people(kin?.children ?? [])}
              photoUrlFor={photoUrlFor}
              onSelect={onSelect}
            />
            <KinRow
              label="Внуки"
              people={people(kin?.grandkids ?? [])}
              photoUrlFor={photoUrlFor}
              onSelect={onSelect}
            />
            {!(kin?.spouses.length || kin?.parents.length || kin?.children.length || kin?.grandkids.length) && (
              <p className="px-1 py-2 text-[12.5px] text-ink-400">
                Связей пока нет — их добавляют кнопкой «Добавить родственника» выше.
              </p>
            )}
          </div>
        )}

        {tab === "history" && (
          <div className="flex flex-col gap-2">
            {changes === null ? (
              <p className="px-1 py-2 text-[12.5px] text-ink-400">
                История правок этого древа недоступна.
              </p>
            ) : personChanges.length ? (
              personChanges.slice(0, 12).map((change) => (
                <div
                  key={change.id}
                  className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-0.5 rounded-xl border border-[var(--p-line)] bg-[var(--p-row-bg)] px-2.5 py-2"
                >
                  <span className="min-w-0 truncate text-[12.5px] text-ink-700">{change.author}</span>
                  <span className="shrink-0 text-[11.5px] tabular-nums text-ink-400">{change.at}</span>
                  <span className="col-span-2 text-[12px] leading-relaxed text-ink-500">
                    {change.summary}
                  </span>
                </div>
              ))
            ) : (
              <p className="px-1 py-2 text-[12.5px] text-ink-400">
                Карточку ещё не правили — здесь появятся последние изменения.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Подвал: подсказка о холсте, как в прототипе */}
      <div className="hidden shrink-0 border-t border-[var(--p-line-2)] pt-2.5 sm:block">
        <p className="text-[11.5px] text-ink-400">
          {(kin?.children.length ?? 0) > 0 && `Дети: ${kin!.children.length} · `}
          {(kin?.parents.length ?? 0) > 0 && `Родители: ${kin!.parents.length} · `}
          Shift + клик — к нескольким, ⌘K — все команды.
        </p>
      </div>
    </aside>
  );
}
