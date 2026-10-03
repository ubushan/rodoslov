"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { updateProfile } from "@/app/actions/auth";
import { Field, Input } from "@/components/ui/field";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-accent h-10 w-full sm:w-auto">
      {pending ? "Сохраняем…" : "Сохранить"}
    </button>
  );
}

export function ProfileForm({ fullName, email }: { fullName: string; email: string }) {
  const [state, action] = useActionState(updateProfile, null);

  useEffect(() => {
    if (state && !state.error) toast.success("Имя сохранено");
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={action} className="space-y-4">
      <Field label="Имя">
        <Input name="full_name" defaultValue={fullName} required />
      </Field>

      <Field label="Почта" hint="Адрес входа изменить нельзя">
        <Input defaultValue={email} disabled />
      </Field>

      <Submit />
    </form>
  );
}
