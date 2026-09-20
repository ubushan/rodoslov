import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROLE_LABEL, ROLE_HINT } from "@/lib/format";
import { renameTree, deleteTree, leaveTree } from "@/app/actions/trees";
import { createInvite, revokeInvite, removeMember } from "@/app/actions/members";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea, Select } from "@/components/ui/field";
import { CopyLink } from "./copy-link";
import { RoleSelect } from "./role-select";
import type { MemberRole } from "@/lib/types";

export const metadata = { title: "Участники и доступ — Родослов" };

export default async function SettingsPage({ params }: { params: Promise<{ treeId: string }> }) {
  const { treeId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: tree } = await supabase
    .from("trees")
    .select("id, title, description, owner_id")
    .eq("id", treeId)
    .single();

  if (!tree) notFound();

  const { data: members } = await supabase
    .from("tree_members")
    .select("user_id, role, created_at, profiles(full_name, avatar_url)")
    .eq("tree_id", treeId)
    .order("created_at");

  const me = members?.find((m) => m.user_id === user!.id);
  if (!me) notFound();

  const isOwner = me.role === "owner";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";

  const { data: invites } = isOwner
    ? await supabase
        .from("tree_invites")
        .select("*")
        .eq("tree_id", treeId)
        .eq("revoked", false)
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:py-14">
      <Link
        href={`/tree/${treeId}`}
        className="text-sm text-ink-400 transition-colors hover:text-ink-700"
      >
        ← К древу «{tree.title}»
      </Link>

      <h1 className="mt-4 text-[30px] leading-tight text-ink-800">Участники и доступ</h1>
      <p className="mt-1.5 max-w-[60ch] text-sm leading-relaxed text-ink-500">
        Древо видят только те, кого вы пригласили. Ссылку можно ограничить сроком и числом
        переходов, а позже отозвать.
      </p>

      {/* ---------------- Участники ---------------- */}
      <section className="mt-10">
        <h2 className="text-[20px] text-ink-800">Кто работает над древом</h2>

        <ul className="mt-4 space-y-px overflow-hidden rounded-2xl bg-mist-200">
          {members?.map((m) => {
            const profile = m.profiles as unknown as { full_name: string | null } | null;
            const isMe = m.user_id === user!.id;
            return (
              <li
                key={m.user_id}
                className="flex flex-wrap items-center justify-between gap-3 bg-white px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-[15px] text-ink-800">
                    {profile?.full_name ?? "Участник"}
                    {isMe && <span className="ml-2 text-[13px] text-ink-400">это вы</span>}
                  </p>
                  <p className="mt-0.5 text-[13px] text-ink-400">{ROLE_HINT[m.role]}</p>
                </div>

                {isOwner && !isMe ? (
                  <div className="flex items-center gap-2">
                    <RoleSelect treeId={treeId} userId={m.user_id} role={m.role as MemberRole} />

                    <form
                      action={async () => {
                        "use server";
                        await removeMember(treeId, m.user_id);
                      }}
                    >
                      <Button type="submit" variant="ghost" size="sm">
                        Убрать
                      </Button>
                    </form>
                  </div>
                ) : (
                  <span className="rounded-lg bg-mist-100 px-2.5 py-1 text-[13px] text-ink-600">
                    {ROLE_LABEL[m.role]}
                  </span>
                )}
              </li>
            );
          })}
        </ul>

      </section>

      {/* ---------------- Приглашения ---------------- */}
      {isOwner && (
        <section className="mt-12">
          <h2 className="text-[20px] text-ink-800">Ссылки-приглашения</h2>

          <form
            action={async (fd: FormData) => {
              "use server";
              await createInvite(treeId, fd);
            }}
            className="mt-4 grid gap-4 rounded-2xl border border-mist-200 bg-white p-5 sm:grid-cols-3"
          >
            <Field label="Роль приглашённого">
              <Select name="role" defaultValue="editor">
                <option value="editor">Редактор</option>
                <option value="viewer">Зритель</option>
              </Select>
            </Field>

            <Field label="Срок действия">
              <Select name="expires_days" defaultValue="14">
                <option value="0">Без срока</option>
                <option value="1">1 день</option>
                <option value="7">7 дней</option>
                <option value="14">14 дней</option>
                <option value="30">30 дней</option>
              </Select>
            </Field>

            <Field label="Сколько человек" hint="Пусто — без ограничения">
              <Input name="max_uses" type="number" min={1} placeholder="Например, 1" />
            </Field>

            <div className="sm:col-span-3">
              <Button type="submit">Создать ссылку</Button>
            </div>
          </form>

          {invites && invites.length > 0 && (
            <ul className="mt-4 space-y-2">
              {invites.map((inv) => (
                <li
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-mist-200 bg-white px-4 py-3"
                >
                  <div className="min-w-0">
                    <CopyLink url={`${siteUrl}/invite/${inv.token}`} />
                    <p className="mt-1 text-[13px] text-ink-400">
                      {ROLE_LABEL[inv.role]}
                      {inv.expires_at
                        ? ` · до ${new Date(inv.expires_at).toLocaleDateString("ru-RU")}`
                        : " · бессрочно"}
                      {inv.max_uses ? ` · использовано ${inv.uses} из ${inv.max_uses}` : ""}
                    </p>
                  </div>

                  <form
                    action={async () => {
                      "use server";
                      await revokeInvite(treeId, inv.id);
                    }}
                  >
                    <Button type="submit" variant="ghost" size="sm">
                      Отозвать
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ---------------- Настройки древа ---------------- */}
      {isOwner && (
        <section className="mt-12">
          <h2 className="text-[20px] text-ink-800">Название и описание</h2>

          <form
            action={async (fd: FormData) => {
              "use server";
              await renameTree(treeId, fd);
            }}
            className="mt-4 space-y-4 rounded-2xl border border-mist-200 bg-white p-5"
          >
            <Field label="Название">
              <Input name="title" defaultValue={tree.title} required />
            </Field>
            <Field label="Описание">
              <Textarea name="description" defaultValue={tree.description ?? ""} />
            </Field>
            <Button type="submit">Сохранить</Button>
          </form>
        </section>
      )}

      {/* ---------------- Опасная зона ---------------- */}
      <section className="mt-12 rounded-2xl border border-[#e4c3bd] bg-[#fdf4f2] p-5">
        {isOwner ? (
          <>
            <h2 className="text-[18px] text-ink-800">Удалить древо</h2>
            <p className="mt-1.5 max-w-[58ch] text-sm leading-relaxed text-ink-500">
              Исчезнут все карточки, связи, фотографии и документы. Участники потеряют
              доступ. Восстановить не получится.
            </p>
            <form
              action={async () => {
                "use server";
                await deleteTree(treeId);
              }}
              className="mt-4"
            >
              <Button type="submit" variant="danger">
                Удалить древо «{tree.title}»
              </Button>
            </form>
          </>
        ) : (
          <>
            <h2 className="text-[18px] text-ink-800">Покинуть древо</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-500">
              Вы перестанете видеть древо. Внесённые вами карточки останутся.
            </p>
            <form
              action={async () => {
                "use server";
                await leaveTree(treeId);
              }}
              className="mt-4"
            >
              <Button type="submit" variant="danger">
                Покинуть древо
              </Button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
