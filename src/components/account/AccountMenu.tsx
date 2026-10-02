"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "@/app/actions/auth";

/**
 * На телефоне в шапке остаётся одна кнопка: имя, админка и выход уезжают
 * в список, чтобы шапка не разрасталась.
 */
export function AccountMenu({ name, isAdmin }: { name: string; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] transition-colors";

  return (
    <div ref={boxRef} className="relative sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Аккаунт"
        title="Аккаунт"
        className="grid h-9 w-9 place-items-center rounded-lg text-album-muted transition-colors hover:bg-white/10 hover:text-album-text"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
          <circle cx="9" cy="6.3" r="3" />
          <path d="M3.4 15.4c.5-2.9 2.8-4.6 5.6-4.6s5.1 1.7 5.6 4.6" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-mist-200 bg-surface p-1 shadow-lift"
        >
          <p className="truncate px-3 py-2 text-[13px] text-ink-400">{name}</p>

          <Link href="/profile" role="menuitem" className={`${item} text-ink-700 hover:bg-mist-100`} onClick={() => setOpen(false)}>
            Профиль
          </Link>

          {isAdmin && (
            <Link href="/admin" role="menuitem" className={`${item} text-ink-700 hover:bg-mist-100`} onClick={() => setOpen(false)}>
              Админка
            </Link>
          )}

          <form action={signOut}>
            <button type="submit" role="menuitem" className={`${item} text-danger hover:bg-danger-soft`}>
              Выйти
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
