"use client";

/**
 * Общие детали оформления панели администратора.
 *
 * Здесь же живут иконки строк и всплывающие меню действий: библиотеки иконок
 * в проекте нет, а панель — единственное место, где нужны иконочные кнопки.
 */

import { useEffect, useRef, useState } from "react";

/* ------------------------------------------------------------------ иконки */

type IconProps = { size?: number; className?: string };

function Glyph({ size = 16, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

export function IconUsers(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M16 19.5v-1.6a3.6 3.6 0 0 0-3.6-3.6H6.6A3.6 3.6 0 0 0 3 17.9v1.6" />
      <circle cx="9.5" cy="8" r="3.3" />
      <path d="M21 19.5v-1.5a3.5 3.5 0 0 0-2.7-3.4M15.8 5.1a3.3 3.3 0 0 1 0 6" />
    </Glyph>
  );
}

export function IconUser(p: IconProps) {
  return (
    <Glyph {...p}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20v-1.4a4.4 4.4 0 0 1 4.4-4.4h5.2a4.4 4.4 0 0 1 4.4 4.4V20" />
    </Glyph>
  );
}

export function IconTree(p: IconProps) {  return (
    <Glyph {...p}>
      <circle cx="12" cy="4.8" r="2" />
      <circle cx="5.6" cy="19.2" r="2" />
      <circle cx="18.4" cy="19.2" r="2" />
      <path d="M12 6.8v3.4a2 2 0 0 0 2 2h2.4a2 2 0 0 1 2 2v3" />
      <path d="M12 10.2a2 2 0 0 1-2 2H7.6a2 2 0 0 0-2 2v3" />
    </Glyph>
  );
}

export function IconLink(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M9.6 14.4 14.4 9.6" />
      <path d="m11.2 6.6 1.7-1.7a4 4 0 1 1 5.7 5.7l-1.7 1.7" />
      <path d="m12.8 17.4-1.7 1.7a4 4 0 0 1-5.7-5.7l1.7-1.7" />
    </Glyph>
  );
}

export function IconArchive(p: IconProps) {
  return (
    <Glyph {...p}>
      <rect x="3" y="4" width="18" height="4.2" rx="1.3" />
      <path d="M5 8.2v10.3A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V8.2" />
      <path d="M10 12.2h4" />
    </Glyph>
  );
}

export function IconMail(p: IconProps) {
  return (
    <Glyph {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2.2" />
      <path d="m4.2 7.4 6.9 4.9a1.6 1.6 0 0 0 1.8 0l6.9-4.9" />
    </Glyph>
  );
}

export function IconGrid(p: IconProps) {
  return (
    <Glyph {...p}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.7" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.7" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.7" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.7" />
    </Glyph>
  );
}

export function IconSliders(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M4 7.5h8M17 7.5h3M4 16.5h4M13 16.5h7" />
      <circle cx="14.5" cy="7.5" r="2.2" />
      <circle cx="10.5" cy="16.5" r="2.2" />
    </Glyph>
  );
}

export function IconLock(p: IconProps) {
  return (
    <Glyph {...p}>
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      <path d="M12 14.4v2.2" />
    </Glyph>
  );
}

export function IconUnlock(p: IconProps) {
  return (
    <Glyph {...p}>
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.2" />
      <path d="M8 10.5V8a4 4 0 0 1 7.6-1.7" />
      <path d="M12 14.4v2.2" />
    </Glyph>
  );
}

export function IconShield(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M12 3.5 19 6v5.4c0 4.3-2.8 7.5-7 9.1-4.2-1.6-7-4.8-7-9.1V6z" />
      <path d="m9.4 12 1.9 1.9 3.4-3.7" />
    </Glyph>
  );
}

export function IconShieldOff(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M12 3.5 19 6v5.4a9.6 9.6 0 0 1-2.2 6.1M12 20.5c-4.2-1.6-7-4.8-7-9.1V6l3-1.1" />
      <path d="m4.5 4.5 15 15" />
    </Glyph>
  );
}

export function IconTrash(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M4.5 7h15" />
      <path d="M9.5 7V5.6A1.6 1.6 0 0 1 11.1 4h1.8A1.6 1.6 0 0 1 14.5 5.6V7" />
      <path d="m6.6 7 .8 12.1A1.9 1.9 0 0 0 9.3 21h5.4a1.9 1.9 0 0 0 1.9-1.9L17.4 7" />
      <path d="M10.4 11v6M13.6 11v6" />
    </Glyph>
  );
}

export function IconBan(p: IconProps) {
  return (
    <Glyph {...p}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="m6.4 17.6 11.2-11.2" />
    </Glyph>
  );
}

export function IconPencil(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M4.5 19.5h3.3l9.3-9.3a2.3 2.3 0 0 0-3.3-3.3l-9.3 9.3z" />
      <path d="m13.6 7.8 2.6 2.6" />
    </Glyph>
  );
}

export function IconExternal(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M14 4.5h5.5V10" />
      <path d="M19.5 4.5 11.2 12.8" />
      <path d="M18 14.4v3.7a2.4 2.4 0 0 1-2.4 2.4H6.4A2.4 2.4 0 0 1 4 18.1V8.9a2.4 2.4 0 0 1 2.4-2.4H10" />
    </Glyph>
  );
}

export function IconCheck(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="m5 12.6 4.5 4.4L19 7.4" />
    </Glyph>
  );
}

export function IconX(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M6.2 6.2 17.8 17.8M17.8 6.2 6.2 17.8" />
    </Glyph>
  );
}

export function IconWarn(p: IconProps) {
  return (
    <Glyph {...p}>
      <path d="M12 4.4 21 19.6H3z" />
      <path d="M12 10v4.2M12 17.1v.2" />
    </Glyph>
  );
}

export function IconInfo(p: IconProps) {
  return (
    <Glyph {...p}>
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 11.2V16M12 8.1v.2" />
    </Glyph>
  );
}

/* ------------------------------------------------------------------- чипы */

export type ChipTone = "muted" | "accent" | "ok" | "warn" | "danger";

/**
 * Тона чипа: `.studio-chip` задаёт форму, а цвет состояния задаётся инлайном —
 * файл globals.css принадлежит другому агенту, трогать его нельзя.
 */
const CHIP_STYLE: Record<ChipTone, React.CSSProperties> = {
  muted: {},
  accent: {
    borderColor: "var(--p-acc-line)",
    background: "var(--p-acc-bg)",
    color: "var(--color-brass-ink)",
  },
  ok: {
    borderColor: "var(--color-ok-line)",
    background: "var(--color-ok-soft)",
    color: "var(--color-ok-ink)",
  },
  warn: {
    borderColor: "var(--p-acc-line)",
    background: "var(--p-acc-soft)",
    color: "var(--color-brass-ink)",
  },
  danger: {
    borderColor: "var(--color-danger-line)",
    background: "var(--color-danger-soft)",
    color: "var(--color-danger-ink)",
  },
};

export function Chip({
  children,
  tone = "muted",
  icon,
  title,
  className = "",
}: {
  children: React.ReactNode;
  tone?: ChipTone;
  icon?: React.ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <span className={`studio-chip max-w-full ${className}`} style={CHIP_STYLE[tone]} title={title}>
      {icon && <span className="shrink-0 opacity-90">{icon}</span>}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Прежнее имя чипа — оставлено, чтобы страницы читались привычно. */
export function Badge({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "ok" | "warn" | "danger";
}) {
  return <Chip tone={tone}>{children}</Chip>;
}

/* -------------------------------------------------------------- поверхности */

/** Блок контента: непрозрачная поверхность `.panel` с шапкой. */
export function Section({
  title,
  hint,
  children,
  action,
  className = "",
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[var(--p-line)] px-4 py-3 sm:px-5 sm:py-3.5">
        <div className="min-w-0">
          <h2 className="font-display text-[17px] leading-tight text-ink-800">{title}</h2>
          {hint && <p className="mt-0.5 text-[12.5px] leading-snug text-ink-400">{hint}</p>}
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>
      {children}
    </section>
  );
}

/** Плитка обзора: главная цифра крупно, подпись приглушённо. */
export function StatTile({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="panel flex min-w-0 flex-col gap-2 px-4 py-3.5">
      <p className="flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.09em] text-ink-400">
        {icon && <span className="shrink-0 text-brass-500">{icon}</span>}
        <span className="truncate">{label}</span>
      </p>
      <p className="font-display text-[28px] leading-none tabular-nums text-ink-800">{value}</p>
      {hint && <p className="text-[11.5px] leading-snug text-ink-400">{hint}</p>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-8 text-center text-[13px] text-ink-400">{children}</p>;
}

/** Заглушка вместо данных, когда панель ещё не настроена. */
export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn";
  title: string;
  children: React.ReactNode;
}) {
  const warn = tone === "warn";
  return (
    <div
      className="flex gap-3 rounded-[18px] border px-4 py-3.5 text-[13px] leading-relaxed"
      style={
        warn
          ? {
              borderColor: "var(--color-danger-line)",
              background: "var(--color-danger-soft)",
              color: "var(--color-danger-ink)",
            }
          : {
              borderColor: "var(--p-acc-line)",
              background: "var(--p-acc-soft)",
              color: "var(--color-ink-700)",
            }
      }
    >
      <span className="mt-0.5 shrink-0">{warn ? <IconWarn size={17} /> : <IconInfo size={17} />}</span>
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <div className="mt-1 space-y-1 [overflow-wrap:anywhere]">{children}</div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- меню действий */

export type MenuItem = {
  key: string;
  label: string;
  onSelect: () => void;
  icon?: React.ReactNode;
  tone?: "default" | "danger";
  current?: boolean;
  disabled?: boolean;
};

/**
 * Иконочная кнопка строки с раскрывающимся меню: так блокировка, права и
 * удаление остаются короткими в плотной таблице.
 *
 * Меню позиционируется по координатам кнопки и не вылезает за экран: у правого
 * края прижимается вправо, у нижнего — раскрывается вверх. Esc, клик мимо и
 * прокрутка закрывают его.
 */
export function RowMenu({
  label,
  icon,
  items,
  disabled,
  triggerClassName = "icon-btn",
  triggerStyle,
}: {
  label: string;
  icon: React.ReactNode;
  items: MenuItem[];
  disabled?: boolean;
  triggerClassName?: string;
  triggerStyle?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  function openMenu() {
    const rect = trigger.current?.getBoundingClientRect();
    if (rect) {
      const width = Math.min(236, window.innerWidth - 16);
      const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
      const estimated = items.length * 36 + 14;
      const below = rect.bottom + 6;
      const top =
        below + estimated > window.innerHeight - 8
          ? Math.max(8, rect.top - estimated - 6)
          : below;
      setCoords({ top, left, width });
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onDown = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  return (
    <div ref={root} className="flex-none">
      <button
        ref={trigger}
        type="button"
        className={`${triggerClassName} disabled:pointer-events-none disabled:opacity-40`}
        style={triggerStyle}
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
      >
        {icon}
      </button>

      {open && coords && (
        <div
          role="menu"
          aria-label={label}
          className="panel fixed z-40 p-1.5"
          style={{ top: coords.top, left: coords.left, width: coords.width, borderRadius: 14 }}
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={`flex w-full items-center gap-2 rounded-[9px] px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-[var(--p-hover-bg)] disabled:opacity-40 ${
                item.tone === "danger" ? "text-danger-ink" : "text-ink-700"
              }`}
            >
              <span className="flex w-4 shrink-0 justify-center opacity-80">
                {item.current ? <IconCheck size={14} /> : item.icon}
              </span>
              <span className="min-w-0 flex-1 whitespace-nowrap">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
