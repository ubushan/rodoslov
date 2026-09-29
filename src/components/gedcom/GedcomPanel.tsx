"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportTree, importGedcom } from "@/app/actions/gedcom";

/**
 * Обмен древами в формате GEDCOM: скачать файл или загрузить уже готовый.
 * Экспорт доступен всем участникам, импорт — владельцу и редакторам.
 */
export function GedcomPanel({ treeId, canEdit }: { treeId: string; canEdit: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"export" | "import" | null>(null);

  function runExport() {
    setBusy("export");
    startTransition(async () => {
      const result = await exportTree(treeId);
      setBusy(null);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const blob = new Blob([result.content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Файл GEDCOM скачан");
    });
  }

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const text = await file.text();
    setBusy("import");
    startTransition(async () => {
      const result = await importGedcom(treeId, text);
      setBusy(null);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.ok);
        router.refresh();
      }
    });
  }

  return (
    <div className="mt-4 grid gap-4 rounded-2xl border border-mist-200 bg-surface p-5">
      <p className="max-w-[62ch] text-sm leading-relaxed text-ink-500">
        GEDCOM — общий формат для обмена генеалогией: его понимают и другие программы.
        Скачанный файл можно открыть в них, а готовый — загрузить сюда.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" disabled={busy !== null || pending} onClick={runExport}>
          {busy === "export" ? "Собираем…" : "Скачать GEDCOM"}
        </Button>

        {canEdit && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept=".ged,text/plain"
              className="hidden"
              onChange={onFile}
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={busy !== null || pending}
              onClick={() => fileRef.current?.click()}
            >
              {busy === "import" ? "Импортируем…" : "Импорт из GEDCOM"}
            </Button>
          </>
        )}
      </div>

      {canEdit && (
        <p className="text-[12px] leading-relaxed text-ink-400">
          При импорте новые карточки добавляются к существующим, связи переносятся как есть.
          Если файл очень большой, это может занять несколько секунд.
        </p>
      )}
    </div>
  );
}
