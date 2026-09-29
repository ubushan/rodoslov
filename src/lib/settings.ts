import { createClient } from "@/lib/supabase/server";

/**
 * Настройки платформы, которые правят в панели администратора.
 * Читаются обычным клиентом (политика разрешает select всем), поэтому
 * работают и до входа в аккаунт — например, чтобы закрыть регистрацию.
 */
export type PlatformSettings = {
  /** открыта ли регистрация новых пользователей */
  allowSignups: boolean;
  /** предел числа людей в одном древе, 0 — без предела */
  maxPersonsPerTree: number;
};

export const DEFAULT_SETTINGS: PlatformSettings = {
  allowSignups: true,
  maxPersonsPerTree: 0,
};

/** Настройки платформы. Если таблицы ещё нет — значения по умолчанию. */
export async function getSettings(): Promise<PlatformSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("platform_settings").select("key, value");
  if (error || !data) return DEFAULT_SETTINGS;

  const map = new Map(data.map((row) => [row.key as string, row.value as unknown]));
  const allow = map.get("allow_signups");
  const max = map.get("max_persons_per_tree");
  return {
    allowSignups: typeof allow === "boolean" ? allow : DEFAULT_SETTINGS.allowSignups,
    maxPersonsPerTree:
      typeof max === "number" && Number.isFinite(max) ? max : DEFAULT_SETTINGS.maxPersonsPerTree,
  };
}
