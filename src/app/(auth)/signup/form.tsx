"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signUp, signInWithGoogle } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Создаём аккаунт…" : "Создать аккаунт"}
    </Button>
  );
}

export function SignupForm() {
  const [state, action] = useActionState(signUp, null);

  return (
    <div className="mt-8">
      <form action={signInWithGoogle}>
        <Button type="submit" variant="secondary" size="lg" className="w-full">
          Продолжить с Google
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-ink-300">
        <span className="h-px flex-1 bg-mist-300" />
        или по почте
        <span className="h-px flex-1 bg-mist-300" />
      </div>

      <form action={action} className="space-y-4">
        <Field label="Как вас зовут">
          <Input name="full_name" required autoComplete="name" placeholder="Мария Ковалёва" />
        </Field>

        <Field label="Электронная почта">
          <Input name="email" type="email" required autoComplete="email" placeholder="anna@example.com" />
        </Field>

        <Field label="Пароль" hint="Не короче 8 символов">
          <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
        </Field>

        {state?.error && (
          <p className="rounded-[10px] border border-[#e4c3bd] bg-[#fdf4f2] px-3 py-2 text-sm text-[#c05a4d]">
            {state.error}
          </p>
        )}

        <Submit />
      </form>
    </div>
  );
}
