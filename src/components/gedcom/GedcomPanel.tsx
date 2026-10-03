"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { exportTree, importGedcom } from "@/app/actions/gedcom";

/**
 * Обмен древами в формате GEDCOM: скачать файл или загрузить уже готовый.
 * Экспорт доступен всем участникам, импорт — владельцу и редакторам.
 * Поверхность (.panel) и заголовок раздела даёт страница настроек.
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

  const disabled = busy !== null || pending;

  return (
    <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
      {/* Скачать */}
      <section className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[15px] text-ink-800">Скачать древо</h3>
          <span className="studio-chip">экспорт</span>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-500">
          Файл можно открыть в другой генеалогической программе или сохранить как резервную
          копию.
        </p>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled}
          onClick={runExport}
          className="mt-4 w-full sm:mt-auto sm:w-auto sm:self-start"
        >
          {busy === "export" ? "Собираем…" : "Скачать GEDCOM"}
        </Button>
      </section>

      {/* Загрузить */}
      {canEdit && (
        <section className="flex min-w-0 flex-col border-t border-[var(--p-line)] pt-5 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] text-ink-800">Загрузить из GEDCOM</h3>
            <span className="studio-chip">импорт</span>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-500">
            Новые карточки добавятся к существующим, связи переносятся как есть. Большой файл
            может занять несколько секунд.
          </p>
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
            disabled={disabled}
            onClick={() => fileRef.current?.click()}
            className="mt-4 w-full sm:mt-auto sm:w-auto sm:self-start"
          >
            {busy === "import" ? "Импортируем…" : "Импорт из GEDCOM"}
          </Button>
        </section>
      )}
    </div>
  );
}
