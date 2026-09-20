"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { createTree } from "@/app/actions/trees";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Создаём…" : "Создать древо"}
    </Button>
  );
}

export function NewTreeForm() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Новое древо</Button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Новое древо">
        <form action={createTree} className="space-y-4">
          <Field label="Название" hint="Например, «Ковалёвы и Лебедевы»">
            <Input name="title" required autoFocus placeholder="Наше древо" />
          </Field>

          <Field label="Описание" hint="Необязательно — что это за ветвь семьи">
            <Textarea name="description" placeholder="Потомки Петра Ковалёва из Вологды" />
          </Field>

          <p className="text-sm leading-relaxed text-ink-500">
            Вы станете владельцем древа. Первая карточка создастся на ваше имя — её можно
            будет дополнить.
          </p>

          <Submit />
        </form>
      </Sheet>
    </>
  );
}
