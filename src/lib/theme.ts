/**
 * Темы оформления. Выбор хранится в куке, поэтому сервер сразу отдаёт нужную
 * палитру и страница не мигает светлым при загрузке.
 *
 * Тем ровно две — светлая и тёмная. Значения куки из прежних версий читаются
 * без поломки: «sepia» считается светлой, «auto» разрешается по схеме
 * устройства (в браузере это делает скрипт до отрисовки, на сервере — светлая).
 */

export const THEMES = [
  { key: "light", label: "Светлая", hint: "Холодный свет архива" },
  { key: "dark", label: "Тёмная", hint: "Для вечерней работы" },
] as const;

export type ThemeKey = (typeof THEMES)[number]["key"];

export const THEME_COOKIE = "theme";
export const DEFAULT_THEME: ThemeKey = "light";

export function isThemeKey(value: string | undefined | null): value is ThemeKey {
  return !!value && THEMES.some((theme) => theme.key === value);
}

/**
 * Разбор сохранённого значения в одну из двух тем. `prefersDark` — тёмная
 * схема устройства: её знает только браузер (`matchMedia`), поэтому на сервере
 * по умолчанию false, а до отрисовки тему уточняет скрипт из `app/layout.tsx`.
 */
export function resolveStoredTheme(
  value: string | undefined | null,
  prefersDark = false
): ThemeKey {
  if (isThemeKey(value)) return value;
  if (value === "auto") return prefersDark ? "dark" : "light";
  // «sepia», пустая и любая незнакомая кука — светлая: страница не ломается
  return DEFAULT_THEME;
}

/** Что подставить в data-theme на сервере: старые значения — как светлую. */
export function themeFromCookie(value: string | undefined): ThemeKey {
  return resolveStoredTheme(value, false);
}
