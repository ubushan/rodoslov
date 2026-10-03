"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROLE_LABEL } from "@/lib/format";
import type { MemberRole } from "@/lib/types";
import { loadTreeContext } from "@/components/shell/tree-context-action";

/** Участник древа для стопки аватаров: id, имя и роль. */
export type TreeMember = { id: string; name: string; role: MemberRole };

/** Контекст древа, который серверный layout собрал по заголовку `x-pathname`. */
export type TreeContextData = {
  id: string;
  title: string;
  role: MemberRole;
  members: TreeMember[];
};

/** «Тест Torlmud» → «ТР»; для пустого имени — «?» */
function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

/** «1 участник», «3 участника», «5 участников» */
function membersWord(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "участник";
  return m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? "участника" : "участников";
}

/** Цвет кружка по роли — как в прототипе: владелец, редактор, зритель. */
const ROLE_BG: Record<MemberRole, string> = {
  owner: "bg-[var(--p-fill)]",
  editor: "bg-[var(--color-male)]",
  viewer: "bg-[#8b98b0]",
};

/** Подпись раздела для хлебных крошек — по адресу, без новых данных. */
function sectionLabel(pathname: string, treeId: string) {
  const rest = pathname.slice(`/tree/${treeId}`.length);
  if (rest.startsWith("/people")) return "Люди";
  if (rest.startsWith("/history")) return "История";
  if (rest.startsWith("/settings")) return "Участники и доступ";
  if (rest.startsWith("/person/")) return "Карточка";
  if (rest.startsWith("/branch/")) return "Ветка";
  return "Холст";
}

const TreeCtx = createContext<TreeContextData | null>(null);

/**
 * Контекст древа для шапки. Начальные данные приходят с сервера (layout читает
 * путь из `x-pathname`), а при переходах внутри приложения Next переиспользует
 * layout — тогда данные дочитывает read-only действие. Пока данные не совпадают
 * с адресом, шапка о древе молчит: показывать чужое древо хуже, чем ничего.
 */
export function TreeProvider({
  initial,
  children,
}: {
  initial: TreeContextData | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const treeId = pathname.match(/^\/tree\/([^/]+)/)?.[1] ?? null;
  const [tree, setTree] = useState<TreeContextData | null>(initial);

  useEffect(() => {
    if (!treeId) {
      setTree(null);
      return;
    }
    if (tree?.id === treeId) return;

    let alive = true;
    setTree(null);
    loadTreeContext(treeId)
      .then((data) => {
        if (alive) setTree(data);
      })
      .catch(() => {
        if (alive) setTree(null);
      });
    return () => {
      alive = false;
    };
  }, [treeId, tree?.id]);

  return (
    <TreeCtx.Provider value={tree?.id === treeId ? tree : null}>{children}</TreeCtx.Provider>
  );
}

/** Контекст текущего древа — для шапки и меню аккаунта. */
export function useTreeContext() {
  return useContext(TreeCtx);
}

/**
 * Хлебные крошки древа: название, раздел и роль — как в прототипе.
 * На телефоне видно только название (остальное — в меню), на широком
 * экране добавляются раздел и чип роли.
 */
export function TreeCrumbs() {
  const tree = useTreeContext();
  const pathname = usePathname() ?? "";
  if (!tree) return null;

  return (
    <span className="flex min-w-0 items-center gap-2 text-[13.5px] text-ink-500">
      <b className="min-w-0 truncate font-medium text-ink-800">{tree.title}</b>
      <span className="hidden min-w-0 items-center gap-2 md:flex">
        <i aria-hidden="true" className="not-italic text-ink-300">
          /
        </i>
        <span className="min-w-0 truncate">{sectionLabel(pathname, tree.id)}</span>
      </span>
      {/* обёртка, а не класс на .studio-chip: у него свой display, и Tailwind
          `hidden` его не перебьёт */}
      <span className="hidden shrink-0 xl:inline">
        <span className="studio-chip">{ROLE_LABEL[tree.role] ?? tree.role}</span>
      </span>
    </span>
  );
}

/**
 * Стопка аватаров участников древа — только для меню аккаунта (в шапке её
 * нет). Клик ведёт на «Участники и доступ» (`/tree/<id>/settings`). Показывается
 * только внутри своего древа, при переполнении — «+N». `link: false` — когда
 * стопка стоит внутри ссылки (строка в меню), чтобы не вкладывать ссылку в ссылку.
 */
export function TreeMembers({
  size = "md",
  link = true,
}: {
  size?: "md" | "lg";
  link?: boolean;
}) {
  const tree = useTreeContext();
  if (!tree) return null;
  return <MembersStack treeId={tree.id} members={tree.members} size={size} link={link} />;
}

function MembersStack({
  treeId,
  members,
  size,
  link,
}: {
  treeId: string;
  members: TreeMember[];
  size: "md" | "lg";
  link: boolean;
}) {
  if (members.length === 0) return null;

  const MAX = 4;
  const shown = members.slice(0, MAX);
  const rest = members.length - shown.length;
  const label = `Участники и доступ: ${members.length} ${membersWord(members.length)}`;
  const box =
    size === "lg" ? "h-[30px] w-[30px] text-[12px]" : "h-[26px] w-[26px] text-[11.5px]";

  const avatars = (
    <>
      {shown.map((member, index) => (
        <span
          key={member.id}
          className={`grid shrink-0 place-items-center rounded-full border-2 border-[var(--color-surface)] font-semibold text-[#10141c] ${ROLE_BG[member.role]} ${box} ${
            index === 0 ? "" : "-ml-2"
          }`}
        >
          {initials(member.name)}
        </span>
      ))}
      {rest > 0 && (
        <span
          className={`grid shrink-0 place-items-center rounded-full border-2 border-[var(--color-surface)] bg-[var(--p-field-bg)] font-medium text-ink-500 ${box} -ml-2`}
        >
          +{rest}
        </span>
      )}
    </>
  );

  // внутри строки-ссылки стопка — украшение: имя ссылки даёт сама строка
  if (!link) {
    return (
      <span aria-hidden="true" className="flex shrink-0 items-center">
        {avatars}
      </span>
    );
  }

  return (
    <Link
      href={`/tree/${treeId}/settings`}
      aria-label={label}
      title={label}
      className="flex shrink-0 items-center rounded-full"
    >
      {avatars}
    </Link>
  );
}
