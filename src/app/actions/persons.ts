"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Gender, RelationKind } from "@/lib/types";

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
  return {
    last_name: String(formData.get("last_name") ?? "").trim(),
    first_name: String(formData.get("first_name") ?? "").trim(),
    middle_name: String(formData.get("middle_name") ?? "").trim(),
    maiden_name: str(formData.get("maiden_name")),
    other_names: str(formData.get("other_names")),
    gender: (String(formData.get("gender") ?? "unknown") as Gender),
    birth_year: num(formData.get("birth_year")),
    birth_place: str(formData.get("birth_place")),
    residence: str(formData.get("residence")),
    is_living: isLiving,
    death_year: isLiving ? null : num(formData.get("death_year")),
    bio: str(formData.get("bio")),
  };
}

export async function createPerson(treeId: string, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("persons")
    .insert({
      ...personPayload(formData),
      tree_id: treeId,
      created_by: user.id,
      pos_x: num(formData.get("pos_x")) ?? 0,
      pos_y: num(formData.get("pos_y")) ?? 0,
    })
    .select("id")
    .single();

  if (error) throw new Error("Не удалось добавить человека");

  // Необязательная связь с уже существующим человеком
  const relTo = str(formData.get("relate_to"));
  const relKind = str(formData.get("relate_kind")) as RelationKind | null;
  const relDirection = str(formData.get("relate_direction")); // parent_of | child_of

  if (relTo && relKind && data) {
    const isParentOf = relKind === "parent" && relDirection === "parent_of";
    await supabase.from("relationships").insert({
      tree_id: treeId,
      kind: relKind,
      from_person_id: relKind === "spouse" ? relTo : isParentOf ? data.id : relTo,
      to_person_id: relKind === "spouse" ? data.id : isParentOf ? relTo : data.id,
    });
  }

  revalidatePath(`/tree/${treeId}`);
  return data?.id as string;
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
