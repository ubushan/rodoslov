"use client";

import { useEffect, useRef, useState } from "react";
import {
  DEFAULT_THEME,
  THEMES,
  THEME_COOKIE,
  resolveStoredTheme,
  type ThemeKey,
} from "@/lib/theme";

/** Значок темы: солнце для светлой, луна для тёмной. */
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
    "aria-hidden": true,
  };
  if (theme === "dark") {
    return (
      <svg {...common}>
        <path d="M15 11.2A6.2 6.2 0 0 1 6.8 3a6.5 6.5 0 1 0 8.2 8.2Z" />
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

/** Короткие подписи для title и aria-label — в интерфейсе текста нет. */
const TITLE: Record<ThemeKey, string> = {
  light: "Тема: светлая",
  dark: "Тема: тёмная",
};

/** Как назвать тему в винительном падеже: «переключить на тёмную». */
const TARGET: Record<ThemeKey, string> = {
  light: "светлую",
  dark: "тёмную",
};

/** Светлая ↔ тёмная: других тем нет. */
const other = (key: ThemeKey): ThemeKey => (key === "dark" ? "light" : "dark");

/**
 * Выбор темы. Хранится в куке, поэтому сервер сразу отдаёт нужную палитру;
 * при выборе тема применяется тут же, без перезагрузки.
 *
 * На широком экране — две иконки (`.icon-seg`): солнце и луна. На телефоне —
 * одна кнопка-переключатель между теми же двумя: так шапка не занимает
 * пол-экрана и название древа помещается. `tone` оставлен для шапок на
 * тёмной «обложке» (лендинг, вход).
 *
 * Кука старых версий («sepia», «auto») читается через `resolveStoredTheme`:
 * сепия показывается светлой, «как в системе» — по схеме устройства.
 */
export function ThemeSwitcher({ tone = "cover" }: { tone?: "cover" | "plain" }) {
  const [choice, setChoice] = useState<ThemeKey>(DEFAULT_THEME);
  // актуальный выбор для обработчиков, которые не должны переподписываться
  const choiceRef = useRef<ThemeKey>(DEFAULT_THEME);

  // куку читаем после монтирования: на сервере её в разметке нет
  useEffect(() => {
    const match = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`));
    const stored = match ? decodeURIComponent(match[1]) : null;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolved = resolveStoredTheme(stored, prefersDark);
    choiceRef.current = resolved;
    setChoice(resolved);
    // на сервере «auto» и «sepia» уже сведены к светлой — подтверждаем выбор
    document.documentElement.dataset.theme = resolved;
  }, []);

  function apply(key: ThemeKey) {
    choiceRef.current = key;
    setChoice(key);
    document.cookie = `${THEME_COOKIE}=${key}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.dataset.theme = key;
  }

  const next = other(choice);
  const seg = `icon-seg ${tone === "cover" ? "icon-seg--cover" : ""}`;

  return (
    <>
      {/* Телефон: одна кнопка вместо ряда — иконка показывает текущую тему,
          подсказка называет её и тему, на которую переключит. */}
      <span className="md:hidden">
        <span className={seg}>
          <button
            type="button"
            onClick={() => apply(next)}
            aria-label={`${TITLE[choice]}. Переключить на ${TARGET[next]}`}
            aria-pressed={choice === "dark"}
            title={`${TITLE[choice]}. Переключить на ${TARGET[next]}`}
            className="icon-seg__i"
          >
            <ThemeIcon theme={choice} />
          </button>
        </span>
      </span>

      {/* Десктоп: две иконки — светлая и тёмная. */}
      <span className="hidden md:inline-flex">
        <span role="group" aria-label="Тема оформления" className={seg}>
          {THEMES.map((theme) => (
            <button
              key={theme.key}
              type="button"
              onClick={() => apply(theme.key)}
              aria-pressed={theme.key === choice}
              aria-label={TITLE[theme.key]}
              title={TITLE[theme.key]}
              className="icon-seg__i"
            >
              <ThemeIcon theme={theme.key} />
            </button>
          ))}
        </span>
      </span>
    </>
  );
}
