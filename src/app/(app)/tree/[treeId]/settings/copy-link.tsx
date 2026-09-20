"use client";

import { useState } from "react";
import { toast } from "sonner";

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
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
      className="flex max-w-full items-center gap-2 rounded-lg bg-mist-100 px-2.5 py-1.5 text-[13px] text-ink-700 transition-colors hover:bg-mist-200"
      title="Скопировать ссылку"
    >
      <span className="truncate">{url}</span>
      <span className="shrink-0 text-ink-400">{copied ? "скопировано" : "копировать"}</span>
    </button>
  );
}
