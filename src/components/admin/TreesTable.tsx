"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
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

export function TreesTable({ rows }: { rows: TreeRow[] }) {
  const { pending, run } = useAdminAction();
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <div className="divide-y divide-mist-200">
      {rows.map((tree) => (
        <div
          key={tree.id}
          data-tree-row={tree.id}
          className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4"
        >
          <div className="min-w-[240px] flex-1">
            {editing === tree.id ? (
              <div className="flex items-center gap-2">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-8 max-w-[280px] py-0 text-[13px]"
                  aria-label="Новое название древа"
                />
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() => run(() => renameTree(tree.id, title), () => setEditing(null))}
                >
                  Сохранить
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                  Отмена
                </Button>
              </div>
            ) : (
              <Link
                href={`/admin/trees/${tree.id}`}
                className="text-sm font-medium text-ink-800 hover:text-brass-600"
              >
                {tree.title}
              </Link>
            )}
            <p className="mt-0.5 text-[12px] text-ink-400">
              владелец: {tree.ownerName}
              {tree.ownerEmail ? ` · ${tree.ownerEmail}` : ""} · создано: {tree.createdAt ?? "—"} · изменено:{" "}
              {tree.updatedAt ?? "—"}
            </p>
          </div>

          <p className="w-[190px] shrink-0 text-[13px] text-ink-500">
            людей: {tree.persons} · участников: {tree.members}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/tree/${tree.id}`}
              className="rounded-lg border border-mist-300 px-3 py-1.5 text-[13px] text-ink-700 transition-colors hover:border-ink-300"
            >
              Открыть
            </Link>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setEditing(tree.id);
                setTitle(tree.title);
              }}
            >
              Переименовать
            </Button>

            {confirmId === tree.id ? (
              <span className="flex items-center gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => deleteTree(tree.id),
                      () => setConfirmId(null)
                    )
                  }
                >
                  Удалить всё древо
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmId(null)}>
                  Не удалять
                </Button>
              </span>
            ) : (
              <Button variant="ghost" size="sm" disabled={pending} onClick={() => setConfirmId(tree.id)}>
                Удалить
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
