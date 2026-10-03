"use client";

import {
  Chip,
  IconLock,
  IconShield,
  IconShieldOff,
  IconTrash,
  IconUnlock,
  RowMenu,
  type MenuItem,
} from "./ui";
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

/** Длительности блокировки — те же, что были в списке выбора. */
const BLOCK_OPTIONS = [
  { value: "1", days: 1, label: "Заблокировать на 1 день" },
  { value: "7", days: 7, label: "Заблокировать на 7 дней" },
  { value: "30", days: 30, label: "Заблокировать на 30 дней" },
  { value: "0", days: 0, label: "Заблокировать навсегда" },
];

/* Одна сетка на шапку и строки: на узком экране строки становятся карточками. */
const GRID =
  "lg:grid lg:grid-cols-[minmax(0,2.2fr)_176px_150px_64px_118px_124px] lg:items-center lg:gap-3";

const HEAD = "text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-400";

function isoToDay(value: string | null) {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  return y && m && d ? `${d}.${m}.${y}` : value;
}

/** Подпись поля для карточного вида на телефоне. */
function MobileLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="w-[92px] shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-400 lg:hidden">
      {children}
    </span>
  );
}

export function UsersTable({ rows }: { rows: UserRow[] }) {
  const { pending, run } = useAdminAction();

  return (
    <div role="table" aria-label="Пользователи платформы">
      <div role="row" className={`${GRID} hidden border-b border-[var(--p-line)] bg-[var(--p-row-bg)] px-4 py-2`}>
        <span role="columnheader" className={HEAD}>
          Пользователь
        </span>
        <span role="columnheader" className={HEAD}>
          Роль
        </span>
        <span role="columnheader" className={HEAD}>
          Вход
        </span>
        <span role="columnheader" className={`${HEAD} text-right`}>
          Древ
        </span>
        <span role="columnheader" className={HEAD}>
          Регистрация
        </span>
        <span role="columnheader" className={`${HEAD} text-right`}>
          Действия
        </span>
      </div>

      <div className="divide-y divide-[var(--p-line-2)]">
        {rows.map((user) => {
          const blocked = !!user.bannedUntil && new Date(user.bannedUntil) > new Date();
          const role = user.isEnvAdmin
            ? { label: "админ из окружения", tone: "accent" as const }
            : user.isAdmin
              ? { label: "администратор", tone: "ok" as const }
              : { label: "пользователь", tone: "muted" as const };

          const blockItems: MenuItem[] = [];
          if (blocked) {
            blockItems.push({
              key: "none",
              label: "Снять блокировку",
              icon: <IconUnlock size={14} />,
              onSelect: () => run(() => setUserBlocked(user.id, null)),
            });
          }
          for (const option of BLOCK_OPTIONS) {
            blockItems.push({
              key: option.value,
              label: option.label,
              icon: <IconLock size={14} />,
              onSelect: () => run(() => setUserBlocked(user.id, option.days)),
            });
          }

          const deleteItems: MenuItem[] = [
            {
              key: "delete",
              label: "Удалить аккаунт и древа",
              icon: <IconTrash size={14} />,
              tone: "danger",
              onSelect: () => run(() => deleteUser(user.id)),
            },
            { key: "cancel", label: "Не удалять", onSelect: () => {} },
          ];

          return (
            <div
              key={user.id}
              role="row"
              data-user-row={user.email}
              className={`${GRID} flex flex-col gap-2.5 px-4 py-3.5 transition-colors last:rounded-b-[19px] lg:gap-3 lg:py-2.5 lg:hover:bg-[var(--p-row-bg)]`}
            >
              <div role="cell" className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[13.5px] font-medium text-ink-800">{user.name}</span>
                  {user.isMe && <Chip>это вы</Chip>}
                </div>
                <p className="mt-0.5 [overflow-wrap:anywhere] text-[12.5px] text-ink-500">{user.email}</p>
                <p className="mt-1 text-[11.5px] text-ink-400 lg:hidden">
                  регистрация: {user.createdAt ?? "—"} · последний вход: {user.lastSignInAt ?? "ни разу"} · древ:{" "}
                  {user.trees}
                </p>
              </div>

              <div role="cell" className="flex items-center gap-2 lg:block">
                <MobileLabel>Роль</MobileLabel>
                <Chip tone={role.tone}>{role.label}</Chip>
              </div>

              <div role="cell" className="flex items-center gap-2 lg:block">
                <MobileLabel>Вход</MobileLabel>
                {blocked ? (
                  <Chip tone="danger" icon={<IconLock size={13} />}>
                    закрыт до {isoToDay(user.bannedUntil)}
                  </Chip>
                ) : (
                  <Chip tone="ok" icon={<IconUnlock size={13} />}>
                    открыт
                  </Chip>
                )}
              </div>

              <div role="cell" className="flex items-center gap-2 lg:block lg:text-right">
                <MobileLabel>Древ</MobileLabel>
                <span className="text-[13px] tabular-nums text-ink-600">{user.trees}</span>
              </div>

              <div role="cell" className="flex items-center gap-2 lg:block">
                <MobileLabel>Регистрация</MobileLabel>
                <span className="whitespace-nowrap text-[12.5px] tabular-nums text-ink-500">
                  {user.createdAt ?? "—"}
                </span>
              </div>

              <div role="cell" className="mt-0.5 flex items-center gap-1.5 lg:mt-0 lg:justify-end">
                <MobileLabel>Действия</MobileLabel>

                <RowMenu
                  label={blocked ? `Блокировка: ${user.name}` : `Закрыть вход: ${user.name}`}
                  icon={blocked ? <IconUnlock size={16} /> : <IconLock size={16} />}
                  items={blockItems}
                  disabled={pending}
                />

                <button
                  type="button"
                  className="icon-btn disabled:pointer-events-none disabled:opacity-40"
                  disabled={pending || user.isEnvAdmin}
                  aria-label={user.isAdmin ? `Снять права администратора: ${user.name}` : `Сделать администратором: ${user.name}`}
                  title={
                    user.isEnvAdmin
                      ? "Права заданы переменной ADMIN_EMAILS — уберите почту из неё"
                      : user.isAdmin
                        ? "Снять права администратора"
                        : "Сделать администратором"
                  }
                  onClick={() => run(() => setAdminRights(user.id, !user.isAdmin))}
                >
                  {user.isAdmin ? <IconShieldOff size={16} /> : <IconShield size={16} />}
                </button>

                <RowMenu
                  label={user.isMe ? "Свой аккаунт удалить нельзя" : `Удалить пользователя: ${user.name}`}
                  icon={<IconTrash size={16} />}
                  items={deleteItems}
                  disabled={pending || user.isMe}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
