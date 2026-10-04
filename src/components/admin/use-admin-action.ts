"use client";

import { useCallback, useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/app/actions/admin";

/**
 * Запуск действия панели: тост о результате и обновление данных страницы.
 *
 * Отдельный `router.refresh()` здесь не нужен: каждое действие на сервере уже
 * зовёт `revalidatePath` для своих страниц, и Next прикладывает обновлённое
 * дерево к ответу самого действия. Лишний полный RSC-запрос только добавлял
 * задержку после нажатия.
 */
export function useAdminAction() {
  const [pending, startTransition] = useTransition();

  const run = useCallback(
    (action: () => Promise<ActionResult>, onDone?: () => void) => {
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
      });
    },
    [startTransition]
  );

  return { pending, run };
}
