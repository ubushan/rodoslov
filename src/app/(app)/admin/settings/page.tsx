import { Badge, Chip, IconCheck, IconWarn, Notice, Section } from "@/components/admin/ui";
import { SettingsForm } from "@/components/admin/SettingsForm";
import {
  adminClient,
  adminEmails,
  adminIds,
  adminsTableReady,
  currentAdmin,
  hasServiceKey,
  usersById,
} from "@/lib/admin";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Настройки — Torlmud" };

export default async function AdminSettingsPage() {
  const me = await currentAdmin();
  const settings = await getSettings();
  const tableReady = await adminsTableReady();

  const ids = tableReady ? await adminIds() : new Set<string>();
  const people = await usersById([...ids]);
  const envAdmins = adminEmails();

  const settingsReady = hasServiceKey()
    ? !(await adminClient().from("platform_settings").select("key").limit(0)).error
    : false;

  const projectHost = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host;
    } catch {
      return "не задан";
    }
  })();

  const checks: Array<[string, boolean, string, string]> = [
    ["Ключ service_role", hasServiceKey(), "подключён", "не задан"],
    ["Таблица администраторов", tableReady, "есть", "нет"],
    ["Таблица настроек", settingsReady, "есть", "нет"],
  ];

  return (
    <div className="space-y-5">
      <Section title="Настройки платформы" hint="Действуют для всех древ и пользователей сразу.">
        {settingsReady ? (
          <SettingsForm
            allowSignups={settings.allowSignups}
            maxPersonsPerTree={settings.maxPersonsPerTree}
          />
        ) : (
          <div className="px-4 py-4 sm:px-5 sm:py-5">
            <Notice tone="warn" title="Таблицы настроек нет">
              <p>
                Выполните <code className="font-mono">supabase/admin.sql</code> — после этого
                настройки можно будет менять здесь.
              </p>
            </Notice>
          </div>
        )}
      </Section>

      <Section
        title="Администраторы панели"
        hint="Полный доступ к пользователям, древам и настройкам платформы."
      >
        <ul className="divide-y divide-[var(--p-line-2)]">
          {envAdmins.map((email) => (
            <li
              key={`env-${email}`}
              className="flex flex-wrap items-center gap-2 px-4 py-3 last:rounded-b-[19px] sm:px-5"
            >
              <span className="min-w-0 [overflow-wrap:anywhere] text-[13.5px] text-ink-800">{email}</span>
              <Badge tone="warn">из ADMIN_EMAILS</Badge>
              {email === me?.email && <Badge>это вы</Badge>}
            </li>
          ))}
          {[...ids].map((id) => (
            <li
              key={id}
              className="flex flex-wrap items-center gap-2 px-4 py-3 last:rounded-b-[19px] sm:px-5"
            >
              <span className="min-w-0 [overflow-wrap:anywhere] text-[13.5px] text-ink-800">
                {people.get(id)?.email ?? id}
              </span>
              <Badge tone="ok">назначен в панели</Badge>
              {id === me?.id && <Badge>это вы</Badge>}
            </li>
          ))}
          {envAdmins.length === 0 && ids.size === 0 && (
            <li className="px-4 py-6 text-center text-[13px] text-ink-400 sm:px-5">
              Администраторов пока нет.
            </li>
          )}
        </ul>

        <div className="border-t border-[var(--p-line)] px-4 py-4 text-[12.5px] leading-relaxed text-ink-500 sm:px-5">
          <p className="font-medium text-ink-700">Как назначить первого администратора</p>
          <p className="mt-1">
            Проще всего — впишите свою почту в <code className="font-mono">ADMIN_EMAILS</code> в{" "}
            <code className="font-mono">.env.local</code> (несколько адресов — через запятую) и
            перезапустите приложение. Дальше права можно выдавать прямо на вкладке
            «Пользователи»: они сохранятся в таблице <code className="font-mono">admins</code>.
          </p>
        </div>
      </Section>

      <Section title="Состояние" hint="Что подключено в этом окружении.">
        <ul className="divide-y divide-[var(--p-line-2)] text-[13px]">
          <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 py-3 sm:px-5">
            <span className="text-ink-500">Проект Supabase</span>
            <span className="min-w-0 font-mono text-[12.5px] text-ink-700 [overflow-wrap:anywhere]">
              {projectHost}
            </span>
          </li>
          {checks.map(([label, ready, okLabel, noLabel]) => (
            <li
              key={label}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 py-3 last:rounded-b-[19px] sm:px-5"
            >
              <span className="text-ink-500">{label}</span>
              {ready ? (
                <Chip tone="ok" icon={<IconCheck size={13} />}>
                  {okLabel}
                </Chip>
              ) : (
                <Chip tone="danger" icon={<IconWarn size={13} />}>
                  {noLabel}
                </Chip>
              )}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
