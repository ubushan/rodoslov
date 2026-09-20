"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createTree(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim() || "Наше древо";
  const description = String(formData.get("description") ?? "").trim() || null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase
    .from("trees")
    .insert({ title, description, owner_id: user.id })
    .select("id")
    .single();

  if (error || !data) throw new Error("Не удалось создать древо");

  // Первая карточка — сам автор, чтобы древо не открывалось пустым
  const name = (user.user_metadata?.full_name ?? "").split(" ");
  await supabase.from("persons").insert({
    tree_id: data.id,
    first_name: name[0] ?? "",
    last_name: name[1] ?? "",
    created_by: user.id,
    pos_x: 0,
    pos_y: 0,
  });

  revalidatePath("/dashboard");
  redirect(`/tree/${data.id}`);
}

export async function renameTree(treeId: string, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  if (!title) return;

  const supabase = await createClient();
  await supabase.from("trees").update({ title, description }).eq("id", treeId);

  revalidatePath(`/tree/${treeId}`, "layout");
  revalidatePath("/dashboard");
}

export async function deleteTree(treeId: string) {
  const supabase = await createClient();
  await supabase.from("trees").delete().eq("id", treeId);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function leaveTree(treeId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("tree_members").delete().eq("tree_id", treeId).eq("user_id", user.id);
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
