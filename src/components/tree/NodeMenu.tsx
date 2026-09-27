"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * Всплывающее меню у карточки или у линии связи.
 * Рисуется порталом поверх холста, иначе React Flow обрежет его вьюпортом.
 * Закрывается по клику мимо, Escape и прокрутке; у triggers должно быть
 * stopPropagation на mousedown, чтобы меню не закрывалось своим же открытием.
 */
export function NodeMenu({
  x,
  y,
  above,
  onClose,
  children,
}: {
  x: number;
  y: number;
  above?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onWheel = () => onClose();
    // capture: React Flow гасит всплытие у кликов по холсту, обычный слушатель
    // на документе их не увидит и меню осталось бы висеть
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey);
    document.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("wheel", onWheel);
    };
  }, [onClose]);

  // на узком экране меню не должно вылезать за край
  const width = 196;
  const left =
    typeof window === "undefined"
      ? x
      : Math.min(Math.max(x, 8), Math.max(8, window.innerWidth - width - 8));

  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{ left, top: y, width, transform: above ? "translateY(-100%)" : undefined }}
      className="fixed z-[1000] rounded-xl border border-mist-200 bg-white p-1 shadow-plate"
    >
      {children}
    </div>,
    document.body
  );
}

/** Пункт меню: серый и некликабельный, если действие недоступно. */
export function MenuItem({
  label,
  hint,
  disabled,
  chevron,
  muted,
  onClick,
}: {
  label: string;
  hint?: string;
  disabled?: boolean;
  chevron?: boolean;
  muted?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      title={hint}
      onClick={() => {
        if (disabled) return;
        onClick?.();
      }}
      className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[13px] ${
        disabled
          ? "cursor-default text-ink-300"
          : muted
            ? "text-ink-400 hover:bg-mist-100"
            : "text-ink-700 hover:bg-mist-100"
      }`}
    >
      {label}
      {chevron && (
        <span aria-hidden="true" className="text-ink-300">
          ▸
        </span>
      )}
    </button>
  );
}
