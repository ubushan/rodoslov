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
    "aria-hidden": true,
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
        <path d="M5 2.5h5.5L13 5v10.5H5z" />
        <path d="M10.5 2.5V5H13M7 8.5h4M7 11.5h4" />
      </svg>
    );
  }
  if (theme === "auto") {
    return (
      <svg {...common}>
        <rect x="2.5" y="3.5" width="13" height="8.5" rx="1.5" />
        <path d="M6.5 15h5M9 12v3" />
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
  sepia: "Тема: сепия",
  auto: "Тема: как в системе",
};

/** «Как в системе» разрешается в конкретную палитру по настройке устройства. */
function resolve(key: ThemeKey): Exclude<ThemeKey, "auto"> {
  if (key !== "auto") return key;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Выбор темы. Хранится в куке, поэтому сервер сразу отдаёт нужную палитру;
 * при выборе тема применяется тут же, без перезагрузки.
 *
 * На широком экране — ряд из четырёх иконок (`.icon-seg`), на телефоне —
 * одна кнопка-циклер «светлая → тёмная → сепия → как в системе» с иконкой
 * текущей темы: так шапка не занимает пол-экрана и название древа помещается.
 * `tone` оставлен для шапок на тёмной «обложке» (лендинг, вход).
 */
export function ThemeSwitcher({ tone = "cover" }: { tone?: "cover" | "plain" }) {
  const [choice, setChoice] = useState<ThemeKey>(DEFAULT_THEME);
  // актуальный выбор для обработчиков, которые не должны переподписываться
  const choiceRef = useRef<ThemeKey>(DEFAULT_THEME);

  // куку читаем после монтирования: на сервере её в разметке нет
  useEffect(() => {
    const match = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`));
    const value = match ? decodeURIComponent(match[1]) : DEFAULT_THEME;
    if (THEMES.some((theme) => theme.key === value)) {
      choiceRef.current = value as ThemeKey;
      setChoice(value as ThemeKey);
    }
  }, []);

  // «как в системе» следит за prefers-color-scheme, пока выбран этот режим;
  // выбранную вручную тему подтверждаем на смену схемы — иначе слушатель из
  // корневого скрипта (он ставится один раз при загрузке со значением auto)
  // мог бы перекрасить страницу в светлую.
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      document.documentElement.dataset.theme =
        choiceRef.current === "auto"
          ? query.matches
            ? "dark"
            : "light"
          : choiceRef.current;
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  function apply(key: ThemeKey) {
    choiceRef.current = key;
    setChoice(key);
    document.cookie = `${THEME_COOKIE}=${key}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.dataset.theme = resolve(key);
  }

  /** Циклер телефона: следующий режим по порядку, по кругу. */
  function cycle() {
    const index = THEMES.findIndex((theme) => theme.key === choiceRef.current);
    apply(THEMES[(index + 1) % THEMES.length].key);
  }

  const next = THEMES[(THEMES.findIndex((theme) => theme.key === choice) + 1) % THEMES.length];

  const seg = `icon-seg ${tone === "cover" ? "icon-seg--cover" : ""}`;

  return (
    <>
      {/* Телефон: одна кнопка вместо ряда — иконка показывает текущую тему,
          подсказка называет её и следующий режим. */}
      <span className="md:hidden">
        <span className={seg}>
          <button
            type="button"
            onClick={cycle}
            aria-label={`${TITLE[choice]}. Переключить тему`}
            title={`${TITLE[choice]}. Дальше — ${TITLE[next.key].replace("Тема: ", "")}`}
            className="icon-seg__i"
          >
            <ThemeIcon theme={choice} />
          </button>
        </span>
      </span>

      {/* Десктоп: ряд из четырёх иконок, как было. */}
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
