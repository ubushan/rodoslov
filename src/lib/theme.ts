/**
 * Темы оформления. Выбор хранится в куке, поэтому сервер сразу отдаёт нужную
 * палитру и страница не мигает светлым при загрузке.
 */

export const THEMES = [
  { key: "light", label: "Светлая", hint: "Холодный свет архива" },
  { key: "dark", label: "Тёмная", hint: "Для вечерней работы" },
  { key: "sepia", label: "Сепия", hint: "Тёплая бумага альбома" },
  { key: "auto", label: "Как в системе", hint: "Следовать настройке устройства" },
] as const;

export type ThemeKey = (typeof THEMES)[number]["key"];

export const THEME_COOKIE = "theme";
export const DEFAULT_THEME: ThemeKey = "light";

export function isThemeKey(value: string | undefined | null): value is ThemeKey {
  return !!value && THEMES.some((theme) => theme.key === value);
}

/** Что подставить в data-theme на сервере: auto разрешает скрипт в браузере. */
export function themeFromCookie(value: string | undefined): ThemeKey {
  return isThemeKey(value) ? value : DEFAULT_THEME;
}
