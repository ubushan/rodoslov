"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { ContextLinks } from "@/components/shell/ContextNav";
import { TreeMembers, useTreeContext } from "@/components/shell/TreeContext";
import { ROLE_LABEL } from "@/lib/format";

/** На широком экране — выпадающее меню, на телефоне — нижний лист. */
const WIDE = "(min-width: 768px)";

function UserIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="9" cy="6.3" r="3" />
      <path d="M3.4 15.4c.5-2.9 2.8-4.6 5.6-4.6s5.1 1.7 5.6 4.6" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M3 5.5h12M3 9h12M3 12.5h12" />
    </svg>
  );
}

/**
 * Меню аккаунта: на десктопе — список под кнопкой, на телефоне — нижний лист.
 * Внутри — разделы («Древа», «Холст», «Люди», «История»), участники древа,
 * профиль, админка и выход. Имени аккаунта и этих действий в самой шапке нет.
 */
export function AccountMenu({ name, isAdmin }: { name: string; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [wide, setWide] = useState(true);
  const boxRef = useRef<HTMLDivElement>(null);
  const tree = useTreeContext();

  useEffect(() => {
    const query = window.matchMedia(WIDE);
    const sync = () => setWide(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

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

  const close = () => setOpen(false);
  const item =
    "flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px] transition-colors";

  const sheet = (
    <div className="fixed inset-0 z-[60] flex items-end">
      <button
        type="button"
        aria-label="Закрыть меню"
        onClick={close}
        className="absolute inset-0 bg-scrim backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Меню аккаунта"
        className="studio-sheet relative w-full max-h-[86dvh] overflow-y-auto"
      >
        <p className="truncate text-[15px] text-ink-800">{name}</p>
        {tree && (
          <p className="mt-0.5 truncate text-[12.5px] text-ink-400">
            {tree.title} · {ROLE_LABEL[tree.role] ?? tree.role}
          </p>
        )}

        <ContextLinks onNavigate={close} />

        {tree && (
          <Link
            href={`/tree/${tree.id}/settings`}
            onClick={close}
            className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--p-line)] bg-[var(--p-field-bg)] px-3 py-2 text-[13px] text-ink-700 transition-colors hover:bg-[var(--p-hover-bg)]"
          >
            <span>Участники и доступ</span>
            <TreeMembers size="lg" link={false} />
          </Link>
        )}

        <div className="mt-3 grid gap-1">
          <Link href="/profile" onClick={close} className={`${item} text-ink-700 hover:bg-[var(--p-hover-bg)]`}>
            Профиль
          </Link>
          {isAdmin && (
            <Link href="/admin" onClick={close} className={`${item} text-ink-700 hover:bg-[var(--p-hover-bg)]`}>
              Админка
            </Link>
          )}
        </div>

        <form action={signOut} className="mt-3">
          <button
            type="submit"
            className="w-full rounded-xl border border-danger-line px-3 py-2.5 text-[14px] text-danger transition-colors hover:bg-danger-soft"
          >
            Выйти
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup={wide ? "menu" : "dialog"}
        aria-expanded={open}
        aria-label="Меню аккаунта"
        title="Меню аккаунта"
        className="icon-btn"
      >
        {wide ? <UserIcon /> : <MenuIcon />}
      </button>

      {open && wide && (
        <div
          role="menu"
          aria-label="Меню аккаунта"
          className="panel absolute right-0 z-50 mt-2 w-64 overflow-hidden p-2"
        >
          <p className="truncate px-3 py-2 text-[13px] text-ink-400">{name}</p>

          <ContextLinks onNavigate={close} />

          {/* Состав древа живёт только здесь: в шапке стопки аватаров больше
              нет, а на телефоне та же строка есть в нижнем листе. */}
          {tree && (
            <Link
              href={`/tree/${tree.id}/settings`}
              role="menuitem"
              onClick={close}
              className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--p-line)] bg-[var(--p-field-bg)] px-3 py-2 text-[13px] text-ink-700 transition-colors hover:bg-[var(--p-hover-bg)]"
            >
              <span>Участники и доступ</span>
              <TreeMembers size="md" link={false} />
            </Link>
          )}

          <div className="mt-3 grid gap-1 border-t border-[var(--p-line)] pt-2">
            <Link href="/profile" role="menuitem" onClick={close} className={`${item} text-ink-700 hover:bg-mist-100`}>
              Профиль
            </Link>

            {isAdmin && (
              <Link href="/admin" role="menuitem" onClick={close} className={`${item} text-ink-700 hover:bg-mist-100`}>
                Админка
              </Link>
            )}

            <form action={signOut}>
              <button type="submit" role="menuitem" className={`${item} text-danger hover:bg-danger-soft`}>
                Выйти
              </button>
            </form>
          </div>
        </div>
      )}

      {open && !wide && typeof document !== "undefined" && createPortal(sheet, document.body)}
    </div>
  );
}
