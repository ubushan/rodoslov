"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signUp, signInWithGoogle } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

/** Знак Google: четыре цвета, читается и на светлой, и на тёмной панели. */
function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.42 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending} aria-busy={pending}>
      {pending ? "Создаём аккаунт…" : "Создать аккаунт"}
    </Button>
  );
}

export function SignupForm() {
  const [state, action] = useActionState(signUp, null);

  return (
    <div className="mt-7">
      <form action={signInWithGoogle}>
        <Button type="submit" variant="secondary" size="lg" className="w-full">
          <GoogleMark />
          Продолжить с Google
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-[var(--p-line)]" aria-hidden="true" />
        <span className="shrink-0 text-xs text-ink-400">или по почте</span>
        <span className="h-px flex-1 bg-[var(--p-line)]" aria-hidden="true" />
      </div>

      <form action={action} className="space-y-4">
        <Field label="Как вас зовут">
          <Input name="full_name" required autoComplete="name" placeholder="Мария Ковалёва" />
        </Field>

        <Field label="Электронная почта">
          <Input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="anna@gmail.com"
          />
        </Field>

        <Field label="Пароль" hint="Не короче 8 символов">
          <Input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </Field>

        {state?.error && (
          <p
            role="alert"
            className="rounded-[12px] border border-danger-line bg-danger-soft px-3.5 py-3 text-[13.5px] leading-relaxed text-danger-ink"
          >
            {state.error}
          </p>
        )}

        {state?.notice && (
          <p
            role="status"
            className="rounded-[12px] border border-ok-line bg-ok-soft px-3.5 py-3 text-[13.5px] leading-relaxed text-ok-ink"
          >
            {state.notice}
          </p>
        )}

        <Submit />
      </form>
    </div>
  );
}
