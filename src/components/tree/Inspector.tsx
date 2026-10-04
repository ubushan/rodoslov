"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NodeMenu, MenuItem } from "./NodeMenu";
import { MenuButton, type MenuOption } from "./DockMenu";
import {
  IconBranch,
  IconMore,
  IconPersonPlus,
  PERSON_DETAILS_SURFACE,
  PersonDetailsFace,
  PersonDetailsFacts,
  PersonDetailsPortrait,
} from "@/components/person/PersonDetailsFace";
import {
  ageYears,
  birthLabel,
  deathLabel,
  initials,
  lifespan,
  shortName,
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
  /** «Редактирование» из меню «…» — та же карточка, но сразу у формы правки */
  onEditCard: (id: string) => void;
  /** «Открыть семейную ветку» — отдельная страница ветки человека */
  onBranch: (id: string) => void;
  /** добавление родственника: отец, мать, супруг(а), сын, дочь, брат, сестра.
      Пол передаём для «Сын»/«Дочь» — иначе оба пункта ведут к одной связи. */
  onAddRelative: (id: string, relation: NewRelative, gender?: "male" | "female") => void;
  /** «Связь» между двумя выбранными: тип выбирается в меню кнопки */
  onRelate: (kind: "parent" | "spouse") => void;
  /** скрытие с холста: только отображение, данные не меняются */
  onHide: (ids: string[]) => void;
  onClear: () => void;
  /**
   * Реальная геометрия нижнего листа на телефоне: верхняя кромка и высота
   * относительно холста. Холст поднимает над листом выбранную карточку, а
   * высота листа зависит от содержимого, поэтому её нельзя посчитать заранее.
   * На десктопе панель справа — приходит null.
   */
  onSheetMetrics?: (metrics: { top: number; height: number } | null) => void;
};

/**
 * Поверхность инспектора (нижний лист на телефоне, панель справа на десктопе)
 * и внешность самой панели деталей живут в PersonDetailsFace: там же описано,
 * почему высота листа именно такая. Здесь остаётся мультивыделение — у него своя
 * разметка (список людей и массовые действия), но поверхность та же.
 */
const TABS = [
  { id: "facts", label: "Факты" },
  { id: "family", label: "Семья" },
  { id: "history", label: "История" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
function roman(n: number) {
  return ROMAN[n] ?? String(n);
}

/** Подпись пола для чипа в шапке панели деталей */
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

/** Два человека и связь между ними — «Связь» в мультивыделении */
function IconRelation() {
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
      <circle cx="4.6" cy="9" r="2.1" />
      <circle cx="13.4" cy="9" r="2.1" />
      <path d="M6.7 9h4.6" />
    </svg>
  );
}

/**
 * Пункты меню «Связь»: сначала тип связи, потом серверное действие
 * createRelationship (его зовёт onRelate с выбранным типом). Если выбрано не
 * ровно двое, пункты выключены и объясняют, чего не хватает. Одна и та же
 * функция питает пилюлю над доком (TreeCanvas) и нижний лист (Inspector).
 */
export function relationOptions(
  enough: boolean,
  onRelate: (kind: "parent" | "spouse") => void
): MenuOption[] {
  const hint = enough ? undefined : "Выберите ровно двух человек";
  return [
    {
      id: "parent",
      label: "Родитель — ребёнок",
      hint: enough ? "Родителем станет человек из более старшего поколения" : hint,
      disabled: !enough,
      onSelect: () => onRelate("parent"),
    },
    {
      id: "spouse",
      label: "Супруги",
      hint: enough ? "Связать двух выбранных как пару" : hint,
      disabled: !enough,
      onSelect: () => onRelate("spouse"),
    },
  ];
}

/**
 * Поколение = глубина от старших предков. Считается по связям «родитель —
 * ребёнок»: у корней I, у их детей II и так далее. Циклы в данных не вешают
 * обход — очередь ограничена счётчиком шагов.
 *
 * Функция экспортируется: тем же счётом холст выбирает, кто из двух выбранных
 * становится родителем в действии «Связь» (см. TreeCanvas).
 */
export function generationMap(persons: Person[], relationships: Relationship[]) {
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
      <PersonDetailsPortrait
        photoUrl={photoUrl}
        gender={person.gender}
        initials={initials(person)}
        size={22}
      />
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
  onRelate,
  onHide,
  onClear,
  onSheetMetrics,
}: Props) {
  const [tab, setTab] = useState<TabId>("facts");
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  // меню добавления родственника: переехало с карточки холста в панель деталей
  const [addMenu, setAddMenu] = useState<{ x: number; y: number } | null>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  // сам нижний лист: по нему холст узнаёт, над чем выравнивать карточку
  const sheetRef = useRef<HTMLElement>(null);

  const singleId = selectedIds.length === 1 ? selectedIds[0] : null;

  // при переходе к другому человеку возвращаемся к «Фактам»
  useEffect(() => {
    setTab("facts");
  }, [singleId]);

  /**
   * Отдаём наверх верхнюю кромку и высоту листа. Меряем сам элемент, а не
   * проценты: высота зависит от содержимого (сколько строк фактов, какая
   * вкладка). ResizeObserver сообщает и о смене содержимого, и о повороте
   * экрана. Эффект перезапускается при смене выделения, поэтому к моменту
   * выравнивания наверху лежит уже свежая геометрия нового человека.
   */
  const reportSheet = useCallback(() => {
    if (!onSheetMetrics) return;
    const el = sheetRef.current;
    // на десктопе панель справа на всю высоту — холсту она не мешает
    if (!el || !window.matchMedia("(max-width: 639px)").matches) {
      onSheetMetrics(null);
      return;
    }
    onSheetMetrics({ top: el.offsetTop, height: el.offsetHeight });
  }, [onSheetMetrics]);

  useEffect(() => {
    reportSheet();
    const el = sheetRef.current;
    if (!el || !onSheetMetrics) return;
    const observer = new ResizeObserver(reportSheet);
    observer.observe(el);
    window.addEventListener("resize", reportSheet);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", reportSheet);
    };
  }, [reportSheet, onSheetMetrics, selectedIds.length, singleId]);

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
    // кнопка стоит в правом краю панели — меню выравниваем по её правому краю
    setAddMenu({ x: Math.round(rect.right - 196), y: Math.round(rect.bottom + 8) });
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
        ref={sheetRef}
        aria-label="Инспектор выделенного человека"
        className={PERSON_DETAILS_SURFACE}
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
        <div className="flex-1 sm:min-h-0 sm:overflow-x-hidden sm:overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            {selected.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p.id)}
                className="flex items-center gap-2 rounded-xl border border-[var(--p-line)] bg-[var(--p-field-bg)] px-2 py-1.5 text-left text-[13px] text-ink-700 transition-colors hover:border-[var(--p-acc-line)] hover:bg-[var(--p-acc-bg)] hover:text-brass-ink"
              >
                <PersonDetailsPortrait
                  photoUrl={photoUrlFor(p)}
                  gender={p.gender}
                  initials={initials(p)}
                  size={24}
                />
                <span className="min-w-0 flex-1 truncate">{shortName(p)}</span>
                <span className="shrink-0 text-[11.5px] text-ink-400">{lifespan(p) ?? "—"}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 hidden text-[12px] leading-relaxed text-ink-400 sm:block">
            Массовых правок нет: «Показать ветвь», «Связь» и «Снять выделение» — кнопки
            в пилюле над доком.
          </p>
        </div>

        {/* Массовые действия на телефоне: нижний лист перекрывает пилюлю над
            доком, поэтому те же кнопки живут прямо здесь — как в прототипе,
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
          {/* «Связь»: ровно двое выбранных, тип связи — в меню вверх.
              Создавать связи могут только владелец и редакторы. */}
          {canEdit && (
            <MenuButton
              className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] border border-[var(--p-line)] bg-[var(--p-field-bg)] px-3 text-[13px] text-ink-600 transition-colors hover:bg-[var(--p-hover-bg)] hover:text-ink-800"
              ariaLabel="Связать выбранных"
              title={
                selectedIds.length === 2
                  ? "Создать связь между двумя выбранными"
                  : "Выберите ровно двух человек"
              }
              menuLabel="Тип связи"
              note={
                selectedIds.length === 2
                  ? undefined
                  : `Нужно ровно два человека — сейчас выбрано ${selectedIds.length}`
              }
              options={relationOptions(selectedIds.length === 2, onRelate)}
            >
              <IconRelation />
              Связь
            </MenuButton>
          )}
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

  return (
    /* Внешность панели деталей — в PersonDetailsFace: поверхность, шапка, чипы,
       ряд действий, вкладки и строки фактов. Здесь остаются данные, обработчики
       и вкладки «Семья»/«История», поэтому разметка панели не дублируется. */
    <PersonDetailsFace
      surfaceRef={sheetRef}
      name={shortName(person)}
      years={lifespan(person)}
      age={age}
      place={`${person.birth_place ?? person.residence ?? "Место не указано"} · ${roman(
        generation
      )} поколение`}
      portrait={
        <PersonDetailsPortrait
          photoUrl={photoUrlFor(person)}
          gender={person.gender}
          initials={initials(person)}
          size={52}
        />
      }
      chips={
        <>
          <span className="studio-chip">{genderLabel(person)}</span>
          <span className="studio-chip">Поколение {roman(generation)}</span>
        </>
      }
      actions={
        <>
          {/* Действия: карточка, «Скрыть на холсте» иконкой, «Добавить родственника»
              и меню «…». Отдельной кнопки «Правка» нет — правка открывается пунктом
              «Редактирование» в «…» (для роли без прав кнопок правки нет вовсе).
              Скрытие — только отображение, поэтому доступно всем ролям; из
              мультивыделения его кнопка убрана, механизм живёт здесь. */}
        <button
          type="button"
          onClick={() => onOpenCard(person.id)}
          className="btn-accent h-9 min-w-0 flex-1 text-[13px]"
        >
          Открыть карточку
        </button>
        <button
          type="button"
          onClick={() => onHide([person.id])}
          aria-label="Скрыть на холсте"
          title="Скрыть на холсте — только отображение"
          className="icon-btn h-9 w-9 shrink-0"
        >
          <IconEyeOff />
        </button>
        {canEdit && (
          <button
            ref={addRef}
            type="button"
            onClick={openAddMenu}
            aria-label="Добавить родственника"
            aria-haspopup="menu"
            aria-expanded={!!addMenu}
            title="Добавить родственника"
            className="icon-btn h-9 w-9 shrink-0"
          >
            <IconPersonPlus />
          </button>
        )}
        {canEdit && (
          <button
            ref={moreRef}
            type="button"
            onClick={openMore}
            aria-label="Ещё действия"
            aria-haspopup="menu"
            aria-expanded={!!menu}
            title="Ещё действия"
            className="icon-btn h-9 w-9 shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
              <circle cx="4" cy="9" r="1.5" />
              <circle cx="9" cy="9" r="1.5" />
              <circle cx="14" cy="9" r="1.5" />
            </svg>
          </button>
        )}

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

        {/* «…» — одно действие: форма правки карточки */}
        {menu && (
          <NodeMenu x={menu.x} y={menu.y} onClose={() => setMenu(null)}>
            <MenuItem
              label="Редактирование"
              onClick={() => {
                setMenu(null);
                onEditCard(person.id);
              }}
            />
          </NodeMenu>
        )}
        </>
      }
      branch={
        /* Семья: отдельная страница ветки человека. Добавление родственников —
           иконкой в ряду действий, меню с роднёй — там же. */
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
      }
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
      footer={
        /* Подвал: подсказка о холсте, как в прототипе */
        <div className="hidden shrink-0 border-t border-[var(--p-line-2)] pt-2.5 sm:block">
          <p className="text-[11.5px] text-ink-400">
            {(kin?.children.length ?? 0) > 0 && `Дети: ${kin!.children.length} · `}
            {(kin?.parents.length ?? 0) > 0 && `Родители: ${kin!.parents.length} · `}
            Shift + клик — к нескольким, ⌘K — все команды.
          </p>
        </div>
      }
    >
      {tab === "facts" && <PersonDetailsFacts rows={facts} />}

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
              Связей пока нет — их добавляют иконкой «человек + плюс» в ряду действий выше.
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
    </PersonDetailsFace>
  );
}
