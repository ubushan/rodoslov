"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconGrid, IconSliders, IconTree, IconUsers } from "./ui";

const TABS = [
  { href: "/admin", label: "Обзор", Icon: IconGrid },
  { href: "/admin/users", label: "Пользователи", Icon: IconUsers },
  { href: "/admin/trees", label: "Древа", Icon: IconTree },
  { href: "/admin/settings", label: "Настройки", Icon: IconSliders },
];

/** Разделы панели: ряд пилюль в студийном языке, активная — латунью. */
export function AdminTabs() {
  const path = usePathname() ?? "";

  return (
    <nav aria-label="Разделы админки" className="panel mt-5 flex w-full min-w-0 gap-1 p-1.5">
      {TABS.map((tab) => {
        const active = tab.href === "/admin" ? path === "/admin" : path.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            title={tab.label}
            aria-current={active ? "page" : undefined}
            className={`inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-2 rounded-[11px] border px-2 text-[13px] transition-colors sm:flex-none sm:px-3 ${
              active
                ? "border-[var(--p-acc-line)] bg-[var(--p-acc-bg)] font-semibold text-brass-ink"
                : "border-transparent text-ink-500 hover:bg-[var(--p-hover-bg)] hover:text-ink-800"
            }`}
          >
            <tab.Icon size={16} className="shrink-0" />
            <span className="truncate max-[520px]:hidden">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
