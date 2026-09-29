import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Доступ в панель администратора.
 *
 * Администраторов задают двумя способами: таблица public.admins (её правят прямо
 * в панели) и переменная ADMIN_EMAILS — запасной вход, который работает даже
 * если таблица ещё не создана или права в ней случайно отозваны у всех.
 *
 * Сами данные панель читает клиентом с service role key: он обходит RLS,
 * поэтому видит все древа и всех пользователей. Ключ живёт только на сервере
 * и никогда не попадает в браузер.
 */

export type AdminIdentity = { id: string; email: string };

/** Почты администраторов из окружения: ADMIN_EMAILS=me@mail.ru,second@mail.ru */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function hasServiceKey() {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

/** Клиент с service role key — полный доступ к базе и к Auth Admin API. */
export function adminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY не задан — панель администратора без него не работает");
  }
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Текущий пользователь, если он администратор платформы. */
export async function currentAdmin(): Promise<AdminIdentity | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const email = user.email.toLowerCase();
  if (adminEmails().includes(email)) return { id: user.id, email };

  // Таблицы admins может ещё не быть — тогда администраторов задаёт только окружение
  if (!hasServiceKey()) return null;
  const { data, error } = await adminClient()
    .from("admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return null;
  return data ? { id: user.id, email } : null;
}

/** Для страниц: чужая панель не должна даже показываться. */
export async function requireAdmin(): Promise<AdminIdentity> {
  const admin = await currentAdmin();
  if (!admin) notFound();
  return admin;
}

/** Для серверных действий: без прав — отказ. */
export async function assertAdmin(): Promise<AdminIdentity> {
  const admin = await currentAdmin();
  if (!admin) throw new Error("Недостаточно прав");
  return admin;
}

/** Есть ли в базе таблица администраторов (миграция admin.sql). */
export async function adminsTableReady() {
  if (!hasServiceKey()) return false;
  const { error } = await adminClient().from("admins").select("user_id").limit(0);
  return !error;
}

/** Кто назначен администратором в базе. */
export async function adminIds(): Promise<Set<string>> {
  if (!(await adminsTableReady())) return new Set();
  const { data } = await adminClient().from("admins").select("user_id");
  return new Set((data ?? []).map((row) => row.user_id as string));
}

/**
 * Имя из вложенного select вида `profiles(full_name)`.
 * PostgREST отдаёт связь то объектом, то массивом — читаем оба варианта.
 */
export function embeddedName(value: unknown): string | null {
  const row = Array.isArray(value) ? value[0] : value;
  const name = (row as { full_name?: string | null } | null)?.full_name;
  return name ?? null;
}

/**
 * Почта и имя по идентификаторам — почты в profiles нет, поэтому берём их
 * из Auth через service role.
 */
export async function usersById(
  ids: string[]
): Promise<Map<string, { email: string | null; name: string }>> {
  const out = new Map<string, { email: string | null; name: string }>();
  if (!hasServiceKey()) return out;

  const admin = adminClient();
  await Promise.all(
    [...new Set(ids)].map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id);
      const user = data?.user;
      if (!user) return;
      const meta = (user.user_metadata ?? {}) as { full_name?: string };
      out.set(id, {
        email: user.email ?? null,
        name: meta.full_name?.trim() || (user.email ?? "").split("@")[0] || "Без имени",
      });
    })
  );
  return out;
}

/**
 * Связь древа с владельцем для вложенного select.
 * Пишем имя связи явно: без него PostgREST отвечает «more than one relationship
 * was found for 'trees' and 'profiles'» и вместо данных возвращает ошибку.
 */
export const TREE_OWNER_SELECT = "owner:profiles!trees_owner_id_fkey(full_name)";
