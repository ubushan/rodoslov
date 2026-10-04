"use client";

import { memo, useCallback, useMemo, useState } from "react";
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

/** Строка правки «старое → новое»: старое приглушено, новое — основным текстом. */
function ChangeLine({ text }: { text: string }) {
  const parts = text.split(" → ");
  if (parts.length !== 2) {
    return <span className="text-[12.5px] leading-snug text-ink-500">{text}</span>;
  }
  return (
    <span className="flex flex-wrap items-baseline gap-x-1.5 text-[12.5px] leading-snug">
      <span className="break-words text-ink-400">{parts[0]}</span>
      <span aria-hidden="true" className="text-brass-500">→</span>
      <span className="break-words text-ink-800">{parts[1]}</span>
    </span>
  );
}

/**
 * Одна правка в `memo`: подтверждение или откат в строке перерисовывает только
 * её, а разбор «было → стало» считается один раз на саму правку (`useMemo`) —
 * иначе длинная история пересобирала бы все строки на каждое нажатие.
 */
const ChangeItem = memo(function ChangeItem({
  change,
  canEdit,
  busy,
  confirming,
  onAsk,
  onCancel,
  onRollback,
}: {
  change: ChangeRow;
  canEdit: boolean;
  busy: boolean;
  confirming: boolean;
  onAsk: (id: number) => void;
  onCancel: () => void;
  onRollback: (id: number) => void;
}) {
  const lines = useMemo(
    () => describeChange(change.before, change.after),
    [change]
  );
  const isCreate = !change.before;

  return (
    <li className="rounded-[12px] border border-line-2 bg-row px-2.5 py-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <p className="min-w-0 break-words text-[12.5px] font-medium text-ink-700">
          {change.author}
        </p>
        <p className="shrink-0 font-mono text-[11px] tabular-nums text-ink-400">
          {change.createdAt}
        </p>
      </div>

      <ul className="mt-1 space-y-0.5">
        {lines.map((line, index) => (
          <li key={index}>
            <ChangeLine text={line} />
          </li>
        ))}
      </ul>

      {canEdit && !isCreate && (
        <div className="mt-1.5">
          {confirming ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-ink-500">Вернуть значения до этой правки?</span>
              <Button
                type="button"
                variant="danger"
                size="sm"
                disabled={busy}
                onClick={() => onRollback(change.id)}
              >
                {busy ? "Откатываем…" : "Да, откатить"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={onCancel}
              >
                Не откатывать
              </Button>
            </div>
          ) : (
            <button
              type="button"
              disabled={busy}
              className="rounded-[8px] border border-line bg-field px-2 py-0.5 text-[12px] text-ink-500 transition-colors hover:border-[var(--p-acc-line)] hover:bg-acc hover:text-brass-ink disabled:opacity-50"
              onClick={() => onAsk(change.id)}
            >
              Откатить
            </button>
          )}
        </div>
      )}
    </li>
  );
});

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

  const rollback = useCallback(
    async (changeId: number) => {
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
    },
    [treeId, personId]
  );

  const ask = useCallback((id: number) => setConfirmId(id), []);
  const cancel = useCallback(() => setConfirmId(null), []);

  return (
    <ol className="m-0 list-none space-y-2 p-0">
      {changes.map((change) => (
        <ChangeItem
          key={change.id}
          change={change}
          canEdit={canEdit}
          busy={busyId === change.id}
          confirming={confirmId === change.id}
          onAsk={ask}
          onCancel={cancel}
          onRollback={rollback}
        />
      ))}
    </ol>
  );
}
