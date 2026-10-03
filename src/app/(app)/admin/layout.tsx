import { notFound } from "next/navigation";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { Chip, IconShield, Notice } from "@/components/admin/ui";
import { adminsTableReady, currentAdmin, hasServiceKey } from "@/lib/admin";

export const metadata = { title: "Администрирование — Torlmud" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await currentAdmin();
  // не администратору панель не показываем вовсе
  if (!admin) notFound();

  const serviceKey = hasServiceKey();
  const tableReady = serviceKey ? await adminsTableReady() : false;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-display text-[26px] leading-tight text-ink-800">Администрирование</h1>
          <p className="mt-1 max-w-[64ch] text-[13px] leading-snug text-ink-500">
            Пользователи, доступы и древа платформы. Вы вошли как{" "}
            <span className="text-ink-600 [overflow-wrap:anywhere]">{admin.email}</span>.
          </p>
        </div>
        <Chip tone="accent" icon={<IconShield size={13} />}>
          администратор
        </Chip>
      </div>

      <AdminTabs />

      <div className="mt-5 space-y-3 empty:hidden">
        {!serviceKey && (
          <Notice tone="warn" title="Панель не подключена к данным платформы">
            <p>
              Добавьте в <code className="font-mono">.env.local</code> переменную{" "}
              <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> — ключ{" "}
              <span className="font-mono">service_role</span> из Supabase → Project Settings → API.
              Он нужен, чтобы видеть все древа и управлять пользователями.
            </p>
            <p>
              Ключ читается только на сервере и в браузер не попадает. После правки окружения
              перезапустите приложение.
            </p>
          </Notice>
        )}
        {serviceKey && !tableReady && (
          <Notice tone="warn" title="Не хватает таблиц администраторов и настроек">
            <p>
              Выполните в Supabase → SQL Editor файл{" "}
              <code className="font-mono">supabase/admin.sql</code>. До этого работают обзор,
              пользователи и древа, а назначение администраторов из панели и настройки — нет.
            </p>
          </Notice>
        )}
      </div>

      <div className="mt-5">{children}</div>
    </div>
  );
}
