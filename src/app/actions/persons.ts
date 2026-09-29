"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { placeNewPerson, type NewRelative } from "@/lib/place";
import { getSettings } from "@/lib/settings";
import type { Gender, Person, Relationship, RelationKind } from "@/lib/types";

function num(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function str(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s || null;
}

function personPayload(formData: FormData) {
  const isLiving = formData.get("is_living") === "on";
  const payload: Record<string, unknown> = {
    last_name: String(formData.get("last_name") ?? "").trim(),
    first_name: String(formData.get("first_name") ?? "").trim(),
    middle_name: String(formData.get("middle_name") ?? "").trim(),
    maiden_name: str(formData.get("maiden_name")),
    other_names: str(formData.get("other_names")),
    gender: (String(formData.get("gender") ?? "unknown") as Gender),
    birth_year: num(formData.get("birth_year")),
    birth_date: str(formData.get("birth_date")),
    birth_place: str(formData.get("birth_place")),
    residence: str(formData.get("residence")),
    is_living: isLiving,
    death_year: isLiving ? null : num(formData.get("death_year")),
    death_date: isLiving ? null : str(formData.get("death_date")),
    bio: str(formData.get("bio")),
  };

  // Поле места смерти пишем, только если колонка уже есть в базе
  // (форма отмечает это скрытым полем) — иначе Postgres отверг бы всю запись.
  if (formData.get("has_death_place")) {
    payload.death_place = isLiving ? null : str(formData.get("death_place"));
  }

  return payload;
}

export async function createPerson(treeId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const payload = personPayload(formData);
  const gender = String(payload.gender ?? "unknown");

  // Связь с уже существующим человеком: кем новый человек ему приходится
  const relTo = str(formData.get("relate_to"));
  const relKind = str(formData.get("relate_kind")); // parent | spouse | sibling
  const relDirection = str(formData.get("relate_direction")); // parent_of | child_of

  const relation: NewRelative | null =
    !relTo || !relKind
      ? null
      : relKind === "spouse"
        ? "spouse"
        : relKind === "sibling"
          ? gender === "female"
            ? "sister"
            : "brother"
          : relKind !== "parent"
            ? null
            : relDirection === "child_of"
              ? "child"
              : gender === "female"
                ? "mother"
                : "father";

  const [{ data: personsData }, { data: relsData }] = await Promise.all([
    supabase.from("persons").select("*").eq("tree_id", treeId),
    supabase.from("relationships").select("*").eq("tree_id", treeId),
  ]);
  const persons = (personsData ?? []) as Person[];
  const relationships = (relsData ?? []) as Relationship[];
  const anchor = persons.find((p) => p.id === relTo) ?? null;

  // предел числа людей в древе задаёт администратор платформы
  const { maxPersonsPerTree } = await getSettings();
  if (maxPersonsPerTree > 0 && persons.length >= maxPersonsPerTree) {
    throw new Error("В древе достигнут предел числа людей");
  }

  // Позицию считаем на сервере: карточка сразу встаёт рядом с родственником,
  // а без связи — сверху по центру древа.
  const explicitX = num(formData.get("pos_x"));
  const explicitY = num(formData.get("pos_y"));
  const pos =
    explicitX != null && explicitY != null
      ? { x: explicitX, y: explicitY }
      : placeNewPerson({ persons, relationships, anchor, relation, gender });

  const { data, error } = await supabase
    .from("persons")
    .insert({
      ...payload,
      tree_id: treeId,
      created_by: user.id,
      pos_x: pos.x,
      pos_y: pos.y,
    })
    .select("id")
    .single();

  if (error) throw new Error("Не удалось добавить человека");

  const rows: {
    tree_id: string;
    kind: RelationKind;
    from_person_id: string;
    to_person_id: string;
  }[] = [];
  if (data && anchor && relation) {
    const link = (kind: RelationKind, from: string, to: string) =>
      rows.push({ tree_id: treeId, kind, from_person_id: from, to_person_id: to });

    if (relation === "spouse") {
      link("spouse", anchor.id, data.id);
    } else if (relation === "child") {
      // ребёнок, добавленный от карточки одного из супругов, сразу получает
      // и второго родителя — иначе он повис бы на одной линии
      link("parent", anchor.id, data.id);
      const second = secondParentOf(anchor.id, relationships);
      if (second) link("parent", second, data.id);
    } else if (relation === "father" || relation === "mother") {
      link("parent", data.id, anchor.id);
    } else {
      // брат или сестра: отдельного вида связи для них нет — родство считается
      // по общим родителям, поэтому переносим родительские связи родственника
      for (const r of relationships) {
        if (r.kind === "parent" && r.to_person_id === anchor.id) {
          link("parent", r.from_person_id, data.id);
        }
      }
    }
  }
  if (rows.length) {
    const { error: linkError } = await supabase.from("relationships").insert(rows);
    // карточка уже создана, поэтому не роняем действие — но связь без записи
    // в базе не появится, и об этом должно быть видно в логе сервера
    if (linkError) console.error("Не удалось сохранить связи новой карточки:", linkError.message);
  }

  revalidatePath(`/tree/${treeId}`);
  return data?.id as string;
}

/**
 * Второй родитель нового ребёнка: единственный супруг(а) того, от чьего имени
 * добавляют, а при нескольких браках — тот, кто уже родитель его детей.
 */
function secondParentOf(anchorId: string, relationships: Relationship[]) {
  const spouses = relationships
    .filter(
      (r) => r.kind === "spouse" && (r.from_person_id === anchorId || r.to_person_id === anchorId)
    )
    .map((r) => (r.from_person_id === anchorId ? r.to_person_id : r.from_person_id));
  if (!spouses.length) return null;
  if (spouses.length === 1) return spouses[0];

  const kids = new Set(
    relationships
      .filter((r) => r.kind === "parent" && r.from_person_id === anchorId)
      .map((r) => r.to_person_id)
  );
  return (
    spouses.find((s) =>
      relationships.some(
        (r) => r.kind === "parent" && r.from_person_id === s && kids.has(r.to_person_id)
      )
    ) ?? spouses[0]
  );
}

export async function updatePerson(treeId: string, personId: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("persons")
    .update(personPayload(formData))
    .eq("id", personId);

  if (error) throw new Error("Не удалось сохранить карточку");
  revalidatePath(`/tree/${treeId}`);
}

/** Откат карточки к состоянию до выбранной правки. */
export async function rollbackPerson(
  treeId: string,
  personId: string,
  changeId: number
): Promise<{ error?: string; ok?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Нужно войти" };

  const { data: membership } = await supabase
    .from("tree_members")
    .select("role")
    .eq("tree_id", treeId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership || (membership.role !== "owner" && membership.role !== "editor")) {
    return { error: "Откатывать правки могут владелец и редакторы" };
  }

  const { data: change, error } = await supabase
    .from("person_changes")
    .select("id, before")
    .eq("id", changeId)
    .eq("person_id", personId)
    .maybeSingle();
  if (error) return { error: "История недоступна — выполните supabase/person-history.sql" };
  if (!change) return { error: "Запись истории не найдена" };
  if (!change.before) return { error: "Это создание карточки — откатывать нечего" };

  // before — снимок всех полей карточки до правки; триггер запишет и сам откат
  const { error: updateError } = await supabase
    .from("persons")
    .update(change.before as Record<string, unknown>)
    .eq("id", personId);
  if (updateError) return { error: "Не удалось откатить правку" };

  revalidatePath(`/tree/${treeId}`);
  return { ok: "Карточка возвращена к прежнему состоянию" };
}

export async function deletePerson(treeId: string, personId: string) {
  const supabase = await createClient();
  await supabase.from("persons").delete().eq("id", personId);
  revalidatePath(`/tree/${treeId}`);
}

/** Позиции карточек на холсте сохраняются пачкой после перетаскивания */
export async function savePositions(
  treeId: string,
  positions: { id: string; x: number; y: number }[]
) {
  const supabase = await createClient();
  await Promise.all(
    positions.map((p) =>
      supabase.from("persons").update({ pos_x: p.x, pos_y: p.y }).eq("id", p.id)
    )
  );
}

export async function setPhoto(treeId: string, personId: string, path: string | null) {
  const supabase = await createClient();
  await supabase.from("persons").update({ photo_path: path }).eq("id", personId);
  revalidatePath(`/tree/${treeId}`);
}

// ---------------------------------------------------------------- связи

export async function createRelationship(
  treeId: string,
  kind: RelationKind,
  fromId: string,
  toId: string
) {
  if (fromId === toId) return { error: "Человека нельзя связать с самим собой" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("relationships")
    .insert({ tree_id: treeId, kind, from_person_id: fromId, to_person_id: toId });

  if (error) {
    return {
      error: error.code === "23505" ? "Такая связь уже есть" : "Не удалось создать связь",
    };
  }

  revalidatePath(`/tree/${treeId}`);
  return {};
}

export async function deleteRelationship(treeId: string, relationshipId: string) {
  const supabase = await createClient();
  await supabase.from("relationships").delete().eq("id", relationshipId);
  revalidatePath(`/tree/${treeId}`);
}

// ---------------------------------------------------------------- архив

export async function addAttachment(
  treeId: string,
  personId: string,
  storagePath: string,
  kind: "photo" | "document",
  caption: string | null
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("person_attachments").insert({
    tree_id: treeId,
    person_id: personId,
    storage_path: storagePath,
    kind,
    caption,
    created_by: user.id,
  });

  revalidatePath(`/tree/${treeId}`);
}

export async function deleteAttachment(treeId: string, attachmentId: string, path: string) {
  const supabase = await createClient();
  await supabase.storage.from("archive").remove([path]);
  await supabase.from("person_attachments").delete().eq("id", attachmentId);
  revalidatePath(`/tree/${treeId}`);
}
