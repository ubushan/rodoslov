"use client";

import { useEffect } from "react";

/**
 * Панель редактирования: на десктопе — боковая, на телефоне — нижний лист
 * с ручкой (как в остальных оверлеях студии).
 */
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
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-stretch sm:justify-end">
      <button
        aria-label="Закрыть панель"
        onClick={onClose}
        className="absolute inset-0 bg-scrim backdrop-blur-[2px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[22px] border border-b-0 border-[var(--p-line)] bg-surface shadow-plate sm:h-full sm:max-h-none sm:max-w-[420px] sm:rounded-none sm:border-y-0 sm:border-r-0 sm:border-l"
      >
        <span aria-hidden="true" className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-mist-300 sm:hidden" />

        <header className="flex items-center justify-between gap-3 px-5 pb-3 pt-3 sm:border-b sm:border-[var(--p-line)] sm:py-4">
          <h2 className="font-display text-lg text-ink-800">{title}</h2>
          <button onClick={onClose} className="icon-btn" aria-label="Закрыть">
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer && (
          <footer
            className="border-t border-[var(--p-line)] bg-mist-50 px-5 py-4"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
          >
            {footer}
          </footer>
        )}
      </aside>
    </div>
  );
}
