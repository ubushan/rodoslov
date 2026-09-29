"use server";

import { revalidatePath } from "next/cache";
import { adminClient, assertAdmin } from "@/lib/admin";

/**
 * Действия панели администратора. Все они работают через service role key,
 * поэтому первым шагом всегда проверяем, что действие запустил администратор.
 */

export type ActionResult = { error?: string; ok?: string };

const MEMBER_ROLES = ["owner", "editor", "viewer"] as const;

/** Сколько часов длится блокировка: null — снять, 0 — навсегда. */
function banDuration(days: number | null): string {
  if (days === null) return "none";
  if (days === 0) return "876000h"; // «навсегда»: сто лет
  return `${days * 24}h`;
}

function refresh() {
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/trees");
}

// ---------------------------------------------------------------- пользователи

export async function setUserBlocked(userId: string, days: number | null): Promise<ActionResult> {
  await assertAdmin();
  const admin = adminClient();

  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: banDuration(days),
  });
  if (error) return { error: "Не удалось изменить блокировку" };

  refresh();
  return { ok: days === null ? "Блокировка снята" : "Доступ закрыт" };
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  const me = await assertAdmin();
  if (me.id === userId) return { error: "Свой аккаунт удалить нельзя" };

  const admin = adminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: "Не удалось удалить пользователя" };

  refresh();
  return { ok: "Пользователь удалён вместе со своими древами" };
}

/** Выдать или отозвать права администратора платформы. */
export async function setAdminRights(userId: string, granted: boolean): Promise<ActionResult> {
  const me = await assertAdmin();
  if (me.id === userId && !granted) {
    return { error: "Снять права с себя нельзя — попросите другого администратора" };
  }

  const admin = adminClient();
  const { error } = granted
    ? await admin.from("admins").upsert({ user_id: userId, note: "назначен из панели" })
    : await admin.from("admins").delete().eq("user_id", userId);

  if (error) {
    return {
      error:
        error.code === "PGRST205"
          ? "Таблицы admins нет — выполните supabase/admin.sql"
          : "Не удалось изменить права",
    };
  }

  refresh();
  return { ok: granted ? "Права администратора выданы" : "Права администратора отозваны" };
}

// ---------------------------------------------------------------- древа

export async function renameTree(treeId: string, title: string): Promise<ActionResult> {
  await assertAdmin();
  const clean = title.trim();
  if (!clean) return { error: "Название не может быть пустым" };

  const { error } = await adminClient().from("trees").update({ title: clean }).eq("id", treeId);
  if (error) return { error: "Не удалось переименовать древо" };

  refresh();
  revalidatePath(`/admin/trees/${treeId}`);
  return { ok: "Название сохранено" };
}

export async function deleteTree(treeId: string): Promise<ActionResult> {
  await assertAdmin();
  const { error } = await adminClient().from("trees").delete().eq("id", treeId);
  if (error) return { error: "Не удалось удалить древо" };

  refresh();
  return { ok: "Древо удалено" };
}

// ---------------------------------------------------------------- доступы

export async function setMemberRole(
  treeId: string,
  userId: string,
  role: string
): Promise<ActionResult> {
  await assertAdmin();
  if (!MEMBER_ROLES.includes(role as (typeof MEMBER_ROLES)[number])) {
    return { error: "Неизвестная роль" };
  }

  const admin = adminClient();
  // владельца древа понижать нельзя: без него древо останется без хозяина
  const { data: tree } = await admin.from("trees").select("owner_id").eq("id", treeId).single();
  if (tree?.owner_id === userId && role !== "owner") {
    return { error: "Сначала передайте древо другому владельцу" };
  }

  const { error } = await admin
    .from("tree_members")
    .update({ role })
    .eq("tree_id", treeId)
    .eq("user_id", userId);
  if (error) return { error: "Не удалось изменить роль" };

  refresh();
  revalidatePath(`/admin/trees/${treeId}`);
  return { ok: "Роль обновлена" };
}

export async function removeMember(treeId: string, userId: string): Promise<ActionResult> {
  await assertAdmin();
  const admin = adminClient();

  const { data: tree } = await admin.from("trees").select("owner_id").eq("id", treeId).single();
  if (tree?.owner_id === userId) return { error: "Владельца древа исключить нельзя" };

  const { error } = await admin
    .from("tree_members")
    .delete()
    .eq("tree_id", treeId)
    .eq("user_id", userId);
  if (error) return { error: "Не удалось исключить участника" };

  refresh();
  revalidatePath(`/admin/trees/${treeId}`);
  return { ok: "Доступ отозван" };
}

export async function revokeInvite(inviteId: string, treeId: string): Promise<ActionResult> {
  await assertAdmin();
  const { error } = await adminClient()
    .from("tree_invites")
    .update({ revoked: true })
    .eq("id", inviteId);
  if (error) return { error: "Не удалось отозвать приглашение" };

  revalidatePath(`/admin/trees/${treeId}`);
  return { ok: "Приглашение отозвано" };
}

// ---------------------------------------------------------------- настройки

export async function saveSettings(formData: FormData): Promise<ActionResult> {
  await assertAdmin();

  const allowSignups = formData.get("allow_signups") === "on";
  const maxRaw = String(formData.get("max_persons_per_tree") ?? "0").trim();
  const max = maxRaw === "" ? 0 : Number(maxRaw);
  if (!Number.isInteger(max) || max < 0) {
    return { error: "Предел людей — целое число, 0 означает «без предела»" };
  }

  const admin = adminClient();
  const { error } = await admin.from("platform_settings").upsert([
    { key: "allow_signups", value: allowSignups, updated_at: new Date().toISOString() },
    { key: "max_persons_per_tree", value: max, updated_at: new Date().toISOString() },
  ]);
  if (error) {
    return {
      error:
        error.code === "PGRST205"
          ? "Таблицы настроек нет — выполните supabase/admin.sql"
          : "Не удалось сохранить настройки",
    };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/signup");
  return { ok: "Настройки сохранены" };
}
