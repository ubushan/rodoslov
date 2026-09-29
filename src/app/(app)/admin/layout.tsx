import { notFound } from "next/navigation";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { Notice } from "@/components/admin/ui";
import { adminsTableReady, currentAdmin, hasServiceKey } from "@/lib/admin";

export const metadata = { title: "Администрирование — Родослов" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await currentAdmin();
  // не администратору панель не показываем вовсе
  if (!admin) notFound();

  const serviceKey = hasServiceKey();
  const tableReady = serviceKey ? await adminsTableReady() : false;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[26px] leading-tight text-ink-800">Администрирование</h1>
          <p className="mt-1 text-sm text-ink-500">
            Пользователи, доступы и древа платформы. Вы вошли как {admin.email}.
          </p>
        </div>
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
