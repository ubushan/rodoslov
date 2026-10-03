"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { createTree } from "@/app/actions/trees";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-accent h-11 w-full">
      {pending ? "Создаём…" : "Создать древо"}
    </button>
  );
}

export function NewTreeForm() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-accent h-10 px-4">
        <span aria-hidden="true" className="text-[16px] leading-none">
          ＋
        </span>
        Новое древо
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Новое древо">
        <form action={createTree} className="space-y-5">
          <Field label="Название" hint="Например, «Ковалёвы и Лебедевы»">
            <Input name="title" required autoFocus placeholder="Наше древо" />
          </Field>

          <Field label="Описание" hint="Необязательно — что это за ветвь семьи">
            <Textarea name="description" placeholder="Потомки Петра Ковалёва из Вологды" />
          </Field>

          <p className="rounded-xl border border-[var(--p-line)] bg-[var(--p-row-bg)] px-3.5 py-3 text-[13px] leading-relaxed text-ink-500">
            Вы станете владельцем древа. Первая карточка создастся на ваше имя — её
            можно будет дополнить.
          </p>

          <Submit />
        </form>
      </Sheet>
    </>
  );
}
