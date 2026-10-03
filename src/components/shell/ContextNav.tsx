"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Разделы древа: как в прототипе, ряд открывает «Древа» — общий список,
 * дальше холст (корень древа), люди и история правок. Участников в ряду нет:
 * состав древа — строка «Участники и доступ» в меню аккаунта.
 */
const TREE_SECTIONS = [
  { tail: "", label: "Холст" },
  { tail: "/people", label: "Люди" },
  { tail: "/history", label: "История" },
] as const;

/** Идентификатор древа из адреса: null, если пользователь вне /tree/<id>. */
export function useTreeId(): string | null {
  const pathname = usePathname() ?? "";
  const match = pathname.match(/^\/tree\/([^/]+)/);
  return match ? match[1] : null;
}

function useActiveSection(treeId: string | null) {
  const pathname = usePathname() ?? "";
  if (!treeId) return null;
  if (pathname.startsWith(`/tree/${treeId}/people`)) return "/people";
  if (pathname.startsWith(`/tree/${treeId}/history`)) return "/history";
  // «Участники» больше не вкладка, а строка в меню аккаунта: в ряду разделов
  // ничего не подсвечиваем
  if (pathname.startsWith(`/tree/${treeId}/settings`)) return "/settings";
  // личные страницы (person, branch) — часть холста
  return "";
}

/** Навигация по разделам: видна на широком экране, «Древа» — всегда. */
export function ContextNav() {
  const treeId = useTreeId();
  const active = useActiveSection(treeId);

  return (
    <nav aria-label="Разделы" className="hidden shrink-0 items-center gap-1 xl:flex">
      <Link
        href="/dashboard"
        aria-current={treeId ? undefined : "page"}
        className={`inline-flex h-8 shrink-0 items-center rounded-[9px] px-2.5 text-[13px] transition-colors ${
          treeId
            ? "border border-transparent text-ink-500 hover:bg-[var(--p-hover-bg)] hover:text-ink-800"
            : "border border-[var(--p-line)] bg-[var(--p-field-bg)] text-ink-800"
        }`}
      >
        Древа
      </Link>

      {treeId &&
        TREE_SECTIONS.map((section) => {
          const current = active === section.tail;
          return (
            <Link
              key={section.tail}
              href={`/tree/${treeId}${section.tail}`}
              aria-current={current ? "page" : undefined}
              className={`inline-flex h-8 items-center rounded-[9px] px-2.5 text-[13px] transition-colors ${
                current
                  ? "border border-[var(--p-line)] bg-[var(--p-field-bg)] text-ink-800"
                  : "border border-transparent text-ink-500 hover:bg-[var(--p-hover-bg)] hover:text-ink-800"
              }`}
            >
              {section.label}
            </Link>
          );
        })}
    </nav>
  );
}

/**
 * Те же разделы списком для меню/нижнего листа. Рендерится всегда: «Древа»
 * нужны и вне древа, а разделы древа появляются только внутри /tree/<id>.
 */
export function ContextLinks({ onNavigate }: { onNavigate?: () => void }) {
  const treeId = useTreeId();
  const active = useActiveSection(treeId);

  const links = [
    { href: "/dashboard", label: "Древа", current: !treeId },
    ...(treeId
      ? TREE_SECTIONS.map((section) => ({
          href: `/tree/${treeId}${section.tail}`,
          label: section.label,
          current: active === section.tail,
        }))
      : []),
  ];

  return (
    <div className="mt-3">
      <p className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-400">
        {treeId ? "Разделы древа" : "Разделы"}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            aria-current={link.current ? "page" : undefined}
            className={`flex h-11 items-center justify-center rounded-xl border text-[14px] transition-colors ${
              link.current
                ? "border-[var(--p-acc-line)] bg-[var(--p-acc-bg)] font-semibold text-brass-ink"
                : "border-[var(--p-line)] bg-[var(--p-field-bg)] text-ink-700 hover:bg-[var(--p-hover-bg)]"
            }`}
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Лупа — та же иконка, что в прототипе и на холсте. */
function IconSearch() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <circle cx="9" cy="9" r="5.2" />
      <path d="M13 13l4 4" />
    </svg>
  );
}

const SEARCH_HINT = "Поиск по древу · ⌘K";

/**
 * Кнопка поиска в шапке приложения. Вне древа её нет; внутри древа она
 * работает по контракту с холстом: на самой странице холста шлёт событие
 * `studio:palette` (палитру открывает холст), на остальных страницах древа
 * ведёт на холст с `?palette=1` — там палитра открывается сразу.
 * На телефоне остаётся только иконка с подсказкой.
 */
export function TreeSearchButton() {
  const pathname = usePathname() ?? "";
  const treeId = useTreeId();

  if (!treeId) return null;

  const className =
    "inline-flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-[10px] border border-[var(--p-line)] bg-[var(--p-field-bg)] text-[13px] text-ink-500 transition-colors hover:border-[var(--p-line-3)] hover:bg-[var(--p-hover-bg)] hover:text-ink-800 sm:w-auto sm:justify-start sm:px-3";

  const body = (
    <>
      <IconSearch />
      <span className="hidden min-w-0 truncate sm:block">Поиск по древу</span>
      <span
        aria-hidden="true"
        className="hidden shrink-0 rounded-[6px] border border-b-2 border-[var(--p-line)] bg-[var(--p-row-bg)] px-1.5 py-px font-mono text-[11px] text-ink-500 sm:block"
      >
        ⌘K
      </span>
    </>
  );

  if (pathname === `/tree/${treeId}`) {
    return (
      <button
        type="button"
        onClick={() => window.dispatchEvent(new CustomEvent("studio:palette"))}
        aria-label={SEARCH_HINT}
        title={SEARCH_HINT}
        className={className}
      >
        {body}
      </button>
    );
  }

  return (
    <Link
      href={`/tree/${treeId}?palette=1`}
      aria-label={SEARCH_HINT}
      title={SEARCH_HINT}
      className={className}
    >
      {body}
    </Link>
  );
}
