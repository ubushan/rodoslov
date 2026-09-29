"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "./ui";
import { useAdminAction } from "./use-admin-action";
import { deleteUser, setAdminRights, setUserBlocked } from "@/app/actions/admin";

export type UserRow = {
  id: string;
  email: string;
  name: string;
  createdAt: string | null;
  lastSignInAt: string | null;
  /** до какого времени закрыт вход, null — вход открыт */
  bannedUntil: string | null;
  trees: number;
  isAdmin: boolean;
  isEnvAdmin: boolean;
  isMe: boolean;
};

const BLOCK_OPTIONS = [
  { value: "none", label: "Вход открыт" },
  { value: "1", label: "Блокировка: 1 день" },
  { value: "7", label: "Блокировка: 7 дней" },
  { value: "30", label: "Блокировка: 30 дней" },
  { value: "0", label: "Блокировка: навсегда" },
];

export function UsersTable({ rows }: { rows: UserRow[] }) {
  const { pending, run } = useAdminAction();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <div className="divide-y divide-mist-200">
      {rows.map((user) => {
        const blocked = !!user.bannedUntil && new Date(user.bannedUntil) > new Date();
        return (
          <div
            key={user.id}
            data-user-row={user.email}
            className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4"
          >
            <div className="min-w-[220px] flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-ink-800">{user.name}</span>
                {user.isAdmin && <Badge tone="ok">{user.isEnvAdmin ? "админ из окружения" : "админ"}</Badge>}
                {user.isMe && <Badge>это вы</Badge>}
                {blocked && <Badge tone="danger">вход закрыт до {user.bannedUntil?.slice(0, 10)}</Badge>}
              </div>
              <p className="mt-0.5 truncate text-[13px] text-ink-500">{user.email}</p>
              <p className="mt-0.5 text-[12px] text-ink-400">
                регистрация: {user.createdAt ?? "—"} · последний вход: {user.lastSignInAt ?? "ни разу"} · древ:{" "}
                {user.trees}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={blocked ? "" : "none"}
                disabled={pending}
                onChange={(e) => {
                  const value = e.target.value;
                  if (!value) return;
                  const days = value === "none" ? null : Number(value);
                  run(() => setUserBlocked(user.id, days));
                }}
                className="h-8 rounded-lg border border-mist-300 bg-surface px-2 text-[13px] text-ink-700 focus:border-brass-500 focus:outline-none disabled:opacity-45"
                aria-label={`Доступ: ${user.email}`}
              >
                {blocked && <option value="">заблокирован</option>}
                {BLOCK_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <Button
                variant="secondary"
                size="sm"
                disabled={pending || user.isEnvAdmin}
                title={
                  user.isEnvAdmin
                    ? "Права заданы переменной ADMIN_EMAILS — уберите почту из неё"
                    : undefined
                }
                onClick={() => run(() => setAdminRights(user.id, !user.isAdmin))}
              >
                {user.isAdmin ? "Снять админа" : "Сделать админом"}
              </Button>

              {confirmId === user.id ? (
                <span className="flex items-center gap-2">
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => deleteUser(user.id),
                        () => setConfirmId(null)
                      )
                    }
                  >
                    Удалить всё
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmId(null)}>
                    Не удалять
                  </Button>
                </span>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending || user.isMe}
                  title={user.isMe ? "Свой аккаунт удалить нельзя" : undefined}
                  onClick={() => setConfirmId(user.id)}
                >
                  Удалить
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
