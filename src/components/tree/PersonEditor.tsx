"use client";

import { useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea, Select } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/client";
import { shortName, initials, publicUrl } from "@/lib/format";
import {
  updatePerson,
  deletePerson,
  setPhoto,
  createRelationship,
  deleteRelationship,
  addAttachment,
  deleteAttachment,
} from "@/app/actions/persons";
import type { Person, Relationship, Attachment, RelationKind } from "@/lib/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

type Tab = "card" | "links" | "archive";

export function PersonEditor({
  treeId,
  person,
  people,
  relationships,
  attachments,
  canEdit,
  onClose,
  onChanged,
}: {
  treeId: string;
  person: Person;
  people: Person[];
  relationships: Relationship[];
  attachments: Attachment[];
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<Tab>("card");
  const [isLiving, setIsLiving] = useState(person.is_living);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const photoUrl = publicUrl(SUPABASE_URL, "photos", person.photo_path);
  const byId = new Map(people.map((p) => [p.id, p]));

  const related = relationships.filter(
    (r) => r.from_person_id === person.id || r.to_person_id === person.id
  );

  async function uploadPhoto(file: File) {
    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${treeId}/${person.id}/portrait-${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from("photos").upload(path, file, { upsert: true });
    setUploading(false);

    if (error) return toast.error("Не удалось загрузить фотографию");

    startTransition(async () => {
      await setPhoto(treeId, person.id, path);
      onChanged();
      toast.success("Фотография обновлена");
    });
  }

  async function uploadArchive(file: File) {
    setUploading(true);
    const supabase = createClient();
    const path = `${treeId}/${person.id}/${Date.now()}-${file.name}`;
    const kind = file.type.startsWith("image/") ? "photo" : "document";

    const { error } = await supabase.storage.from("archive").upload(path, file);
    setUploading(false);

    if (error) return toast.error("Не удалось загрузить файл");

    startTransition(async () => {
      await addAttachment(treeId, person.id, path, kind, file.name);
      onChanged();
      toast.success("Файл добавлен в архив");
    });
  }

  function addLink(formData: FormData) {
    const otherId = String(formData.get("other_id") ?? "");
    const type = String(formData.get("link_type") ?? "");
    if (!otherId || !type) return;

    startTransition(async () => {
      let kind: RelationKind = "parent";
      let from = person.id;
      let to = otherId;

      if (type === "parent_of") { kind = "parent"; from = person.id; to = otherId; }
      if (type === "child_of")  { kind = "parent"; from = otherId; to = person.id; }
      if (type === "spouse")    { kind = "spouse"; from = person.id; to = otherId; }

      const res = await createRelationship(treeId, kind, from, to);
      if (res.error) toast.error(res.error);
      else { onChanged(); toast.success("Связь добавлена"); }
    });
  }

  function describeLink(r: Relationship) {
    const otherId = r.from_person_id === person.id ? r.to_person_id : r.from_person_id;
    const other = byId.get(otherId);
    const label =
      r.kind === "spouse"
        ? "Супруг(а)"
        : r.from_person_id === person.id
          ? "Ребёнок"
          : "Родитель";
    return { label, name: other ? shortName(other) : "Удалённая карточка" };
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={shortName(person)}
      footer={
        canEdit ? (
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="danger"
              size="sm"
              disabled={pending}
              onClick={() => {
                if (!confirm(`Удалить карточку «${shortName(person)}» и все её связи?`)) return;
                startTransition(async () => {
                  await deletePerson(treeId, person.id);
                  onChanged();
                  onClose();
                  toast.success("Карточка удалена");
                });
              }}
            >
              Удалить карточку
            </Button>
            {tab === "card" && (
              <Button type="submit" form="person-form" disabled={pending}>
                {pending ? "Сохраняем…" : "Сохранить"}
              </Button>
            )}
          </div>
        ) : (
          <p className="text-sm text-ink-500">
            У вас роль зрителя — карточку можно только смотреть.
          </p>
        )
      }
    >
      {/* Портрет */}
      <div className="flex items-center gap-4">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="h-20 w-20 rounded-2xl object-cover" />
        ) : (
          <span className="grid h-20 w-20 place-items-center rounded-2xl bg-ink-700 font-display text-lg text-brass-400">
            {initials(person)}
          </span>
        )}

        {canEdit && (
          <div className="space-y-2">
            <input
              ref={photoInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
            />
            <Button variant="secondary" size="sm" onClick={() => photoInput.current?.click()} disabled={uploading}>
              {uploading ? "Загружаем…" : photoUrl ? "Заменить фото" : "Добавить фото"}
            </Button>
            {photoUrl && (
              <button
                className="block text-[13px] text-ink-400 hover:text-[#c05a4d]"
                onClick={() =>
                  startTransition(async () => {
                    await setPhoto(treeId, person.id, null);
                    onChanged();
                  })
                }
              >
                Убрать фотографию
              </button>
            )}
          </div>
        )}
      </div>

      {/* Вкладки */}
      <div className="mt-6 flex gap-1 rounded-xl bg-mist-100 p-1">
        {([
          ["card", "Карточка"],
          ["links", `Связи (${related.length})`],
          ["archive", `Архив (${attachments.length})`],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
              tab === key ? "bg-white text-ink-800 shadow-sm" : "text-ink-500 hover:text-ink-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* --------------------------- Карточка --------------------------- */}
      {tab === "card" && (
        <form
          id="person-form"
          className="mt-6 space-y-4"
          action={(fd) =>
            startTransition(async () => {
              await updatePerson(treeId, person.id, fd);
              onChanged();
              toast.success("Карточка сохранена");
            })
          }
        >
          <fieldset disabled={!canEdit} className="space-y-4">
            <Field label="Фамилия">
              <Input name="last_name" defaultValue={person.last_name} placeholder="Ковалёва" />
            </Field>
            <Field label="Имя">
              <Input name="first_name" defaultValue={person.first_name} placeholder="Мария" />
            </Field>
            <Field label="Отчество">
              <Input name="middle_name" defaultValue={person.middle_name} placeholder="Сергеевна" />
            </Field>
            <Field label="Девичья фамилия" hint="Если фамилия менялась при замужестве">
              <Input name="maiden_name" defaultValue={person.maiden_name ?? ""} placeholder="Лебедева" />
            </Field>
            <Field label="Другие имена" hint="Прозвище, имя при крещении, иное написание в документах">
              <Input name="other_names" defaultValue={person.other_names ?? ""} />
            </Field>

            <Field label="Пол">
              <Select name="gender" defaultValue={person.gender}>
                <option value="unknown">Не указан</option>
                <option value="female">Женский</option>
                <option value="male">Мужской</option>
              </Select>
            </Field>

            <Field label="Год рождения">
              <Input
                name="birth_year"
                type="number"
                inputMode="numeric"
                min={1000}
                max={2100}
                defaultValue={person.birth_year ?? ""}
                placeholder="1989"
              />
            </Field>

            <Field label="Место рождения">
              <Input name="birth_place" defaultValue={person.birth_place ?? ""} placeholder="Ярославль" />
            </Field>

            <Field label="Место проживания" hint="Показывается прямо на карточке в древе">
              <Input name="residence" defaultValue={person.residence ?? ""} placeholder="Москва" />
            </Field>

            <label className="flex items-center gap-2.5 rounded-[10px] border border-mist-300 bg-white px-3 py-2.5">
              <input
                type="checkbox"
                name="is_living"
                defaultChecked={person.is_living}
                onChange={(e) => setIsLiving(e.target.checked)}
                className="h-4 w-4 accent-[#c9a227]"
              />
              <span className="text-sm text-ink-700">Человек жив</span>
            </label>

            {!isLiving && (
              <Field label="Год смерти">
                <Input
                  name="death_year"
                  type="number"
                  inputMode="numeric"
                  min={1000}
                  max={2100}
                  defaultValue={person.death_year ?? ""}
                />
              </Field>
            )}

            <Field label="Биография и заметки" hint="Всё, что рассказывали в семье">
              <Textarea name="bio" defaultValue={person.bio ?? ""} rows={6} />
            </Field>
          </fieldset>
        </form>
      )}

      {/* --------------------------- Связи --------------------------- */}
      {tab === "links" && (
        <div className="mt-6 space-y-6">
          {related.length === 0 ? (
            <p className="rounded-xl border border-dashed border-mist-300 px-4 py-8 text-center text-sm text-ink-500">
              Связей пока нет. Добавьте родителя, ребёнка или супруга — линии появятся на
              древе.
            </p>
          ) : (
            <ul className="space-y-2">
              {related.map((r) => {
                const d = describeLink(r);
                return (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-mist-200 bg-white px-3.5 py-2.5"
                  >
                    <span className="min-w-0">
                      <span className="block text-[13px] text-ink-400">{d.label}</span>
                      <span className="block truncate text-sm text-ink-800">{d.name}</span>
                    </span>
                    {canEdit && (
                      <button
                        onClick={() =>
                          startTransition(async () => {
                            await deleteRelationship(treeId, r.id);
                            onChanged();
                            toast.success("Связь удалена");
                          })
                        }
                        className="shrink-0 rounded-lg px-2 py-1 text-[13px] text-ink-400 hover:bg-mist-100 hover:text-[#c05a4d]"
                      >
                        Разорвать
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {canEdit && (
            <form action={addLink} className="space-y-3 rounded-xl bg-mist-50 p-4">
              <h3 className="text-[15px] text-ink-800">Добавить связь</h3>

              <Field label="Кем приходится">
                <Select name="link_type" defaultValue="child_of">
                  <option value="child_of">{shortName(person)} — ребёнок выбранного</option>
                  <option value="parent_of">{shortName(person)} — родитель выбранного</option>
                  <option value="spouse">Супруги</option>
                </Select>
              </Field>

              <Field label="Человек">
                <Select name="other_id" required defaultValue="">
                  <option value="" disabled>
                    Выберите из древа
                  </option>
                  {people
                    .filter((p) => p.id !== person.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {shortName(p)}
                        {p.birth_year ? ` · ${p.birth_year}` : ""}
                      </option>
                    ))}
                </Select>
              </Field>

              <Button type="submit" variant="secondary" size="sm" disabled={pending}>
                Связать
              </Button>
            </form>
          )}
        </div>
      )}

      {/* --------------------------- Архив --------------------------- */}
      {tab === "archive" && (
        <div className="mt-6 space-y-4">
          {attachments.length === 0 && (
            <p className="rounded-xl border border-dashed border-mist-300 px-4 py-8 text-center text-sm text-ink-500">
              Здесь хранятся сканы документов и дополнительные снимки. Добавьте первый
              файл.
            </p>
          )}

          <ul className="space-y-2">
            {attachments.map((a) => {
              const url = publicUrl(SUPABASE_URL, "archive", a.storage_path)!;
              return (
                <li
                  key={a.id}
                  className="flex items-center gap-3 rounded-xl border border-mist-200 bg-white p-2.5"
                >
                  {a.kind === "photo" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                  ) : (
                    <span className="grid h-12 w-12 place-items-center rounded-lg bg-mist-100 text-ink-400">
                      ▤
                    </span>
                  )}

                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 truncate text-sm text-ink-700 hover:text-brass-600"
                  >
                    {a.caption ?? "Файл"}
                  </a>

                  {canEdit && (
                    <button
                      onClick={() =>
                        startTransition(async () => {
                          await deleteAttachment(treeId, a.id, a.storage_path);
                          onChanged();
                        })
                      }
                      className="shrink-0 rounded-lg px-2 py-1 text-[13px] text-ink-400 hover:text-[#c05a4d]"
                    >
                      Удалить
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          {canEdit && (
            <>
              <input
                ref={fileInput}
                type="file"
                hidden
                accept="image/*,.pdf,.doc,.docx"
                onChange={(e) => e.target.files?.[0] && uploadArchive(e.target.files[0])}
              />
              <Button variant="secondary" onClick={() => fileInput.current?.click()} disabled={uploading}>
                {uploading ? "Загружаем…" : "Добавить файл"}
              </Button>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
