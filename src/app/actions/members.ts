"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MemberRole } from "@/lib/types";

export async function createInvite(treeId: string, formData: FormData) {
  const role = (String(formData.get("role") ?? "editor") as MemberRole) || "editor";
  const days = Number(formData.get("expires_days") ?? 0);
  const maxUsesRaw = String(formData.get("max_uses") ?? "").trim();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  await supabase.from("tree_invites").insert({
    tree_id: treeId,
    role,
    created_by: user.id,
    expires_at: days > 0 ? new Date(Date.now() + days * 864e5).toISOString() : null,
    max_uses: maxUsesRaw ? Number(maxUsesRaw) : null,
  });

  revalidatePath(`/tree/${treeId}/settings`);
}

export async function revokeInvite(treeId: string, inviteId: string) {
  const supabase = await createClient();
  await supabase.from("tree_invites").update({ revoked: true }).eq("id", inviteId);
  revalidatePath(`/tree/${treeId}/settings`);
}

export async function changeMemberRole(treeId: string, userId: string, role: MemberRole) {
  const supabase = await createClient();
  await supabase
    .from("tree_members")
    .update({ role })
    .eq("tree_id", treeId)
    .eq("user_id", userId);
  revalidatePath(`/tree/${treeId}/settings`);
}

export async function removeMember(treeId: string, userId: string) {
  const supabase = await createClient();
  await supabase.from("tree_members").delete().eq("tree_id", treeId).eq("user_id", userId);
  revalidatePath(`/tree/${treeId}/settings`);
}

export async function acceptInvite(token: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invite", { p_token: token });

  if (error) {
    const map: Record<string, string> = {
      INVITE_NOT_FOUND: "notfound",
      INVITE_REVOKED: "revoked",
      INVITE_EXPIRED: "expired",
      INVITE_EXHAUSTED: "exhausted",
    };
    const key = Object.keys(map).find((k) => error.message.includes(k));
    redirect(`/invite/${token}?error=${key ? map[key] : "unknown"}`);
  }

  revalidatePath("/dashboard");
  redirect(`/tree/${data}`);
}
