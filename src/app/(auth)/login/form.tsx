"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, signInWithGoogle } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

function Submit({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? "Минутку…" : children}
    </Button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(signIn, null);

  return (
    <div className="mt-8">
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <Button type="submit" variant="secondary" size="lg" className="w-full">
          Войти через Google
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-ink-300">
        <span className="h-px flex-1 bg-mist-300" />
        или по почте
        <span className="h-px flex-1 bg-mist-300" />
      </div>

      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />

        <Field label="Электронная почта">
          <Input name="email" type="email" required autoComplete="email" placeholder="anna@example.com" />
        </Field>

        <Field label="Пароль">
          <Input name="password" type="password" required autoComplete="current-password" />
        </Field>

        {state?.error && (
          <p className="rounded-[10px] border border-[#e4c3bd] bg-[#fdf4f2] px-3 py-2 text-sm text-[#c05a4d]">
            {state.error}
          </p>
        )}

        <Submit>Войти</Submit>
      </form>
    </div>
  );
}
