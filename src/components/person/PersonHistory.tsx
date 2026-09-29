"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { rollbackPerson } from "@/app/actions/persons";
import { formatDate } from "@/lib/format";

export type ChangeRow = {
  id: number;
  author: string;
  createdAt: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
};

/** Подписи полей карточки — в том порядке, в каком их показываем в истории. */
const FIELDS: [string, string][] = [
  ["last_name", "Фамилия"],
  ["first_name", "Имя"],
  ["middle_name", "Отчество"],
  ["maiden_name", "Девичья фамилия"],
  ["other_names", "Другие имена"],
  ["gender", "Пол"],
  ["birth_year", "Год рождения"],
  ["birth_date", "Дата рождения"],
  ["birth_place", "Место рождения"],
  ["residence", "Проживание"],
  ["is_living", "Жив"],
  ["death_year", "Год смерти"],
  ["death_date", "Дата смерти"],
  ["death_place", "Место смерти"],
  ["bio", "Биография"],
];

function valueOf(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "gender") {
    return value === "male" ? "мужской" : value === "female" ? "женский" : "не указан";
  }
  if (key === "is_living") return value ? "жив" : "умер";
  if (key === "birth_date" || key === "death_date") return formatDate(String(value)) ?? String(value);
  return String(value);
}

/** Короткое описание правки: «Имя: Анна → Мария, Год рождения: 1938 → 1939». */
function describeChange(before: Record<string, unknown> | null, after: Record<string, unknown>): string[] {
  if (!before) {
    const name = [after.first_name, after.last_name].filter(Boolean).join(" ") || "без имени";
    return [`создал(а) карточку «${name}»`];
  }
  const parts: string[] = [];
  for (const [key, label] of FIELDS) {
    if (before[key] === after[key]) continue;
    parts.push(`${label}: ${valueOf(key, before[key])} → ${valueOf(key, after[key])}`);
  }
  return parts.length ? parts : ["без видимых изменений"];
}

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
