"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Обзор" },
  { href: "/admin/users", label: "Пользователи" },
  { href: "/admin/trees", label: "Древа" },
  { href: "/admin/settings", label: "Настройки" },
];

export function AdminTabs() {
  const path = usePathname();

  return (
    <nav className="mt-5 flex flex-wrap gap-1 rounded-xl border border-mist-200 bg-surface p-1">
      {TABS.map((tab) => {
        const active = tab.href === "/admin" ? path === "/admin" : path.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-lg px-3.5 py-1.5 text-sm transition-colors ${
              active ? "bg-ink-800 text-mist-50" : "text-ink-600 hover:bg-mist-100"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
