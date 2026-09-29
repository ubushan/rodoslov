import { Section, Notice, Badge } from "@/components/admin/ui";
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

export const metadata = { title: "Настройки — Родослов" };

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

  return (
    <div className="space-y-5">
      <Section
        title="Настройки платформы"
        hint="Действуют для всех древа и пользователей сразу."
      >
        {settingsReady ? (
          <SettingsForm
            allowSignups={settings.allowSignups}
            maxPersonsPerTree={settings.maxPersonsPerTree}
          />
        ) : (
          <div className="px-5 py-5">
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
        <ul className="divide-y divide-mist-200">
          {envAdmins.map((email) => (
            <li key={`env-${email}`} className="flex flex-wrap items-center gap-2 px-5 py-3">
              <span className="text-sm text-ink-800">{email}</span>
              <Badge tone="warn">из ADMIN_EMAILS</Badge>
              {email === me?.email && <Badge>это вы</Badge>}
            </li>
          ))}
          {[...ids].map((id) => (
            <li key={id} className="flex flex-wrap items-center gap-2 px-5 py-3">
              <span className="text-sm text-ink-800">{people.get(id)?.email ?? id}</span>
              <Badge tone="ok">назначен в панели</Badge>
              {id === me?.id && <Badge>это вы</Badge>}
            </li>
          ))}
          {envAdmins.length === 0 && ids.size === 0 && (
            <li className="px-5 py-4 text-sm text-ink-400">Администраторов пока нет.</li>
          )}
        </ul>

        <div className="border-t border-mist-200 px-5 py-4 text-[13px] leading-relaxed text-ink-500">
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
        <ul className="divide-y divide-mist-200 text-[13px]">
          <li className="flex items-center justify-between gap-3 px-5 py-3">
            <span className="text-ink-500">Проект Supabase</span>
            <span className="font-mono text-ink-700">{projectHost}</span>
          </li>
          <li className="flex items-center justify-between gap-3 px-5 py-3">
            <span className="text-ink-500">Ключ service_role</span>
            {hasServiceKey() ? <Badge tone="ok">подключён</Badge> : <Badge tone="danger">не задан</Badge>}
          </li>
          <li className="flex items-center justify-between gap-3 px-5 py-3">
            <span className="text-ink-500">Таблица администраторов</span>
            {tableReady ? <Badge tone="ok">есть</Badge> : <Badge tone="danger">нет</Badge>}
          </li>
          <li className="flex items-center justify-between gap-3 px-5 py-3">
            <span className="text-ink-500">Таблица настроек</span>
            {settingsReady ? <Badge tone="ok">есть</Badge> : <Badge tone="danger">нет</Badge>}
          </li>
        </ul>
      </Section>
    </div>
  );
}
