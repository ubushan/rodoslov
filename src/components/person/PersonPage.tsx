"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea, Select } from "@/components/ui/field";
import { PersonHistory, type ChangeRow } from "./PersonHistory";
import { createClient } from "@/lib/supabase/client";
import { publicUrl, shortName, initials, ROLE_LABEL } from "@/lib/format";
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
  hasDeathPlace: boolean;
  relation: { relateTo: string; kind: NewRelation } | null;
  /** в древе достигнут предел числа людей — новую карточку добавить нельзя */
  limitReached: boolean;
  /** история изменений карточки (null, если таблицы ещё нет) */
  changes: ChangeRow[] | null;
};

/** Тонкий подзаголовок смыслового блока внутри формы. */
function SubSection({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3.5 mt-5 flex items-center gap-3">
      <span className="h-px flex-1 bg-mist-200" />
      <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-ink-400">
        {children}
      </span>
      <span className="h-px flex-1 bg-mist-200" />
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-mist-200 bg-surface p-5">
      <h2 className="mb-4 font-display text-[17px] font-medium text-ink-800">{title}</h2>
      {children}
    </section>
  );
}

function Rail({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-mist-200 bg-surface p-4">
      <h2 className="mb-3 font-display text-[15px] font-medium text-ink-800">{title}</h2>
      {children}
    </section>
  );
}

export function PersonPage({
  treeId,
  treeTitle,
  role,
  person,
  persons,
  relationships,
  attachments,
  hasDeathPlace,
  relation,
  limitReached,
  changes,
}: Props) {
  const router = useRouter();
  const canEdit = role === "owner" || role === "editor";
  const isNew = !person;

  const [gender, setGender] = useState<Gender>(person?.gender ?? "unknown");
  const [isLiving, setIsLiving] = useState(person ? person.is_living : true);
  const [firstName, setFirstName] = useState(person?.first_name ?? "");
  const [lastName, setLastName] = useState(person?.last_name ?? "");
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const photoUrl = person ? publicUrl(SUPABASE_URL, "photos", person.photo_path) : null;
  const byId = new Map(persons.map((p) => [p.id, p]));

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

  const linkRows = buildRows();

  const title = person ? shortName(person) : "Новая карточка";
  const chip = person
    ? [
        person.gender === "male" ? "мужской" : person.gender === "female" ? "женский" : null,
        person.birth_year && !person.is_living && person.death_year
          ? `${person.birth_year} — ${person.death_year}`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : relationLabel && anchor
      ? `${relationLabel} · ${shortName(anchor)}`
      : null;

  function back() {
    router.push(`/tree/${treeId}`);
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

  function buildRows() {
    if (!person) return [];
    type Row = { key: string; label: string; name: string; hint?: string; edgeId?: string };
    const rows: Row[] = [];
    const nameOf = (id: string) => {
      const p = byId.get(id);
      return p ? shortName(p) : "Удалённая карточка";
    };
    const genderOf = (id: string) => byId.get(id)?.gender ?? "unknown";
    const parentsOf = (childId: string) =>
      new Set(
        relationships.filter((r) => r.kind === "parent" && r.to_person_id === childId).map((r) => r.from_person_id)
      );
    // старшие — выше; без даты — в конце
    const birthKey = (p: Person) =>
      p.birth_date ? `d${p.birth_date}` : p.birth_year ? `y${String(p.birth_year).padStart(4, "0")}` : "z";

    // 1. родители: отец, затем мать
    const parents = relationships
      .filter((r) => r.kind === "parent" && r.to_person_id === person.id)
      .map((r) => {
        const g = genderOf(r.from_person_id);
        return {
          rank: g === "male" ? 0 : g === "female" ? 1 : 2,
          row: {
            key: `parent-${r.id}`,
            label: g === "male" ? "Отец" : g === "female" ? "Мать" : "Родитель",
            name: nameOf(r.from_person_id),
            edgeId: r.id,
          } as Row,
        };
      })
      .sort((a, b) => a.rank - b.rank);
    rows.push(...parents.map((p) => p.row));

    // 2. братья и сёстры — по общим родителям, по старшинству
    const myParents = parentsOf(person.id);
    if (myParents.size) {
      const siblings = persons
        .filter((p) => p.id !== person.id)
        .map((p) => ({ p, theirs: parentsOf(p.id) }))
        .filter(({ theirs }) => theirs.size > 0 && [...theirs].some((id) => myParents.has(id)))
        .map(({ p, theirs }) => {
          const shared = [...theirs].filter((id) => myParents.has(id));
          const full = shared.length === myParents.size && theirs.size === myParents.size;
          const g = p.gender === "male" ? "male" : p.gender === "female" ? "female" : "unknown";
          return {
            p,
            row: {
              key: `sibling-${p.id}`,
              label: full
                ? { male: "Брат", female: "Сестра", unknown: "Брат или сестра" }[g]
                : { male: "Сводный брат", female: "Сводная сестра", unknown: "Сводный брат или сестра" }[g],
              name: shortName(p),
              hint: full ? undefined : `Общий родитель: ${shared.map(nameOf).join(", ")}`,
            } as Row,
          };
        })
        .sort((a, b) => (birthKey(a.p) < birthKey(b.p) ? -1 : 1));
      rows.push(...siblings.map((s) => s.row));
    }

    // 3. супруг(а)
    for (const r of relationships) {
      if (r.kind !== "spouse") continue;
      if (r.from_person_id !== person.id && r.to_person_id !== person.id) continue;
      const other = r.from_person_id === person.id ? r.to_person_id : r.from_person_id;
      rows.push({
        key: `spouse-${r.id}`,
        label: person.gender === "male" ? "Супруга" : person.gender === "female" ? "Супруг" : "Супруг(а)",
        name: nameOf(other),
        edgeId: r.id,
      });
    }

    // 4. дети — по старшинству
    const children = relationships
      .filter((r) => r.kind === "parent" && r.from_person_id === person.id)
      .map((r) => {
        const child = byId.get(r.to_person_id);
        const g = child?.gender ?? "unknown";
        return {
          child,
          row: {
            key: `child-${r.id}`,
            label: g === "male" ? "Сын" : g === "female" ? "Дочь" : "Ребёнок",
            name: nameOf(r.to_person_id),
            edgeId: r.id,
          } as Row,
        };
      })
      .sort((a, b) => {
        const ka = a.child ? birthKey(a.child) : "z";
        const kb = b.child ? birthKey(b.child) : "z";
        return ka < kb ? -1 : 1;
      });
    rows.push(...children.map((c) => c.row));

    return rows;
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-8">
      {/* Шапка страницы */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[13px] text-ink-400">
            <Link href="/dashboard" className="hover:text-ink-700">Все древа</Link>
            <span className="mx-1.5 text-mist-300">/</span>
            <Link href={`/tree/${treeId}`} className="hover:text-ink-700">{treeTitle}</Link>
            <span className="mx-1.5 text-mist-300">/</span>
            {isNew ? "Новый человек" : "Карточка"}
          </div>
          <h1 className="mt-1 flex flex-wrap items-center gap-2.5 text-[26px] leading-tight text-ink-800">
            {title}
            {chip && (
              <span className="rounded-lg bg-mist-100 px-2 py-0.5 text-xs text-ink-500">{chip}</span>
            )}
            {!canEdit && (
              <span className="rounded-lg bg-mist-100 px-2 py-0.5 text-xs text-ink-500">
                {ROLE_LABEL[role]}
              </span>
            )}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {person && canEdit && !confirmDelete && (
            <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)} disabled={pending}>
              Удалить карточку
            </Button>
          )}
          {person && canEdit && confirmDelete && (
            <>
              <span className="text-[13px] text-ink-500">Удалить карточку и все её связи?</span>
              <Button variant="danger" size="sm" onClick={remove} disabled={pending}>
                Да, удалить
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)} disabled={pending}>
                Не удалять
              </Button>
            </>
          )}
          <Button variant="secondary" size="sm" onClick={back}>
            Отмена
          </Button>
          {canEdit && (
            <Button
              type="submit"
              form="person-form"
              size="sm"
              disabled={pending || limitReached}
              title={limitReached ? "В древе достигнут предел числа людей" : undefined}
            >
              {pending ? "Сохраняем…" : isNew ? "Добавить в древо" : "Сохранить"}
            </Button>
          )}
        </div>
      </div>

      {!canEdit && (
        <p className="mt-4 rounded-xl border border-mist-200 bg-surface px-4 py-3 text-sm text-ink-500">
          У вас роль зрителя — карточку можно только смотреть.
        </p>
      )}

      {limitReached && (
        <p className="mt-4 rounded-xl border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger-ink">
          В этом древе достигнут предел числа людей, установленный администратором платформы.
          Новую карточку добавить нельзя — попросите поднять предел в панели администратора.
        </p>
      )}

      <form
        id="person-form"
        action={submit}
        className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_316px]"
      >
        {/* ---------------- левая колонка ---------------- */}
        <div className="space-y-5">
          <Card title="Основное">
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
                          ? "border-brass-500 bg-mist-50 text-ink-800"
                          : "border-mist-300 bg-surface text-ink-700 hover:border-ink-300"
                      } disabled:opacity-60`}
                    >
                      <span
                        aria-hidden="true"
                        className={`grid h-4 w-4 place-items-center rounded-[4px] border text-[11px] leading-none ${
                          gender === g
                            ? "border-brass-500 bg-brass-500 text-ink-900"
                            : "border-mist-300"
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

                <label className="flex items-center gap-2.5 rounded-[10px] border border-mist-300 bg-surface px-3 py-2.5 sm:col-span-2">
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
                  <div className="rounded-[10px] border border-dashed border-mist-300 bg-mist-50 px-3 py-2.5 text-[13px] text-ink-400 sm:col-span-2">
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
          </Card>

          <Card title="Биография и заметки">
            <fieldset disabled={!canEdit}>
              <Textarea
                name="bio"
                rows={5}
                defaultValue={person?.bio ?? ""}
                placeholder="Всё, что рассказывали в семье"
              />
            </fieldset>
          </Card>
        </div>

        {/* ---------------- правая колонка ---------------- */}
        <aside className="space-y-4">
          <Rail title="Портрет">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="" className="h-40 w-full rounded-xl object-cover" />
            ) : !isNew && person!.gender !== "unknown" ? (
              <div className="grid h-40 w-full place-items-center rounded-xl border border-dashed border-mist-300 bg-mist-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={person!.gender === "male" ? "/avatars/male.png" : "/avatars/female.png"}
                  alt=""
                  className="h-20 w-20 rounded-full opacity-90"
                />
              </div>
            ) : (
              <div className="grid h-40 w-full place-items-center rounded-xl border border-dashed border-mist-300 bg-mist-50 text-[13px] text-ink-400">
                {isNew ? "Портрет пока не загружен" : initials(person!)}
              </div>
            )}
            {canEdit && (
              <div className="mt-3 flex flex-wrap gap-2">
                <input
                  ref={photoInput}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={uploading || isNew}
                  title={isNew ? "Сначала сохраните карточку" : undefined}
                  onClick={() => photoInput.current?.click()}
                >
                  {uploading ? "Загружаем…" : photoUrl ? "Заменить фото" : "Добавить фото"}
                </Button>
                {photoUrl && person && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      startTransition(async () => {
                        await setPhoto(treeId, person.id, null);
                        router.refresh();
                      })
                    }
                  >
                    Убрать
                  </Button>
                )}
              </div>
            )}
          </Rail>

          <Rail title="Архив">
            {isNew ? (
              <p className="text-[13px] text-ink-400">
                Файлы можно добавить после сохранения карточки
              </p>
            ) : (
              <>
                {attachments.length === 0 && (
                  <p className="text-[13px] text-ink-400">Сканы документов и дополнительные снимки</p>
                )}
                <ul className="space-y-1">
                  {attachments.map((a) => (
                    <li key={a.id} className="flex items-center gap-2.5 border-t border-mist-100 py-2 first:border-t-0">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-mist-100 text-[12px] text-ink-400">
                        ▤
                      </span>
                      <a
                        href={publicUrl(SUPABASE_URL, "archive", a.storage_path) ?? "#"}
                        target="_blank"
                        rel="noreferrer"
                        className="min-w-0 flex-1 truncate text-[13px] text-ink-700 hover:text-brass-600"
                      >
                        {a.caption ?? "Файл"}
                      </a>
                      {canEdit && (
                        <button
                          type="button"
                          className="shrink-0 rounded-lg px-2 py-1 text-[12px] text-ink-400 hover:bg-mist-100 hover:text-danger"
                          onClick={() =>
                            startTransition(async () => {
                              await deleteAttachment(treeId, a.id, a.storage_path);
                              router.refresh();
                            })
                          }
                        >
                          Удалить
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                {canEdit && (
                  <div className="mt-3">
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
                      disabled={uploading}
                      onClick={() => fileInput.current?.click()}
                    >
                      {uploading ? "Загружаем…" : "Добавить файл"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </Rail>

          <Rail title="Связи">
            {isNew ? (
              relation && anchor ? (
                <>
                  <div className="flex items-baseline justify-between gap-3 border-t border-mist-100 py-2 first:border-t-0">
                    <span className="text-[13px] text-ink-400">{relationLabel}</span>
                    <span className="text-right text-[13px] text-ink-800">{shortName(anchor)}</span>
                  </div>
                  <p className="mt-2 text-xs text-ink-400">
                    Связь создастся автоматически вместе с карточкой
                  </p>
                </>
              ) : (
                <p className="text-[13px] text-ink-400">
                  Связи можно добавить после сохранения карточки
                </p>
              )
            ) : (
              <>
                {linkRows.length === 0 && (
                  <p className="text-[13px] text-ink-400">
                    Связей пока нет — добавьте родителя, ребёнка или супруга
                  </p>
                )}
                <ul className="space-y-0.5">
                  {linkRows.map((row) => (
                    <li
                      key={row.key}
                      title={row.hint}
                      className="flex items-baseline justify-between gap-3 border-t border-mist-100 py-2 first:border-t-0"
                    >
                      <span className="shrink-0 text-[13px] text-ink-400">{row.label}</span>
                      <span className="min-w-0 flex-1 truncate text-right text-[13px] text-ink-800">
                        {row.name}
                      </span>
                      {canEdit && row.edgeId && (
                        <button
                          type="button"
                          className="shrink-0 rounded-lg px-2 py-0.5 text-[12px] text-ink-400 hover:bg-mist-100 hover:text-danger"
                          onClick={() =>
                            startTransition(async () => {
                              await deleteRelationship(treeId, row.edgeId!);
                              router.refresh();
                              toast.success("Связь удалена");
                            })
                          }
                        >
                          Разорвать
                        </button>
                      )}
                    </li>
                  ))}
                </ul>

                {canEdit && (
                  <div className="mt-3 space-y-3 border-t border-mist-100 pt-3">
                    <Select name="link_type" defaultValue="child_of" form="link-form">
                      <option value="child_of">{shortName(person!)} — ребёнок выбранного</option>
                      <option value="parent_of">{shortName(person!)} — родитель выбранного</option>
                      <option value="spouse">Супруги</option>
                    </Select>
                    <Select name="other_id" defaultValue="" form="link-form" required>
                      <option value="" disabled>
                        Выберите из древа
                      </option>
                      {persons
                        .filter((p) => p.id !== person!.id)
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
                        if (form) addLink(new FormData(form));
                      }}
                    >
                      Добавить связь
                    </Button>
                  </div>
                )}
              </>
            )}
          </Rail>

          {!isNew && (
            <Rail title="История">
              {changes === null ? (
                <p className="text-[13px] leading-relaxed text-ink-400">
                  История появится после выполнения{" "}
                  <code className="font-mono">supabase/person-history.sql</code> в Supabase.
                </p>
              ) : changes.length === 0 ? (
                <p className="text-[13px] text-ink-400">Правок пока не было.</p>
              ) : (
                <PersonHistory treeId={treeId} personId={person.id} canEdit={canEdit} changes={changes} />
              )}
            </Rail>
          )}
        </aside>
      </form>

      {/* служебная форма для добавления связи — вне основной, чтобы не мешать сохранению */}
      {!isNew && (
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
