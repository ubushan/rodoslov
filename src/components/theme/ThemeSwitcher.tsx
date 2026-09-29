"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_THEME, THEMES, THEME_COOKIE, type ThemeKey } from "@/lib/theme";

/** Значок темы: солнце, луна, лист бумаги и монитор для «как в системе». */
function ThemeIcon({ theme }: { theme: ThemeKey }) {
  const common = {
    width: 17,
    height: 17,
    viewBox: "0 0 18 18",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (theme === "dark") {
    return (
      <svg {...common}>
        <path d="M15 11.2A6.2 6.2 0 0 1 6.8 3a6.5 6.5 0 1 0 8.2 8.2Z" />
      </svg>
    );
  }
  if (theme === "sepia") {
    return (
      <svg {...common}>
        <path d="M4.5 2.5h6.5l2.5 2.5v10.5h-9z" />
        <path d="M11 2.5V5h2.5M6.8 8.5h4.4M6.8 11.5h4.4" />
      </svg>
    );
  }
  if (theme === "auto") {
    return (
      <svg {...common}>
        <rect x="2.5" y="3.5" width="13" height="8.5" rx="1.5" />
        <path d="M6.5 15h5" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="9" cy="9" r="3.2" />
      <path d="M9 2.2v1.6M9 14.2v1.6M2.2 9h1.6M14.2 9h1.6M4.2 4.2l1.1 1.1M12.7 12.7l1.1 1.1M13.8 4.2l-1.1 1.1M5.3 12.7l-1.1 1.1" />
    </svg>
  );
}

/**
 * Выбор темы. Хранится в куке, поэтому сервер сразу отдаёт нужную палитру;
 * при выборе тема применяется тут же, без перезагрузки.
 */
export function ThemeSwitcher({ tone = "cover" }: { tone?: "cover" | "plain" }) {
  const [choice, setChoice] = useState<ThemeKey>(DEFAULT_THEME);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // куку читаем после монтирования: на сервере её в разметке нет
  useEffect(() => {
    const match = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`));
    const value = match ? decodeURIComponent(match[1]) : DEFAULT_THEME;
    if (THEMES.some((theme) => theme.key === value)) setChoice(value as ThemeKey);
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

  function apply(key: ThemeKey) {
    setChoice(key);
    setOpen(false);
    document.cookie = `${THEME_COOKIE}=${key}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.dataset.theme =
      key === "auto"
        ? window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light"
        : key;
  }

  const active = THEMES.find((theme) => theme.key === choice) ?? THEMES[0];
  const buttonTone =
    tone === "cover"
      ? "text-album-muted hover:bg-white/10 hover:text-album-text"
      : "text-ink-500 hover:bg-mist-100 hover:text-ink-800";

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Тема оформления: ${active.label}`}
        title={`Тема: ${active.label}`}
        className={`grid h-9 w-9 place-items-center rounded-lg transition-colors ${buttonTone}`}
      >
        <ThemeIcon theme={choice} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-xl border border-mist-200 bg-surface p-1 shadow-lift"
        >
          {THEMES.map((theme) => (
            <button
              key={theme.key}
              type="button"
              role="menuitemradio"
              aria-checked={theme.key === choice}
              onClick={() => apply(theme.key)}
              className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition-colors ${
                theme.key === choice ? "bg-mist-100" : "hover:bg-mist-100"
              }`}
            >
              <span className="mt-0.5 text-ink-500">
                <ThemeIcon theme={theme.key} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] text-ink-800">{theme.label}</span>
                <span className="block text-[12px] text-ink-400">{theme.hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
