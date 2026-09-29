"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
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
    <div className="space-y-5 px-5 py-5">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={allow}
          onChange={(e) => setAllow(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-mist-300 accent-brass-500"
        />
        <span>
          <span className="block text-sm text-ink-800">Открытая регистрация</span>
          <span className="mt-0.5 block text-[13px] text-ink-500">
            Если снять галочку, новые пользователи не смогут зарегистрироваться — вход и приглашения
            продолжат работать.
          </span>
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-ink-600">
          Предел числа людей в одном древе
        </span>
        <Input
          value={max}
          onChange={(e) => setMax(e.target.value)}
          inputMode="numeric"
          className="max-w-[140px]"
        />
        <span className="mt-1 block text-[12px] text-ink-400">0 — без ограничения.</span>
      </label>

      <Button
        type="button"
        disabled={pending}
        onClick={() => {
          const formData = new FormData();
          if (allow) formData.set("allow_signups", "on");
          formData.set("max_persons_per_tree", max.trim() || "0");
          run(() => saveSettings(formData));
        }}
      >
        {pending ? "Сохраняем…" : "Сохранить настройки"}
      </Button>
    </div>
  );
}
