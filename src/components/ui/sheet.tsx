"use client";

import { useEffect } from "react";

/** Боковая панель редактирования. На узких экранах занимает весь экран. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Закрыть панель"
        onClick={onClose}
        className="absolute inset-0 bg-ink-900/35 backdrop-blur-[2px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex h-full w-full max-w-[420px] flex-col bg-surface shadow-plate sm:border-l sm:border-mist-200"
      >
        <header className="flex items-center justify-between border-b border-mist-200 px-5 py-4">
          <h2 className="text-lg text-ink-800">{title}</h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-ink-400 hover:bg-mist-100 hover:text-ink-700"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && (
          <footer className="border-t border-mist-200 bg-mist-50 px-5 py-4">{footer}</footer>
        )}
      </aside>
    </div>
  );
}
