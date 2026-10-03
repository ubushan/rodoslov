"use client";

import { useState } from "react";
import { toast } from "sonner";

/**
 * Ссылка-приглашение на дашборде: моноширинная строка целиком и понятная
 * кнопка копирования. Своя, а не из «Участников и доступа», чтобы блок
 * «Древ» не зависел от чужой страницы.
 */
export function CopyInvite({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          toast.success("Ссылка скопирована");
          setTimeout(() => setCopied(false), 2000);
        } catch {
          toast.error("Скопируйте ссылку вручную: " + url);
        }
      }}
      className="flex h-9 w-full min-w-0 items-center gap-2 rounded-[10px] border border-[var(--p-line)] bg-[var(--p-field-bg)] px-3 text-left transition-colors hover:border-[var(--p-line-3)] hover:bg-[var(--p-hover-bg)]"
      title="Скопировать ссылку"
      aria-label={`Скопировать ссылку ${url}`}
    >
      <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-ink-600">{url}</span>
      <span className="shrink-0 text-[12px] font-medium text-brass-500">
        {copied ? "скопировано" : "копировать"}
      </span>
    </button>
  );
}
