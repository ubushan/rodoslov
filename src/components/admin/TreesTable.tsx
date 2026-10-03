"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/field";
import { peopleWord } from "@/lib/format";
import { IconCheck, IconExternal, IconPencil, IconTrash, IconX, RowMenu, type MenuItem } from "./ui";
import { useAdminAction } from "./use-admin-action";
import { deleteTree, renameTree } from "@/app/actions/admin";

export type TreeRow = {
  id: string;
  title: string;
  ownerName: string;
  ownerEmail: string | null;
  members: number;
  persons: number;
  createdAt: string | null;
  updatedAt: string | null;
};

const GRID = "lg:grid lg:grid-cols-[minmax(0,2.3fr)_minmax(0,1.4fr)_132px_124px] lg:items-center lg:gap-3";

const HEAD = "text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-400";

function MobileLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="w-[92px] shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-400 lg:hidden">
      {children}
    </span>
  );
}

/** «1 участник · 2 участника · 5 участников» — та же логика, что у peopleWord. */
function membersWord(n: number) {
  const tens = n % 10;
  const hundreds = n % 100;
  if (tens === 1 && hundreds !== 11) return "участник";
  if (tens >= 2 && tens <= 4 && (hundreds < 10 || hundreds >= 20)) return "участника";
  return "участников";
}

export function TreesTable({ rows }: { rows: TreeRow[] }) {
  const { pending, run } = useAdminAction();
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState("");

  return (
    <div role="table" aria-label="Древа платформы">
      <div role="row" className={`${GRID} hidden border-b border-[var(--p-line)] bg-[var(--p-row-bg)] px-4 py-2`}>
        <span role="columnheader" className={HEAD}>
          Древо
        </span>
        <span role="columnheader" className={HEAD}>
          Владелец
        </span>
        <span role="columnheader" className={HEAD}>
          Люди · участники
        </span>
        <span role="columnheader" className={`${HEAD} text-right`}>
          Действия
        </span>
      </div>

      <div className="divide-y divide-[var(--p-line-2)]">
        {rows.map((tree) => {
          const deleteItems: MenuItem[] = [
            {
              key: "delete",
              label: "Удалить древо вместе с людьми",
              icon: <IconTrash size={14} />,
              tone: "danger",
              onSelect: () => run(() => deleteTree(tree.id)),
            },
            { key: "cancel", label: "Не удалять", onSelect: () => {} },
          ];

          return (
            <div
              key={tree.id}
              role="row"
              data-tree-row={tree.id}
              className={`${GRID} flex flex-col gap-2.5 px-4 py-3.5 transition-colors last:rounded-b-[19px] lg:gap-3 lg:py-2.5 lg:hover:bg-[var(--p-row-bg)]`}
            >
              <div role="cell" className="min-w-0">
                {editing === tree.id ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      className="h-9 w-full py-0 text-[13px] sm:max-w-[280px]"
                      aria-label="Новое название древа"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="btn-accent"
                        disabled={pending}
                        onClick={() => run(() => renameTree(tree.id, title), () => setEditing(null))}
                      >
                        <IconCheck size={15} />
                        Сохранить
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="Отменить переименование"
                        title="Отмена"
                        onClick={() => setEditing(null)}
                      >
                        <IconX size={16} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <Link
                    href={`/admin/trees/${tree.id}`}
                    className="text-[13.5px] font-medium text-ink-800 transition-colors hover:text-brass-600"
                  >
                    {tree.title}
                  </Link>
                )}
                <p className="mt-0.5 text-[11.5px] text-ink-400">
                  создано: {tree.createdAt ?? "—"} · изменено: {tree.updatedAt ?? "—"}
                </p>
              </div>

              <div role="cell" className="flex min-w-0 items-start gap-2 lg:block">
                <MobileLabel>Владелец</MobileLabel>
                <div className="min-w-0">
                  <p className="truncate text-[13px] text-ink-700">{tree.ownerName}</p>
                  {tree.ownerEmail && (
                    <p className="mt-0.5 truncate text-[11.5px] text-ink-400">{tree.ownerEmail}</p>
                  )}
                </div>
              </div>

              <div role="cell" className="flex items-start gap-2 lg:block">
                <MobileLabel>Люди</MobileLabel>
                <div className="min-w-0 text-[12.5px] leading-relaxed text-ink-500">
                  <p className="truncate">
                    <span className="tabular-nums text-ink-700">{tree.persons}</span>{" "}
                    {peopleWord(tree.persons)}
                  </p>
                  <p className="truncate">
                    <span className="tabular-nums text-ink-700">{tree.members}</span>{" "}
                    {membersWord(tree.members)}
                  </p>
                </div>
              </div>

              <div role="cell" className="mt-0.5 flex items-center gap-1.5 lg:mt-0 lg:justify-end">
                <MobileLabel>Действия</MobileLabel>

                <Link
                  href={`/tree/${tree.id}`}
                  className="icon-btn"
                  title="Открыть древо на холсте"
                  aria-label={`Открыть древо «${tree.title}» на холсте`}
                >
                  <IconExternal size={16} />
                </Link>

                <button
                  type="button"
                  className="icon-btn disabled:pointer-events-none disabled:opacity-40"
                  disabled={pending}
                  title="Переименовать древо"
                  aria-label={`Переименовать древо «${tree.title}»`}
                  onClick={() => {
                    setEditing(tree.id);
                    setTitle(tree.title);
                  }}
                >
                  <IconPencil size={16} />
                </button>

                <RowMenu
                  label={`Удалить древо «${tree.title}»`}
                  icon={<IconTrash size={16} />}
                  items={deleteItems}
                  disabled={pending}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
