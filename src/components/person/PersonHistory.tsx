"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { rollbackPerson } from "@/app/actions/persons";
import { describeChange } from "@/lib/changes";

export type ChangeRow = {
  id: number;
  author: string;
  createdAt: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
};

export function PersonHistory({
  treeId,
  personId,
  canEdit,
  changes,
}: {
  treeId: string;
  personId: string;
  canEdit: boolean;
  changes: ChangeRow[];
}) {
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function rollback(changeId: number) {
    setBusyId(changeId);
    const result = await rollbackPerson(treeId, personId, changeId);
    setBusyId(null);
    setConfirmId(null);
    if (result.error) toast.error(result.error);
    else {
      toast.success(result.ok);
      // даём реальтайму/ревалидации обновить страницу
      window.location.reload();
    }
  }

  return (
    <ol className="space-y-2.5">
      {changes.map((change) => {
        const lines = describeChange(change.before, change.after);
        const isCreate = !change.before;
        return (
          <li key={change.id} className="rounded-xl border border-mist-200 bg-mist-50 px-3.5 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[13px] font-medium text-ink-700">{change.author}</p>
              <p className="text-[12px] text-ink-400">{change.createdAt}</p>
            </div>
            <ul className="mt-1 space-y-0.5">
              {lines.map((line, index) => (
                <li key={index} className="text-[13px] leading-snug text-ink-500">
                  {line}
                </li>
              ))}
            </ul>

            {canEdit && !isCreate && (
              <div className="mt-2">
                {confirmId === change.id ? (
                  <span className="flex items-center gap-2">
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={busyId !== null}
                      onClick={() => rollback(change.id)}
                    >
                      Да, откатить
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmId(null)}>
                      Не откатывать
                    </Button>
                  </span>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setConfirmId(change.id)}>
                    Откатить
                  </Button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
