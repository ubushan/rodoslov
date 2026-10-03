"use server";

import { createClient } from "@/lib/supabase/server";
import { embeddedName } from "@/lib/admin";
import type { MemberRole } from "@/lib/types";
import type { TreeContextData } from "@/components/shell/TreeContext";

/**
 * Контекст древа для шапки по требованию — только чтение, под сессией
 * пользователя (RLS решает, что видно). Нужен как запасной путь: серверный
 * layout с `x-pathname` отдаёт данные при загрузке страницы, но при переходах
 * внутри приложения Next переиспользует собранный layout, и шапка дообновляется
 * этим действием.
 */
export async function loadTreeContext(treeId: string): Promise<TreeContextData | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: tree }, { data: members }] = await Promise.all([
    supabase.from("trees").select("id, title").eq("id", treeId).maybeSingle(),
    supabase
      .from("tree_members")
      .select("user_id, role, created_at, profiles(full_name)")
      .eq("tree_id", treeId)
      .order("created_at"),
  ]);

  const me = members?.find((member) => member.user_id === user.id);
  if (!tree || !me) return null;

  return {
    id: tree.id as string,
    title: tree.title as string,
    role: me.role as MemberRole,
    members: (members ?? []).map((member) => ({
      id: member.user_id as string,
      name: embeddedName(member.profiles) ?? "Участник",
      role: member.role as MemberRole,
    })),
  };
}
