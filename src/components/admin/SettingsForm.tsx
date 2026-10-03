"use client";

import { useState } from "react";
import { Input } from "@/components/ui/field";
import { IconCheck } from "./ui";
import { useAdminAction } from "./use-admin-action";
import { saveSettings } from "@/app/actions/admin";

export function SettingsForm({
  allowSignups,
  maxPersonsPerTree,
}: {
  allowSignups: boolean;
  maxPersonsPerTree: number;
}) {
  const { pending, run } = useAdminAction();
  const [allow, setAllow] = useState(allowSignups);
  const [max, setMax] = useState(String(maxPersonsPerTree));

  return (
    <div className="space-y-5 px-4 py-4 sm:px-5 sm:py-5">
      {/* Переключатель: вся строка — цель нажатия, состояние читается и с клавиатуры */}
      <button
        type="button"
        role="switch"
        aria-checked={allow}
        onClick={() => setAllow((value) => !value)}
        className="flex w-full items-start gap-4 rounded-[14px] border border-[var(--p-line)] bg-[var(--p-field-bg)] px-3.5 py-3 text-left transition-colors hover:border-[var(--p-line-3)]"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-medium text-ink-800">Открытая регистрация</span>
          <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-500">
            Если выключить, новые пользователи не смогут зарегистрироваться — вход и приглашения
            продолжат работать.
          </span>
        </span>
        <span
          aria-hidden="true"
          className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors"
          style={{
            borderColor: allow ? "var(--p-acc-line)" : "var(--p-line-3)",
            background: allow ? "var(--p-acc-bg)" : "var(--p-row-bg)",
          }}
        >
          <span
            className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full transition-[left] duration-150"
            style={{
              left: allow ? "calc(100% - 20px)" : "3px",
              background: allow ? "var(--color-brass-500)" : "var(--color-mist-300)",
            }}
          />
        </span>
      </button>

      <label className="block max-w-[420px]">
        <span className="mb-1.5 flex items-center justify-between gap-3">
          <span className="text-[13px] font-medium text-ink-600">Предел числа людей в одном древе</span>
          <span className="text-[11.5px] tabular-nums text-ink-400">{max.trim() === "0" || max.trim() === "" ? "без предела" : `${max} человек`}</span>
        </span>
        <Input
          value={max}
          onChange={(event) => setMax(event.target.value)}
          inputMode="numeric"
          className="max-w-[140px]"
          aria-label="Предел числа людей в одном древе"
        />
        <span className="mt-1 block text-[12px] text-ink-400">0 — без ограничения.</span>
      </label>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          className="btn-accent"
          disabled={pending}
          onClick={() => {
            const formData = new FormData();
            if (allow) formData.set("allow_signups", "on");
            formData.set("max_persons_per_tree", max.trim() || "0");
            run(() => saveSettings(formData));
          }}
        >
          <IconCheck size={15} />
          {pending ? "Сохраняем…" : "Сохранить настройки"}
        </button>
        <span className="text-[12px] text-ink-400">Действуют для всех древ и пользователей сразу.</span>
      </div>
    </div>
  );
}
