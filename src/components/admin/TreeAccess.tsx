"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "./ui";
import { useAdminAction } from "./use-admin-action";
import { deleteTree, removeMember, revokeInvite, setMemberRole } from "@/app/actions/admin";

const ROLE_OPTIONS = [
  { value: "owner", label: "Владелец" },
  { value: "editor", label: "Редактор" },
  { value: "viewer", label: "Зритель" },
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

export function MembersList({ treeId, members }: { treeId: string; members: MemberRow[] }) {
  const { pending, run } = useAdminAction();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <div className="divide-y divide-mist-200">
      {members.map((member) => (
        <div
          key={member.userId}
          data-member-row={member.userId}
          className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5"
        >
          <div className="min-w-[200px] flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink-800">{member.name}</span>
              {member.isOwner && <Badge tone="warn">владелец древа</Badge>}
            </div>
            <p className="mt-0.5 truncate text-[12px] text-ink-400">{member.email ?? "почта недоступна"}</p>
          </div>

          <select
            value={member.role}
            disabled={pending || member.isOwner}
            onChange={(e) => run(() => setMemberRole(treeId, member.userId, e.target.value))}
            className="h-8 rounded-lg border border-mist-300 bg-white px-2 text-[13px] text-ink-700 focus:border-brass-500 focus:outline-none disabled:opacity-45"
            aria-label={`Роль: ${member.name}`}
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {confirmId === member.userId ? (
            <span className="flex items-center gap-2">
              <Button
                variant="danger"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(
                    () => removeMember(treeId, member.userId),
                    () => setConfirmId(null)
                  )
                }
              >
                Отозвать доступ
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirmId(null)}>
                Отмена
              </Button>
            </span>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending || member.isOwner}
              title={member.isOwner ? "Владельца древа исключить нельзя" : undefined}
              onClick={() => setConfirmId(member.userId)}
            >
              Исключить
            </Button>
          )}
        </div>
      ))}
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
        Да, удалить вместе с людьми
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>
        Не удалять
      </Button>
    </span>
  );
}

export function InvitesList({ treeId, invites }: { treeId: string; invites: InviteRow[] }) {
  const { pending, run } = useAdminAction();

  return (
    <div className="divide-y divide-mist-200">
      {invites.map((invite) => {
        const expired = !!invite.expiresAt && new Date(invite.expiresAt) < new Date();
        const exhausted = invite.maxUses != null && invite.uses >= invite.maxUses;
        const dead = invite.revoked || expired || exhausted;
        return (
          <div
            key={invite.id}
            data-invite-row={invite.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5"
          >
            <div className="min-w-[200px] flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[13px] text-ink-700">{invite.token.slice(0, 12)}…</span>
                <Badge>{ROLE_OPTIONS.find((r) => r.value === invite.role)?.label ?? invite.role}</Badge>
                {invite.revoked && <Badge tone="danger">отозвано</Badge>}
                {!invite.revoked && expired && <Badge tone="warn">истекло</Badge>}
                {!invite.revoked && !expired && exhausted && <Badge tone="warn">использовано</Badge>}
              </div>
              <p className="mt-0.5 text-[12px] text-ink-400">
                использований: {invite.uses}
                {invite.maxUses != null ? ` из ${invite.maxUses}` : ""} · создано: {invite.createdAt ?? "—"}
              </p>
            </div>

            <Button
              variant="secondary"
              size="sm"
              disabled={pending || dead}
              onClick={() => run(() => revokeInvite(invite.id, treeId))}
            >
              Отозвать
            </Button>
          </div>
        );
      })}
    </div>
  );
}
