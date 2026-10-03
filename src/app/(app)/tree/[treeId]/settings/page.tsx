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
import { GedcomPanel } from "@/components/gedcom/GedcomPanel";
import type { MemberRole } from "@/lib/types";

export const metadata = { title: "Участники и доступ — Torlmud" };

/** Панель раздела: заголовок, пояснение и содержимое на общей поверхности. */
function Panel({
  title,
  hint,
  children,
  className = "",
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel overflow-hidden ${className}`}>
      <header className="border-b border-[var(--p-line)] px-5 py-4">
        <h2 className="font-display text-[19px] leading-snug text-ink-800">{title}</h2>
        {hint && <p className="mt-1 max-w-[62ch] text-[13px] leading-relaxed text-ink-500">{hint}</p>}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

/** «Тест Torlmud» → «ТР» */
function initials(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]).join("");
  return letters.toUpperCase() || "?";
}

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
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-5 sm:py-12">
      <Link
        href={`/tree/${treeId}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-400 transition-colors hover:text-ink-700"
      >
        <span aria-hidden="true">←</span> К древу «{tree.title}»
      </Link>

      <h1 className="mt-4 text-[28px] leading-tight text-ink-800 sm:text-[30px]">
        Участники и доступ
      </h1>
      <p className="mt-1.5 max-w-[60ch] text-sm leading-relaxed text-ink-500">
        Древо видят только те, кого вы пригласили. Ссылку можно ограничить сроком и числом
        переходов, а позже отозвать.
      </p>

      <div className="mt-8 space-y-6">
        {/* ---------------- Участники и роли ---------------- */}
        <Panel
          title="Кто работает над древом"
          hint="Роль решает, что человек может делать: править карточки и связи, приглашать других или только смотреть."
        >
          <ul className="divide-y divide-[var(--p-line)]">
            {members?.map((m) => {
              const profile = m.profiles as unknown as { full_name: string | null } | null;
              const isMe = m.user_id === user!.id;
              const name = profile?.full_name ?? "Участник";

              return (
                <li
                  key={m.user_id}
                  className="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--p-line)] bg-[var(--p-row-bg)] text-[13px] font-medium text-ink-600"
                    >
                      {initials(profile?.full_name)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="min-w-0 truncate text-[15px] text-ink-800">{name}</p>
                        {isMe && <span className="studio-chip">это вы</span>}
                      </div>
                      <p className="mt-1 text-[12.5px] leading-snug text-ink-400">
                        {ROLE_HINT[m.role]}
                      </p>
                    </div>
                  </div>

                  {isOwner && !isMe ? (
                    <div className="flex shrink-0 items-center gap-2 pl-[52px] sm:pl-0">
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
                    <span className="studio-chip shrink-0 self-start sm:self-auto">
                      {ROLE_LABEL[m.role]}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>

        {/* ---------------- Приглашения ---------------- */}
        {isOwner && (
          <Panel
            title="Ссылки-приглашения"
            hint="Отправьте ссылку родственнику: он войдёт под своим аккаунтом и сразу получит выбранную роль."
          >
            <form
              action={async (fd: FormData) => {
                "use server";
                await createInvite(treeId, fd);
              }}
              className="grid gap-4 sm:grid-cols-3"
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
                <button type="submit" className="btn-accent h-10 w-full sm:w-auto">
                  Создать ссылку
                </button>
              </div>
            </form>

            <div className="mt-6 border-t border-[var(--p-line)] pt-5">
              {invites && invites.length > 0 ? (
                <ul className="space-y-3">
                  {invites.map((inv) => {
                    const used = Number(inv.uses ?? 0);
                    const max = inv.max_uses ? Number(inv.max_uses) : null;
                    const percent = max ? Math.min(100, Math.round((used / max) * 100)) : null;

                    return (
                      <li
                        key={inv.id}
                        className="rounded-[14px] border border-[var(--p-line)] bg-[var(--p-row-bg)] p-3.5"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <CopyLink url={`${siteUrl}/invite/${inv.token}`} />
                          <span className="studio-chip">{ROLE_LABEL[inv.role]}</span>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="studio-chip">
                            {inv.expires_at
                              ? `до ${new Date(inv.expires_at).toLocaleDateString("ru-RU")}`
                              : "бессрочно"}
                          </span>
                          <span className="studio-chip">
                            {max
                              ? `переходов: ${used} из ${max}`
                              : `переходов: ${used} · без ограничения`}
                          </span>

                          <form
                            action={async () => {
                              "use server";
                              await revokeInvite(treeId, inv.id);
                            }}
                            className="ml-auto"
                          >
                            <Button type="submit" variant="ghost" size="sm">
                              Отозвать
                            </Button>
                          </form>
                        </div>

                        {percent !== null && (
                          <div
                            aria-hidden="true"
                            className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--p-line)]"
                          >
                            <span
                              className="block h-full rounded-full bg-[linear-gradient(90deg,var(--p-brass-600),var(--p-brass-400))]"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-[13px] leading-relaxed text-ink-400">
                  Активных ссылок пока нет. Создайте первую — она появится здесь вместе со
                  сроком и счётчиком переходов, и её можно будет отозвать.
                </p>
              )}
            </div>
          </Panel>
        )}

        {/* ---------------- Обмен GEDCOM ---------------- */}
        <Panel
          title="Обмен GEDCOM"
          hint="GEDCOM — общий формат генеалогии: файл понимают и другие программы."
        >
          <GedcomPanel treeId={treeId} canEdit={me.role === "owner" || me.role === "editor"} />
        </Panel>

        {/* ---------------- Название и описание ---------------- */}
        {isOwner && (
          <Panel
            title="Название и описание"
            hint="Так древо подписано в списке «Мои древа» и в шапке."
          >
            <form
              action={async (fd: FormData) => {
                "use server";
                await renameTree(treeId, fd);
              }}
              className="space-y-4"
            >
              <Field label="Название">
                <Input name="title" defaultValue={tree.title} required />
              </Field>
              <Field label="Описание">
                <Textarea name="description" defaultValue={tree.description ?? ""} />
              </Field>
              <button type="submit" className="btn-accent h-10 w-full sm:w-auto">
                Сохранить
              </button>
            </form>
          </Panel>
        )}

        {/* ---------------- Опасные действия: отдельной панелью ---------------- */}
        <section className="panel overflow-hidden border-danger-line">
          <header className="border-b border-danger-line bg-danger-soft px-5 py-4">
            <h2 className="font-display text-[19px] leading-snug text-danger-ink">
              {isOwner ? "Удалить древо" : "Покинуть древо"}
            </h2>
          </header>
          <div className="p-5">
            {isOwner ? (
              <>
                <p className="max-w-[60ch] text-[13.5px] leading-relaxed text-ink-600">
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
                <p className="max-w-[60ch] text-[13.5px] leading-relaxed text-ink-600">
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
          </div>
        </section>
      </div>
    </div>
  );
}
