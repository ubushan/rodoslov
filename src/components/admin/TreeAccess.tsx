"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Chip, IconBan, IconShield, IconTrash, RowMenu, type MenuItem, type ChipTone } from "./ui";
import { useAdminAction } from "./use-admin-action";
import { deleteTree, removeMember, revokeInvite, setMemberRole } from "@/app/actions/admin";

const ROLE_OPTIONS = [
  { value: "owner", label: "Владелец", tone: "accent" as ChipTone },
  { value: "editor", label: "Редактор", tone: "ok" as ChipTone },
  { value: "viewer", label: "Зритель", tone: "muted" as ChipTone },
];

export type MemberRow = {
  userId: string;
  email: string | null;
  name: string;
  role: string;
  isOwner: boolean;
};

export type InviteRow = {
  id: string;
  role: string;
  token: string;
  uses: number;
  maxUses: number | null;
  expiresAt: string | null;
  revoked: boolean;
  createdAt: string | null;
};

function MobileLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="w-[92px] shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-400 lg:hidden">
      {children}
    </span>
  );
}

/** Участники древа: роль чипом, смена роли и исключение — из меню строки. */
export function MembersList({ treeId, members }: { treeId: string; members: MemberRow[] }) {
  const { pending, run } = useAdminAction();

  return (
    <div role="table" aria-label="Участники древа">
      <div className="hidden border-b border-[var(--p-line)] bg-[var(--p-row-bg)] px-4 py-2 lg:grid lg:grid-cols-[minmax(0,1fr)_150px_124px] lg:items-center lg:gap-3">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-400">Участник</span>
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-400">Роль</span>
        <span className="text-right text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-400">
          Действия
        </span>
      </div>

      <div className="divide-y divide-[var(--p-line-2)]">
        {members.map((member) => {
          const role = ROLE_OPTIONS.find((option) => option.value === member.role);

          const roleItems: MenuItem[] = ROLE_OPTIONS.map((option) => ({
            key: option.value,
            label: option.label,
            current: option.value === member.role,
            onSelect: () => run(() => setMemberRole(treeId, member.userId, option.value)),
          }));

          const removeItems: MenuItem[] = [
            {
              key: "remove",
              label: "Отозвать доступ",
              icon: <IconBan size={14} />,
              tone: "danger",
              onSelect: () => run(() => removeMember(treeId, member.userId)),
            },
            { key: "cancel", label: "Отмена", onSelect: () => {} },
          ];

          return (
            <div
              key={member.userId}
              data-member-row={member.userId}
              className="flex flex-col gap-2.5 px-4 py-3.5 transition-colors last:rounded-b-[19px] lg:grid lg:grid-cols-[minmax(0,1fr)_150px_124px] lg:items-center lg:gap-3 lg:py-2.5 lg:hover:bg-[var(--p-row-bg)]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[13.5px] text-ink-800">{member.name}</span>
                  {member.isOwner && <Chip tone="accent">владелец древа</Chip>}
                </div>
                <p className="mt-0.5 truncate text-[12px] text-ink-400">{member.email ?? "почта недоступна"}</p>
              </div>

              <div className="flex items-center gap-2 lg:block">
                <MobileLabel>Роль</MobileLabel>
                <Chip tone={role?.tone ?? "muted"}>{role?.label ?? member.role}</Chip>
              </div>

              <div className="mt-0.5 flex items-center gap-1.5 lg:mt-0 lg:justify-end">
                <MobileLabel>Действия</MobileLabel>
                <RowMenu
                  label={
                    member.isOwner ? "Владелец древа: роль не меняется" : `Изменить роль: ${member.name}`
                  }
                  icon={<IconShield size={16} />}
                  items={roleItems}
                  disabled={pending || member.isOwner}
                />
                <RowMenu
                  label={member.isOwner ? "Владельца древа исключить нельзя" : `Исключить из древа: ${member.name}`}
                  icon={<IconBan size={16} />}
                  items={removeItems}
                  disabled={pending || member.isOwner}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Удаление древа целиком — с подтверждением в два шага. */
export function DeleteTreeButton({ treeId }: { treeId: string }) {
  const router = useRouter();
  const { pending, run } = useAdminAction();
  const [confirm, setConfirm] = useState(false);

  if (!confirm) {
    return (
      <Button variant="danger" size="sm" disabled={pending} onClick={() => setConfirm(true)}>
        <IconTrash size={15} />
        Удалить древо
      </Button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2">
      <Button
        variant="danger"
        size="sm"
        disabled={pending}
        // со страницы удалённого древа возвращаемся к списку
        onClick={() => run(() => deleteTree(treeId), () => router.push("/admin/trees"))}
      >
        <IconTrash size={15} />
        Да, удалить вместе с людьми
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
        Не удалять
      </Button>
    </span>
  );
}

/** Приглашения древа: ссылка, роль и состояние чипами, отзыв — иконкой. */
export function InvitesList({ treeId, invites }: { treeId: string; invites: InviteRow[] }) {
  const { pending, run } = useAdminAction();

  return (
    <div role="table" aria-label="Приглашения в древо">
      <div className="hidden border-b border-[var(--p-line)] bg-[var(--p-row-bg)] px-4 py-2 lg:grid lg:grid-cols-[minmax(0,1fr)_108px] lg:items-center lg:gap-3">
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-400">
          Ссылка-приглашение
        </span>
        <span className="text-right text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-400">
          Действия
        </span>
      </div>

      <div className="divide-y divide-[var(--p-line-2)]">
        {invites.map((invite) => {
          const expired = !!invite.expiresAt && new Date(invite.expiresAt) < new Date();
          const exhausted = invite.maxUses != null && invite.uses >= invite.maxUses;
          const dead = invite.revoked || expired || exhausted;
          const role = ROLE_OPTIONS.find((option) => option.value === invite.role);

          return (
            <div
              key={invite.id}
              data-invite-row={invite.id}
              className="flex flex-col gap-2.5 px-4 py-3.5 transition-colors last:rounded-b-[19px] lg:grid lg:grid-cols-[minmax(0,1fr)_108px] lg:items-center lg:gap-3 lg:py-2.5 lg:hover:bg-[var(--p-row-bg)]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[12.5px] text-ink-700">
                    {invite.token.slice(0, 12)}…
                  </span>
                  <Chip tone={role?.tone ?? "muted"}>{role?.label ?? invite.role}</Chip>
                  {invite.revoked && <Chip tone="danger">отозвано</Chip>}
                  {!invite.revoked && expired && <Chip tone="warn">истекло</Chip>}
                  {!invite.revoked && !expired && exhausted && <Chip tone="warn">использовано</Chip>}
                  {!dead && <Chip tone="ok">действует</Chip>}
                </div>
                <p className="mt-0.5 text-[11.5px] text-ink-400">
                  использований: {invite.uses}
                  {invite.maxUses != null ? ` из ${invite.maxUses}` : ""} · создано: {invite.createdAt ?? "—"}
                </p>
              </div>

              <div className="mt-0.5 flex items-center gap-1.5 lg:mt-0 lg:justify-end">
                <MobileLabel>Действия</MobileLabel>
                <button
                  type="button"
                  className="icon-btn disabled:pointer-events-none disabled:opacity-40"
                  disabled={pending || dead}
                  title={dead ? "Приглашение уже не действует" : "Отозвать приглашение"}
                  aria-label={dead ? "Приглашение уже не действует" : "Отозвать приглашение"}
                  onClick={() => run(() => revokeInvite(invite.id, treeId))}
                >
                  <IconBan size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
