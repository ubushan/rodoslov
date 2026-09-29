"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ActionResult } from "@/app/actions/admin";

/** Запуск действия панели: тост о результате и обновление данных страницы. */
export function useAdminAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<ActionResult>, onDone?: () => void) {
    startTransition(async () => {
      const result: ActionResult = await action().catch(() => ({
        error: "Не получилось. Попробуйте ещё раз.",
      }));
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.ok) toast.success(result.ok);
      onDone?.();
      router.refresh();
    });
  }

  return { pending, run };
}
