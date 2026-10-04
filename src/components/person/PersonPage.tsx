"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea, Select } from "@/components/ui/field";
import { PersonHistory, type ChangeRow } from "./PersonHistory";
import { createClient } from "@/lib/supabase/client";
import {
  publicUrl,
  shortName,
  fullName,
  initials,
  ROLE_LABEL,
  lifespan,
  ageYears,
  yearsWord,
  birthLabel,
  deathLabel,
  formatDateTime,
} from "@/lib/format";
import {
  createPerson,
  updatePerson,
  deletePerson,
  setPhoto,
  createRelationship,
  deleteRelationship,
  addAttachment,
  deleteAttachment,
} from "@/app/actions/persons";
import type { Gender, MemberRole, Person, Relationship, Attachment, RelationKind } from "@/lib/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

/** Кем приходится новый человек тому, от чьей карточки его добавляют. */
export type NewRelation = "child" | "spouse" | "father" | "mother" | "brother" | "sister";

type Props = {
  treeId: string;
  treeTitle: string;
  role: MemberRole;
  /** null — создание новой карточки */
  person: Person | null;
  persons: Person[];
  relationships: Relationship[];
  attachments: Attachment[];
  /** размеры файлов архива в байтах по id вложения: считает серверная страница */
  attachmentSizes: Record<string, number>;
  hasDeathPlace: boolean;
  relation: { relateTo: string; kind: NewRelation } | null;
  /** в древе достигнут предел числа людей — новую карточку добавить нельзя */
  limitReached: boolean;
  /** история изменений карточки (null, если таблицы ещё нет) */
  changes: ChangeRow[] | null;
};

/* ---------------------------------------------------------------------
   Разделы карточки: как в прототипе — «Факты · Документы · История».
   Третья вкладка прототипа — «События», но данных о событиях человека
   в приложении нет, поэтому вместо неё — «Документы» (архив карточки).
   --------------------------------------------------------------------- */

type TabId = "facts" | "docs" | "history";

const TAB_ORDER: TabId[] = ["facts", "docs", "history"];
const TAB_LABEL: Record<TabId, string> = {
  facts: "Факты",
  docs: "Документы",
  history: "История",
};

/* ---------------------------------------------------------------------
   Утилиты
   --------------------------------------------------------------------- */

/** «III» — поколение подписано так же, как на холсте и в списке людей. */
function roman(n: number) {
  return ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][n] ?? String(n);
}

/** «1 связь», «3 связи», «12 связей» */
function linksWord(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "связь";
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return "связи";
  return "связей";
}

/** «1,2 МБ» — размер файла архива, если Storage его отдал. */
function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} МБ`;
}

function genderLabel(gender: Gender) {
  return gender === "male" ? "мужской" : gender === "female" ? "женский" : "не указан";
}

/**
 * Поколение = глубина от старших предков: у корней I, у их детей II и так
 * далее. Тот же расчёт, что на холсте и на странице «Люди»: ничего нового
 * не считаем — только связи, которые уже есть в древе.
 */
function generations(persons: Person[], relationships: Relationship[]) {
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

/* ---------------------------------------------------------------------
   Иконки студии (инлайн SVG, без спрайтов)
   --------------------------------------------------------------------- */

function IconImage() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <rect x="3" y="4" width="14" height="12" rx="2" />
      <circle cx="7.5" cy="8.3" r="1.4" />
      <path d="M4.2 14.4l3.9-3.9 3.1 3.1 2.6-2.6 2.9 2.9" />
    </svg>
  );
}

function IconDoc() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M5.5 3.5h6l3.5 3.5v9.5h-9.5z" />
      <path d="M11.5 3.5V7H15" />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg viewBox="0 0 20 20" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="6" width="14" height="10" rx="2" />
      <circle cx="10" cy="11" r="2.6" />
    </svg>
  );
}

/* ---------------------------------------------------------------------
   Кирпичики оформления
   --------------------------------------------------------------------- */

/** Тонкий подзаголовок смыслового блока внутри формы. */
function SubSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3.5 mt-5 flex items-center gap-3">
      <span className="h-px flex-1 bg-line" />
      <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-ink-400">
        {children}
      </span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/** Блок карточки: непрозрачная поверхность студии (.panel) вместо самодельной рамки. */
function Panel({
  title,
  hint,
  children,
  className = "",
}: {
  title?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel p-4 sm:p-5 ${className}`}>
      {title && (
        <div className="mb-3.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="font-display text-[16px] text-ink-800">{title}</h2>
          {hint && <span className="text-[12px] text-ink-400">{hint}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * Пилюля-подпись студии. У .studio-chip фиксированная высота и nowrap, поэтому
 * длинные места переносим строками: высота по содержимому, но не меньше 26px.
 */
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="studio-chip max-w-full"
      style={{ height: "auto", minHeight: "26px", whiteSpace: "normal", padding: "3px 10px" }}
    >
      {children}
    </span>
  );
}

/** Инициалы в рамке по полу — для родни и состава ветки. */
function Avatar({ person, small = false }: { person: Person; small?: boolean }) {
  const tone =
    person.gender === "male"
      ? "border-male/50 bg-male-tint"
      : person.gender === "female"
        ? "border-female/50 bg-female-tint"
        : "border-line bg-mist-50";
  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center border font-medium text-ink-600 ${tone} ${
        small
          ? "h-6 w-6 rounded-full text-[10px]"
          : "h-8 w-8 rounded-[10px] text-[11px]"
      }`}
    >
      {initials(person)}
    </span>
  );
}

/** Строка определений «подпись — значение», как .dl в прототипе. */
function FactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-x-3 gap-y-0.5 border-t border-line-2 py-2 text-[13px] first:border-t-0 sm:grid-cols-[120px_minmax(0,1fr)]">
      <dt className="text-[12.5px] leading-snug text-ink-400">{label}</dt>
      <dd className="min-w-0 break-words leading-snug text-ink-800">{children}</dd>
    </div>
  );
}

/* ---------------------------------------------------------------------
   Карточка человека
   --------------------------------------------------------------------- */

export function PersonPage({
  treeId,
  treeTitle,
  role,
  person,
  persons,
  relationships,
  attachments,
  attachmentSizes,
  hasDeathPlace,
  relation,
  limitReached,
  changes,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const canEdit = role === "owner" || role === "editor";
  const isNew = !person;

  // Пол из ссылки холста: «Сын» и «Дочь» — одна связь «ребёнок», различает их
  // только этот параметр. Подставляем его лишь в новую карточку; у существующей
  // пол уже записан в базе. Если параметра нет — всё как раньше, «не указан».
  const urlGender = searchParams.get("gender");
  const paramGender: Gender | null =
    urlGender === "male" || urlGender === "female" ? urlGender : null;

  const [tab, setTab] = useState<TabId>("facts");
  // существующая карточка открывается «фактами», новая — сразу формой
  const [editing, setEditing] = useState(isNew);
  const [linkOpen, setLinkOpen] = useState(false);
  const [gender, setGender] = useState<Gender>(
    person ? person.gender : (paramGender ?? "unknown")
  );
  const [isLiving, setIsLiving] = useState(person ? person.is_living : true);
  const [firstName, setFirstName] = useState(person?.first_name ?? "");
  const [lastName, setLastName] = useState(person?.last_name ?? "");
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // всплывающее меню фотографии: открывается с портрета — кнопок «фото» в карточке нет
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const photoWrapRef = useRef<HTMLDivElement>(null);
  const photoBtnRef = useRef<HTMLButtonElement>(null);
  const photoMenuRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});

  // Меню фото: Esc и клик мимо закрывают его, фокус возвращается на портрет.
  useEffect(() => {
    if (!photoMenuOpen) return;
    photoMenuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    function onPointerDown(event: PointerEvent) {
      if (!photoWrapRef.current?.contains(event.target as Node)) setPhotoMenuOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setPhotoMenuOpen(false);
      photoBtnRef.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [photoMenuOpen]);

  const photoUrl = person ? publicUrl(SUPABASE_URL, "photos", person.photo_path) : null;
  // у новой карточки ещё нет id, по которому класть файл в Storage — портрет неактивен
  const photoAvailable = canEdit && !!person;
  const byId = new Map(persons.map((p) => [p.id, p]));

  const generationMap = useMemo(() => generations(persons, relationships), [persons, relationships]);
  const generation = person ? generationMap.get(person.id) ?? 1 : null;

  const anchor = relation ? persons.find((p) => p.id === relation.relateTo) : undefined;
  const relationLabel = relation
    ? relation.kind === "child"
      ? "ребёнок"
      : relation.kind === "father"
        ? "отец"
        : relation.kind === "mother"
          ? "мать"
          : relation.kind === "brother"
            ? "брат"
            : relation.kind === "sister"
              ? "сестра"
              : anchor?.gender === "male"
            ? "супруга"
            : anchor?.gender === "female"
              ? "супруг"
              : "супруг(а)"
    : null;

  const kinGroups = person ? buildKin(person) : [];
  const linksCount = kinGroups.reduce((sum, group) => sum + group.rows.length, 0);

  // Имя в шапке: при правке ФИО обновляется прямо во время набора
  const typedName = [firstName, lastName].filter(Boolean).join(" ");
  const heroName = isNew
    ? typedName || "Новая карточка"
    : typedName
      ? `${typedName}${person!.maiden_name ? ` (${person!.maiden_name})` : ""}`
      : shortName(person!);
  const heroInitials =
    [firstName?.[0], lastName?.[0]].filter(Boolean).join("").toUpperCase() ||
    (person ? initials(person) : "?");

  const life = person ? lifespan(person) : null;
  const age = person ? ageYears(person) : null;
  const yearsLine = person
    ? [life, age !== null ? `${age} ${yearsWord(age)}` : null].filter(Boolean).join(" · ") ||
      "Годы неизвестны"
    : relationLabel && anchor
      ? `${relationLabel} · ${shortName(anchor)}`
      : null;

  // Место и поколение — как вторая строка прототипа: «Ленинград · III поколение · 2 связи»
  const placeLine = person
    ? [
        person.birth_place ?? person.residence,
        generation ? `${roman(generation)} поколение` : null,
        linksCount ? `${linksCount} ${linksWord(linksCount)}` : null,
      ]
        .filter(Boolean)
        .join(" · ") || null
    : null;

  // Пилюли-подписи: пол, поколение и роль. Только то, что уже есть в карточке.
  const heroChips: { key: string; text: string }[] = [];
  if (person) {
    if (person.gender !== "unknown") {
      heroChips.push({ key: "gender", text: person.gender === "male" ? "Мужской пол" : "Женский пол" });
    }
    if (generation) heroChips.push({ key: "gen", text: `Поколение ${roman(generation)}` });
    if (!canEdit) heroChips.push({ key: "role", text: `Доступ: ${ROLE_LABEL[role]}` });
  } else if (relationLabel && anchor) {
    heroChips.push({ key: "rel", text: `${relationLabel} · ${shortName(anchor)}` });
  }

  function back() {
    router.push(`/tree/${treeId}`);
  }

  /** «Отмена» в правке: возвращаем введённое к состоянию карточки и закрываем форму. */
  function cancelEdit() {
    if (isNew) {
      back();
      return;
    }
    setEditing(false);
    setConfirmDelete(false);
    setGender(person?.gender ?? "unknown");
    setIsLiving(person ? person.is_living : true);
    setFirstName(person?.first_name ?? "");
    setLastName(person?.last_name ?? "");
  }

  function startEdit() {
    setTab("facts");
    setEditing(true);
  }

  /** Связь для новой карточки: из параметров, с которыми пришли с холста. */
  function applyRelation(fd: FormData) {
    if (!relation) return;
    fd.set("relate_to", relation.relateTo);
    if (relation.kind === "brother" || relation.kind === "sister") {
      // отдельного вида связи «брат/сестра» в базе нет: родство считается по
      // общим родителям, поэтому сервер скопирует родительские связи родственника
      fd.set("relate_kind", "sibling");
      fd.set("gender", relation.kind === "brother" ? "male" : "female");
      return;
    }
    if (relation.kind === "spouse") {
      fd.set("relate_kind", "spouse");
      const chosen = String(fd.get("gender") ?? "unknown");
      if (chosen === "unknown") {
        if (anchor?.gender === "male") fd.set("gender", "female");
        else if (anchor?.gender === "female") fd.set("gender", "male");
      }
      return;
    }
    fd.set("relate_kind", "parent");
    fd.set("relate_direction", relation.kind === "child" ? "child_of" : "parent_of");
    if (relation.kind === "father") fd.set("gender", "male");
    if (relation.kind === "mother") fd.set("gender", "female");
  }

  function submit(fd: FormData) {
    if (!canEdit) return;
    startTransition(async () => {
      try {
        if (person) {
          await updatePerson(treeId, person.id, fd);
          toast.success("Карточка сохранена");
        } else {
          applyRelation(fd);
          await createPerson(treeId, fd);
          toast.success("Карточка добавлена в древо");
        }
        back();
      } catch {
        toast.error("Не удалось сохранить карточку");
      }
    });
  }

  function remove() {
    if (!person) return;
    startTransition(async () => {
      await deletePerson(treeId, person.id);
      toast.success("Карточка удалена");
      back();
    });
  }

  async function uploadPhoto(file: File) {
    if (!person) return;
    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${treeId}/${person.id}/portrait-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("photos").upload(path, file, { upsert: true });
    setUploading(false);
    if (error) return toast.error("Не удалось загрузить фотографию");
    startTransition(async () => {
      await setPhoto(treeId, person.id, path);
      router.refresh();
      toast.success("Фотография обновлена");
    });
  }

  /** «Убрать фото»: как и раньше — обнуляем ссылку в карточке и обновляем страницу. */
  function removePhoto() {
    if (!person) return;
    startTransition(async () => {
      await setPhoto(treeId, person.id, null);
      router.refresh();
    });
  }

  /** Стрелки вверх/вниз — по пунктам меню фото (обычное поведение role="menu"). */
  function onPhotoMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const items = Array.from(
      photoMenuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not([disabled])') ?? []
    );
    if (items.length < 2) return;
    event.preventDefault();
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "ArrowDown"
        ? (index + 1) % items.length
        : (index - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  async function uploadArchive(file: File) {
    if (!person) return;
    setUploading(true);
    const supabase = createClient();
    const path = `${treeId}/${person.id}/${Date.now()}-${file.name}`;
    const kind = file.type.startsWith("image/") ? "photo" : "document";
    const { error } = await supabase.storage.from("archive").upload(path, file);
    setUploading(false);
    if (error) return toast.error("Не удалось загрузить файл");
    startTransition(async () => {
      await addAttachment(treeId, person.id, path, kind, file.name);
      router.refresh();
      toast.success("Файл добавлен в архив");
    });
  }

  function addLink(fd: FormData) {
    if (!person) return;
    const otherId = String(fd.get("other_id") ?? "");
    const type = String(fd.get("link_type") ?? "");
    if (!otherId || !type) return;

    startTransition(async () => {
      let kind: RelationKind = "parent";
      let from = person.id;
      let to = otherId;
      if (type === "parent_of") { kind = "parent"; from = person.id; to = otherId; }
      if (type === "child_of") { kind = "parent"; from = otherId; to = person.id; }
      if (type === "spouse") { kind = "spouse"; from = person.id; to = otherId; }

      const res = await createRelationship(treeId, kind, from, to);
      if (res.error) toast.error(res.error);
      else {
        router.refresh();
        toast.success("Связь добавлена");
      }
    });
  }

  /** Родня человека, сгруппированная по строкам, как в блоке «Семья» прототипа. */
  function buildKin(main: Person): KinGroup[] {
    const groups: KinGroup[] = [];
    const nameOf = (id: string) => {
      const p = byId.get(id);
      return p ? shortName(p) : "Удалённая карточка";
    };
    const genderOf = (id: string) => byId.get(id)?.gender ?? "unknown";
    const row = (p: Person | undefined, label: string, edgeId?: string, hint?: string): KinRow => ({
      key: `${label}-${p?.id ?? edgeId ?? "?"}`,
      label,
      name: p ? shortName(p) : "Удалённая карточка",
      years: p ? lifespan(p) : null,
      person: p,
      edgeId,
      hint,
    });
    const parentsOf = (childId: string) =>
      new Set(
        relationships.filter((r) => r.kind === "parent" && r.to_person_id === childId).map((r) => r.from_person_id)
      );
    // старшие — выше; без даты — в конце
    const birthKey = (p: Person) =>
      p.birth_date ? `d${p.birth_date}` : p.birth_year ? `y${String(p.birth_year).padStart(4, "0")}` : "z";

    // 1. супруг(а)
    const spouses: KinRow[] = [];
    for (const r of relationships) {
      if (r.kind !== "spouse") continue;
      if (r.from_person_id !== main.id && r.to_person_id !== main.id) continue;
      const other = r.from_person_id === main.id ? r.to_person_id : r.from_person_id;
      spouses.push(row(byId.get(other), "Супруг(а)", r.id));
    }
    if (spouses.length) {
      groups.push({
        key: "spouse",
        label:
          main.gender === "male" ? "Супруга" : main.gender === "female" ? "Супруг" : "Супруг(а)",
        rows: spouses,
      });
    }

    // 2. родители: отец, затем мать
    const parents = relationships
      .filter((r) => r.kind === "parent" && r.to_person_id === main.id)
      .map((r) => {
        const g = genderOf(r.from_person_id);
        return {
          rank: g === "male" ? 0 : g === "female" ? 1 : 2,
          label: g === "male" ? "Отец" : g === "female" ? "Мать" : "Родитель",
          row: row(byId.get(r.from_person_id), g === "male" ? "Отец" : g === "female" ? "Мать" : "Родитель", r.id),
        };
      })
      .sort((a, b) => a.rank - b.rank);
    if (parents.length) groups.push({ key: "parents", label: "Родители", rows: parents.map((p) => p.row) });

    // 3. братья и сёстры — по общим родителям, по старшинству
    const myParents = parentsOf(main.id);
    if (myParents.size) {
      const siblings = persons
        .filter((p) => p.id !== main.id)
        .map((p) => ({ p, theirs: parentsOf(p.id) }))
        .filter(({ theirs }) => theirs.size > 0 && [...theirs].some((id) => myParents.has(id)))
        .map(({ p, theirs }) => {
          const shared = [...theirs].filter((id) => myParents.has(id));
          const full = shared.length === myParents.size && theirs.size === myParents.size;
          return {
            p,
            row: row(
              p,
              full ? "Брат или сестра" : "Сводный брат или сестра",
              undefined,
              full ? undefined : `Общий родитель: ${shared.map(nameOf).join(", ")}`
            ),
          };
        })
        .sort((a, b) => (birthKey(a.p) < birthKey(b.p) ? -1 : 1));
      if (siblings.length) {
        groups.push({ key: "siblings", label: "Братья и сёстры", rows: siblings.map((s) => s.row) });
      }
    }

    // 4. дети — по старшинству
    const children = relationships
      .filter((r) => r.kind === "parent" && r.from_person_id === main.id)
      .map((r) => ({
        child: byId.get(r.to_person_id),
        row: row(byId.get(r.to_person_id), "Ребёнок", r.id),
      }))
      .sort((a, b) => {
        const ka = a.child ? birthKey(a.child) : "z";
        const kb = b.child ? birthKey(b.child) : "z";
        return ka < kb ? -1 : 1;
      });
    if (children.length) groups.push({ key: "children", label: "Дети", rows: children.map((c) => c.row) });

    return groups;
  }

  const faceTone =
    gender === "male"
      ? "border-male bg-male-tint"
      : gender === "female"
        ? "border-female bg-female-tint"
        : "border-line bg-mist-50";

  const faceSize =
    "grid h-[92px] w-[92px] shrink-0 place-items-center overflow-hidden rounded-[20px] border sm:h-[112px] sm:w-[112px]";

  /** Содержимое портрета: фото, заглушка по полу или инициалы — как было. */
  const portraitFace = (
    <>
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt="" className="h-full w-full object-cover" />
      ) : !isNew && gender !== "unknown" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={gender === "male" ? "/avatars/male.png" : "/avatars/female.png"}
          alt=""
          className="h-16 w-16 opacity-90 sm:h-20 sm:w-20"
        />
      ) : (
        <span className="font-display text-[26px] text-ink-400 sm:text-[32px]">{heroInitials}</span>
      )}
    </>
  );

  /** Пункт всплывающего меню фотографии. */
  const photoMenuItemClass =
    "flex w-full items-center gap-2 rounded-[9px] px-2.5 py-1.5 text-left text-[13px] text-ink-700 transition-colors hover:bg-[var(--p-hover-bg)] hover:text-ink-800 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brass-500 disabled:opacity-50";

  /* -------------------------------------------------------------------
     Строки «Фактов»: только поля карточки, ничего не выдумываем
     ------------------------------------------------------------------- */
  const factRows: { key: string; label: string; value: React.ReactNode }[] = [];
  if (person) {
    if (person.gender !== "unknown") {
      factRows.push({ key: "gender", label: "Пол", value: genderLabel(person.gender) });
    }
    factRows.push({ key: "name", label: "ФИО", value: fullName(person) });
    if (person.maiden_name) {
      factRows.push({ key: "maiden", label: "Девичья фамилия", value: person.maiden_name });
    }
    if (person.other_names) {
      factRows.push({ key: "other", label: "Другие имена", value: person.other_names });
    }
    const born = [birthLabel(person), person.birth_place].filter(Boolean).join(" · ");
    if (born) factRows.push({ key: "birth", label: "Рождение", value: born });
    const died = [deathLabel(person), person.death_place].filter(Boolean).join(" · ");
    if (!person.is_living && died) factRows.push({ key: "death", label: "Смерть", value: died });
    if (age !== null) {
      factRows.push({ key: "age", label: "Возраст", value: `${age} ${yearsWord(age)}` });
    }
    factRows.push({ key: "living", label: "Жив ли", value: person.is_living ? "да" : "нет" });
    if (person.residence) {
      factRows.push({ key: "residence", label: "Проживание", value: person.residence });
    }
    if (person.bio) {
      factRows.push({
        key: "bio",
        label: "Биография",
        value: <span className="whitespace-pre-line">{person.bio}</span>,
      });
    }
  }
  const factsFilled = factRows.some((r) =>
    ["birth", "death", "age", "residence", "bio"].includes(r.key)
  );

  function onTabKeyDown(event: React.KeyboardEvent) {
    const index = TAB_ORDER.indexOf(tab);
    let next: TabId | null = null;
    if (event.key === "ArrowRight") next = TAB_ORDER[(index + 1) % TAB_ORDER.length];
    if (event.key === "ArrowLeft") next = TAB_ORDER[(index + TAB_ORDER.length - 1) % TAB_ORDER.length];
    if (event.key === "Home") next = TAB_ORDER[0];
    if (event.key === "End") next = TAB_ORDER[TAB_ORDER.length - 1];
    if (!next) return;
    event.preventDefault();
    setTab(next);
    tabRefs.current[next]?.focus();
  }

  const tabCount: Record<TabId, number | null> = {
    facts: null,
    docs: attachments.length || null,
    history: changes?.length || null,
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-5 sm:py-8">
      <form id="person-form" action={submit} className="space-y-4">
        {/* ---------------- герой карточки ---------------- */}
        {/* без overflow-hidden: всплывающее меню фото не должно обрезаться панелью */}
        <section className="panel">
          <div className="p-4 sm:p-6">
            <nav className="flex flex-wrap items-center gap-1.5 text-[13px] text-ink-400">
              <Link href="/dashboard" className="transition-colors hover:text-ink-700">
                Все древа
              </Link>
              <span aria-hidden="true" className="text-mist-300">/</span>
              <Link href={`/tree/${treeId}`} className="break-words transition-colors hover:text-ink-700">
                {treeTitle}
              </Link>
              <span aria-hidden="true" className="text-mist-300">/</span>
              <span>{isNew ? "Новый человек" : "Карточка"}</span>
            </nav>

            <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
              <div ref={photoWrapRef} className="relative shrink-0 self-start">
                {photoAvailable ? (
                  <button
                    ref={photoBtnRef}
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={photoMenuOpen}
                    aria-label={
                      photoUrl
                        ? "Фотография: заменить или убрать"
                        : "Фотография: добавить"
                    }
                    onClick={() => setPhotoMenuOpen((open) => !open)}
                    className={`group relative cursor-pointer ${faceSize} ${faceTone}`}
                  >
                    {portraitFace}
                    {/* иконка фотоаппарата — по наведению и по фокусу с клавиатуры */}
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 grid place-items-center bg-[rgba(15,23,42,0.42)] opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
                    >
                      <span className="icon-btn">
                        <IconCamera />
                      </span>
                    </span>
                  </button>
                ) : (
                  <div className={`${faceSize} ${faceTone}`}>{portraitFace}</div>
                )}

                {photoMenuOpen && person && (
                  <div
                    ref={photoMenuRef}
                    role="menu"
                    aria-label="Действия с фотографией"
                    onKeyDown={onPhotoMenuKeyDown}
                    // поверх текста карточки меню должно быть непрозрачным: у .glass фон
                    // полупрозрачный, сквозь него читались бы заголовок и кнопки под меню
                    style={{ background: "var(--color-surface)" }}
                    className="glass absolute left-0 top-[calc(100%+8px)] z-30 flex w-[196px] flex-col gap-0.5 p-1.5"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      disabled={uploading}
                      className={photoMenuItemClass}
                      onClick={() => {
                        setPhotoMenuOpen(false);
                        photoInput.current?.click();
                      }}
                    >
                      <IconCamera />
                      {uploading ? "Загружаем…" : photoUrl ? "Заменить фото" : "Добавить фото"}
                    </button>
                    {photoUrl && (
                      <button
                        type="button"
                        role="menuitem"
                        disabled={pending}
                        className={`${photoMenuItemClass} text-danger hover:bg-danger-soft hover:text-danger`}
                        onClick={() => {
                          setPhotoMenuOpen(false);
                          removePhoto();
                        }}
                      >
                        Убрать фото
                      </button>
                    )}
                  </div>
                )}

                <input
                  ref={photoInput}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) uploadPhoto(file);
                  }}
                />
              </div>

              <div className="min-w-0 flex-1">
                <h1 className="break-words font-display text-[26px] leading-[1.12] text-ink-800 sm:text-[32px]">
                  {heroName}
                </h1>

                {yearsLine && (
                  <p className="mt-1.5 font-mono text-[12.5px] tabular-nums text-brass-600">
                    {yearsLine}
                  </p>
                )}
                {placeLine && <p className="mt-0.5 break-words text-[12.5px] text-ink-400">{placeLine}</p>}

                {heroChips.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {heroChips.map((c) => (
                      <Chip key={c.key}>{c.text}</Chip>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* действия героя: правка, ветка, удаление (удаление — только в правке) */}
          <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3 sm:px-6">
            {canEdit && (isNew || editing) && (
              <>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={pending || limitReached}
                  title={limitReached ? "В древе достигнут предел числа людей" : undefined}
                >
                  {pending ? "Сохраняем…" : isNew ? "Добавить в древо" : "Сохранить"}
                </Button>
                <Button type="button" variant="secondary" size="sm" onClick={cancelEdit} disabled={pending}>
                  Отмена
                </Button>
              </>
            )}
            {canEdit && !isNew && !editing && (
              <Button type="button" variant="primary" size="sm" onClick={startEdit} disabled={pending}>
                Редактировать
              </Button>
            )}

            {person && (
              <Link
                href={`/tree/${treeId}/branch/${person.id}`}
                className="inline-flex h-8 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border border-[var(--p-line)] bg-surface px-3 text-[13px] font-medium text-ink-700 shadow-[var(--p-inset-hi)] transition-colors hover:border-[var(--p-line-3)] hover:bg-[var(--p-hover-bg)]"
              >
                Семейная ветка
              </Link>
            )}

            {person && canEdit && editing && (
              <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
                {confirmDelete ? (
                  <>
                    <span className="text-[13px] text-ink-500">Удалить карточку и все её связи?</span>
                    <Button type="button" variant="danger" size="sm" onClick={remove} disabled={pending}>
                      Да, удалить
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setConfirmDelete(false)}
                      disabled={pending}
                    >
                      Не удалять
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => setConfirmDelete(true)}
                    disabled={pending}
                  >
                    Удалить карточку
                  </Button>
                )}
              </div>
            )}
          </div>
        </section>

        {!canEdit && (
          <p className="rounded-[16px] border border-line bg-[var(--p-row-bg)] px-4 py-3 text-sm text-ink-500">
            У вас роль зрителя — карточку можно только смотреть.
          </p>
        )}

        {limitReached && (
          <p className="rounded-[16px] border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger-ink">
            В этом древе достигнут предел числа людей, установленный администратором платформы.
            Новую карточку добавить нельзя — попросите поднять предел в панели администратора.
          </p>
        )}

        {/* ---------------- правка: те же поля, что были ---------------- */}
        {editing ? (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_316px]">
            <div className="space-y-4">
              <Panel title="Факты" hint="Пол, имена, даты и места">
                {hasDeathPlace && <input type="hidden" name="has_death_place" value="1" />}
                <fieldset disabled={!canEdit} className="min-w-0">
                  {/* Пол */}
                  <div className="block">
                    <span className="mb-1.5 block text-[13px] font-medium text-ink-600">Пол</span>
                    <div className="flex flex-wrap gap-2.5">
                      {(["male", "female"] as const).map((g) => (
                        <button
                          key={g}
                          type="button"
                          disabled={!canEdit}
                          onClick={() => setGender(gender === g ? "unknown" : g)}
                          className={`inline-flex items-center gap-2.5 rounded-[10px] border px-3.5 py-2 text-sm transition-colors ${
                            gender === g
                              ? "border-[var(--p-acc-line)] bg-acc text-ink-800"
                              : "border-line bg-field text-ink-600 hover:border-line-3"
                          } disabled:opacity-60`}
                        >
                          <span
                            aria-hidden="true"
                            className={`grid h-4 w-4 place-items-center rounded-[4px] border text-[11px] leading-none ${
                              gender === g ? "border-brass-500 bg-brass-500 text-surface" : "border-line-3"
                            }`}
                          >
                            {gender === g ? "✓" : ""}
                          </span>
                          {g === "male" ? "Мужской" : "Женский"}
                        </button>
                      ))}
                    </div>
                    <span className="mt-1 block text-xs text-ink-400">
                      {gender === "female"
                        ? "От пола зависит, показывать ли девичью фамилию"
                        : "При выборе «женский» появится поле девичьей фамилии"}
                    </span>
                    <input type="hidden" name="gender" value={gender} />
                  </div>

                  {/* ФИО */}
                  <SubSection>ФИО</SubSection>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Фамилия">
                      <Input
                        name="last_name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Петрова"
                      />
                    </Field>
                    <Field label="Имя">
                      <Input
                        name="first_name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="Анна"
                      />
                    </Field>
                    <Field label="Отчество">
                      <Input name="middle_name" defaultValue={person?.middle_name ?? ""} placeholder="Сергеевна" />
                    </Field>
                    {gender === "female" && (
                      <Field label="Девичья фамилия" hint="Показывается только у женщин">
                        <Input name="maiden_name" defaultValue={person?.maiden_name ?? ""} placeholder="Кузнецова" />
                      </Field>
                    )}
                    <div className="sm:col-span-2">
                      <Field label="Другие имена" hint="Прозвище, имя при крещении, иное написание в документах">
                        <Input name="other_names" defaultValue={person?.other_names ?? ""} />
                      </Field>
                    </div>
                  </div>

                  {/* Рождение и смерть */}
                  <SubSection>Рождение</SubSection>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Дата рождения">
                      <Input name="birth_date" type="date" defaultValue={person?.birth_date ?? ""} />
                    </Field>
                    <Field label="Год рождения" hint="Если известен только год">
                      <Input
                        name="birth_year"
                        type="number"
                        inputMode="numeric"
                        min={1000}
                        max={2100}
                        defaultValue={person?.birth_year ?? ""}
                        placeholder="1905"
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Место рождения">
                        <Input name="birth_place" defaultValue={person?.birth_place ?? ""} placeholder="г. Тверь" />
                      </Field>
                    </div>

                    <label className="flex items-center gap-2.5 rounded-[10px] border border-line bg-field px-3 py-2.5 sm:col-span-2">
                      <input
                        type="checkbox"
                        name="is_living"
                        defaultChecked={isLiving}
                        onChange={(e) => setIsLiving(e.target.checked)}
                        className="h-4 w-4 accent-brass-500"
                      />
                      <span className="text-sm text-ink-700">Человек жив</span>
                    </label>

                    {!isLiving ? (
                      <>
                        <Field label="Дата смерти">
                          <Input name="death_date" type="date" defaultValue={person?.death_date ?? ""} />
                        </Field>
                        <Field label="Год смерти" hint="Если известен только год">
                          <Input
                            name="death_year"
                            type="number"
                            inputMode="numeric"
                            min={1000}
                            max={2100}
                            defaultValue={person?.death_year ?? ""}
                            placeholder="1988"
                          />
                        </Field>
                        {hasDeathPlace && (
                          <div className="sm:col-span-2">
                            <Field label="Место смерти">
                              <Input name="death_place" defaultValue={person?.death_place ?? ""} placeholder="г. Москва" />
                            </Field>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="rounded-[10px] border border-dashed border-line-3 bg-mist-50 px-3 py-2.5 text-[13px] text-ink-400 sm:col-span-2">
                        Здесь появятся дата и место смерти, если снять галочку «Человек жив»
                      </div>
                    )}
                  </div>

                  {/* Проживание */}
                  <SubSection>Проживание</SubSection>
                  <Field label="Место проживания" hint="Показывается на карточке в древе">
                    <Input name="residence" defaultValue={person?.residence ?? ""} placeholder="г. Москва" />
                  </Field>
                </fieldset>
              </Panel>

              <Panel title="Биография" hint="Заметки о человеке">
                <fieldset disabled={!canEdit}>
                  <Textarea
                    name="bio"
                    rows={5}
                    defaultValue={person?.bio ?? ""}
                    placeholder="Всё, что рассказывали в семье"
                  />
                </fieldset>
              </Panel>
            </div>

            <aside className="space-y-4">
              <Panel title="Семья" hint={!isNew && linksCount ? "Нажмите, чтобы перейти" : undefined}>
                {isNew ? (
                  relation && anchor ? (
                    <>
                      <div className="flex items-center gap-2.5 rounded-[12px] border border-line bg-field p-2">
                        <Avatar person={anchor} />
                        <span className="min-w-0">
                          <span className="block text-[12px] text-ink-400">{relationLabel}</span>
                          <span className="block break-words text-[13px] text-ink-800">{shortName(anchor)}</span>
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-ink-400">
                        Связь создастся автоматически вместе с карточкой
                      </p>
                    </>
                  ) : (
                    <p className="text-[13px] text-ink-400">Связи можно добавить после сохранения карточки</p>
                  )
                ) : (
                  <KinBlock
                    groups={kinGroups}
                    treeId={treeId}
                    canEdit={canEdit}
                    pending={pending}
                    linkOpen={linkOpen}
                    onToggleLink={() => setLinkOpen((v) => !v)}
                    onBreak={(edgeId, label, name) =>
                      startTransition(async () => {
                        await deleteRelationship(treeId, edgeId);
                        router.refresh();
                        toast.success("Связь удалена");
                      })
                    }
                    onAdd={(fd) => addLink(fd)}
                    person={person!}
                    persons={persons}
                  />
                )}
              </Panel>

              {isNew && (
                <Panel title="Документы">
                  <p className="text-[13px] text-ink-400">
                    Файлы можно добавить после сохранения карточки
                  </p>
                </Panel>
              )}
            </aside>
          </div>
        ) : (
          /* ---------------- просмотр: вкладки «Факты · Документы · История» ---------------- */
          <section className="panel overflow-hidden">
            <div
              role="tablist"
              aria-label="Разделы карточки"
              onKeyDown={onTabKeyDown}
              className="flex gap-0.5 overflow-x-auto border-b border-line px-2 sm:px-3"
            >
              {TAB_ORDER.map((id) => {
                const active = tab === id;
                const count = tabCount[id];
                return (
                  <button
                    key={id}
                    ref={(node) => {
                      tabRefs.current[id] = node;
                    }}
                    id={`person-tab-${id}`}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    aria-controls={`person-panel-${id}`}
                    tabIndex={active ? 0 : -1}
                    onClick={() => setTab(id)}
                    className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-[13px] transition-colors ${
                      active
                        ? "border-brass-500 text-ink-800"
                        : "border-transparent text-ink-500 hover:text-ink-800"
                    }`}
                  >
                    {TAB_LABEL[id]}
                    {count ? (
                      <span className="ml-1.5 font-mono text-[11px] text-ink-400">{count}</span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div
              id={`person-panel-${tab}`}
              role="tabpanel"
              aria-labelledby={`person-tab-${tab}`}
              tabIndex={0}
              className="p-4 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brass-500 sm:p-5"
            >
              {tab === "facts" && person && (
                <>
                  <dl className="m-0">
                    {factRows.map((row) => (
                      <FactRow key={row.key} label={row.label}>
                        {row.value}
                      </FactRow>
                    ))}
                  </dl>

                  {!factsFilled && canEdit && (
                    <p className="mt-3 text-[12.5px] text-ink-400">
                      Даты, места и биография появятся здесь после заполнения — нажмите «Редактировать».
                    </p>
                  )}

                  <div className="mb-2 mt-5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-400">
                      Семья
                    </h3>
                    {linksCount > 0 && (
                      <span className="text-[12px] text-ink-400">нажмите, чтобы перейти</span>
                    )}
                  </div>

                  {linksCount === 0 && (
                    <p className="text-[13px] text-ink-400">
                      Связей пока нет — добавьте родителя, ребёнка или супруга
                    </p>
                  )}

                  <KinBlock
                    groups={kinGroups}
                    treeId={treeId}
                    canEdit={canEdit}
                    pending={pending}
                    linkOpen={linkOpen}
                    onToggleLink={() => setLinkOpen((v) => !v)}
                    onBreak={(edgeId) =>
                      startTransition(async () => {
                        await deleteRelationship(treeId, edgeId);
                        router.refresh();
                        toast.success("Связь удалена");
                      })
                    }
                    onAdd={(fd) => addLink(fd)}
                    person={person}
                    persons={persons}
                  />
                </>
              )}

              {tab === "docs" && (
                <>
                  {attachments.length === 0 ? (
                    <p className="text-[13px] text-ink-400">
                      Сканы документов и дополнительные снимки. Файлов пока нет.
                    </p>
                  ) : (
                    <ul className="grid list-none gap-2 p-0 sm:grid-cols-2">
                      {attachments.map((a) => {
                        const size = attachmentSizes[a.id];
                        const meta = [
                          size ? formatBytes(size) : null,
                          a.kind === "photo" ? "Изображение" : "Документ",
                          formatDateTime(a.created_at),
                        ]
                          .filter(Boolean)
                          .join(" · ");
                        return (
                          <li
                            key={a.id}
                            className="flex items-start gap-2.5 rounded-[14px] border border-line bg-row p-2.5"
                          >
                            <span
                              aria-hidden="true"
                              className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] border border-line bg-field text-ink-400"
                            >
                              {a.kind === "photo" ? <IconImage /> : <IconDoc />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <a
                                href={publicUrl(SUPABASE_URL, "archive", a.storage_path) ?? "#"}
                                target="_blank"
                                rel="noreferrer"
                                className="block break-words text-[13px] leading-snug text-ink-800 transition-colors hover:text-brass-600"
                              >
                                {a.caption ?? "Файл"}
                              </a>
                              <span className="mt-0.5 block break-words text-[11.5px] leading-snug text-ink-400">
                                {meta}
                              </span>
                            </span>
                            {canEdit && (
                              <button
                                type="button"
                                aria-label={`Удалить файл: ${a.caption ?? "Файл"}`}
                                title="Удалить файл"
                                disabled={pending}
                                className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] border border-line bg-field text-[12px] text-ink-400 transition-colors hover:border-danger-line hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                                onClick={() =>
                                  startTransition(async () => {
                                    await deleteAttachment(treeId, a.id, a.storage_path);
                                    router.refresh();
                                  })
                                }
                              >
                                ✕
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {canEdit && (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                      <input
                        ref={fileInput}
                        type="file"
                        hidden
                        accept="image/*,.pdf,.doc,.docx"
                        onChange={(e) => e.target.files?.[0] && uploadArchive(e.target.files[0])}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={uploading || pending}
                        onClick={() => fileInput.current?.click()}
                      >
                        {uploading ? "Загружаем…" : "Добавить файл"}
                      </Button>
                    </div>
                  )}
                </>
              )}

              {tab === "history" && (
                <>
                  {changes === null ? (
                    <p className="text-[13px] leading-relaxed text-ink-400">
                      История появится после выполнения{" "}
                      <code className="font-mono">supabase/person-history.sql</code> в Supabase.
                    </p>
                  ) : changes.length === 0 ? (
                    <p className="text-[13px] text-ink-400">Правок пока не было.</p>
                  ) : (
                    <PersonHistory
                      treeId={treeId}
                      personId={person!.id}
                      canEdit={canEdit}
                      changes={changes}
                    />
                  )}
                </>
              )}
            </div>
          </section>
        )}
      </form>

      {/* служебная форма для добавления связи — вне основной, чтобы не мешать сохранению */}
      {!isNew && person && (
        <form
          id="link-form"
          className="hidden"
          onSubmit={(e) => {
            e.preventDefault();
            addLink(new FormData(e.currentTarget));
          }}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------
   Блок «Семья»: строки родни с аватарами-инициалами и пилюлями-переходами
   --------------------------------------------------------------------- */

type KinRow = {
  key: string;
  label: string;
  name: string;
  years: string | null;
  person?: Person;
  /** id связи — по нему разрываем родство */
  edgeId?: string;
  hint?: string;
};

type KinGroup = { key: string; label: string; rows: KinRow[] };

function KinBlock({
  groups,
  treeId,
  canEdit,
  pending,
  linkOpen,
  onToggleLink,
  onBreak,
  onAdd,
  person,
  persons,
}: {
  groups: KinGroup[];
  treeId: string;
  canEdit: boolean;
  pending: boolean;
  linkOpen: boolean;
  onToggleLink: () => void;
  onBreak: (edgeId: string, label: string, name: string) => void;
  onAdd: (fd: FormData) => void;
  person: Person;
  persons: Person[];
}) {
  return (
    <>
      {groups.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {groups.map((group) => (
            <div
              key={group.key}
              className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 rounded-[12px] border border-line bg-row px-3 py-2"
            >
              <span className="shrink-0 text-[12px] text-ink-400">{group.label}</span>
              {group.rows.map((row) => (
                <span key={row.key} className="inline-flex min-w-0 max-w-full items-center gap-1">
                  {row.person ? (
                    <Link
                      href={`/tree/${treeId}/person/${row.person.id}`}
                      title={row.hint}
                      className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-x-1.5 gap-y-0 rounded-full border border-line bg-field py-0.5 pl-1 pr-2.5 text-[12.5px] text-ink-700 transition-colors hover:border-[var(--p-acc-line)] hover:bg-acc hover:text-brass-ink"
                    >
                      <Avatar person={row.person} small />
                      <span className="min-w-0 break-words">{shortName(row.person)}</span>
                      {row.years && (
                        <span className="shrink-0 font-mono text-[11px] text-ink-400">{row.years}</span>
                      )}
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-line-3 bg-field py-0.5 pl-1 pr-2.5 text-[12.5px] text-ink-400">
                      <span
                        aria-hidden="true"
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line bg-mist-50 text-[10px]"
                      >
                        —
                      </span>
                      {row.name}
                    </span>
                  )}
                  {canEdit && row.edgeId && (
                    <button
                      type="button"
                      aria-label={`Разорвать связь: ${row.label} — ${row.name}`}
                      title="Разорвать связь"
                      disabled={pending}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line bg-field text-[11px] leading-none text-ink-400 transition-colors hover:border-danger-line hover:bg-danger-soft hover:text-danger disabled:opacity-50"
                      onClick={() => onBreak(row.edgeId!, row.label, row.name)}
                    >
                      ✕
                    </button>
                  )}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <div className="mt-3 border-t border-line pt-3">
          <button
            type="button"
            aria-expanded={linkOpen}
            onClick={onToggleLink}
            className="inline-flex items-center gap-2 rounded-[10px] border border-line bg-field px-3 py-1.5 text-[12.5px] text-ink-600 transition-colors hover:border-line-3 hover:text-ink-800"
          >
            <span aria-hidden="true" className="text-[14px] leading-none">+</span>
            Добавить связь
          </button>

          {linkOpen && (
            <div className="mt-2.5 space-y-2.5">
              <Select name="link_type" defaultValue="child_of" form="link-form">
                <option value="child_of">{shortName(person)} — ребёнок выбранного</option>
                <option value="parent_of">{shortName(person)} — родитель выбранного</option>
                <option value="spouse">Супруги</option>
              </Select>
              <Select name="other_id" defaultValue="" form="link-form" required>
                <option value="" disabled>
                  Выберите из древа
                </option>
                {persons
                  .filter((p) => p.id !== person.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {shortName(p)}
                      {p.birth_year ? ` · ${p.birth_year}` : ""}
                    </option>
                  ))}
              </Select>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() => {
                  const form = document.getElementById("link-form") as HTMLFormElement | null;
                  if (form) onAdd(new FormData(form));
                }}
              >
                Добавить связь
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
