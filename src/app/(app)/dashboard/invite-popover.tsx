"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ROLE_LABEL } from "@/lib/format";
import { CopyInvite } from "./invite-copy";
import { expiryLabel, invitesWord, usesLabel, usesPercent } from "./overview";
import type { InviteItem } from "./blocks";

/*
 * Приглашения древа за кнопкой. Раньше список ссылок занимал половину карточки
 * древа и та выглядела пустой; теперь в карточке только кнопка со счётчиком, а
 * сам список раскрывается стеклянной панелью — той же поверхностью, что меню
 * дока (.glass: те же токены, скругление и тень).
 *
 * Поведение как у меню дока: открывается по клику, закрывается по Esc (фокус
 * возвращается на кнопку), клику вне и по переходу «Участники и доступ»;
 * фокус уходит внутрь панели. На широком экране панель прижата к кнопке
 * (снизу, а если снизу мало места — сверху) и не выходит за экран; на телефоне
 * встаёт листом по центру внизу, как меню дока, и шапку не перекрывает.
 *
 * Положение задаёт CSS от кнопки, а JS выбирает только сторону и предел
 * высоты: так панель остаётся приклеенной к кнопке при любой переверстке и
 * прокрутке. Данные и копирование — те же, что были в блоке, ничего не дублируем.
 */

/** Ниже этого предела панель не ужимаем — лучше прокрутка внутри */
const MIN_HEIGHT = 160;
/** До sm панель раскрывается листом внизу экрана */
const SHEET_RATIO = 0.6;

/** Звено цепи — знак ссылки-приглашения */
function IconInvite() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M8.4 11.6a3.2 3.2 0 0 0 4.5 0l3-3a3.2 3.2 0 0 0-4.5-4.5L10 5.5" />
      <path d="M11.6 8.4a3.2 3.2 0 0 0-4.5 0l-3 3a3.2 3.2 0 0 0 4.5 4.5L10 14.5" />
    </svg>
  );
}

/**
 * Кнопка «Приглашения · N» и раскрывающийся список активных ссылок древа.
 * Нет активных ссылок — кнопки нет вовсе: карточка не обещает того, чего нет.
 */
export function InvitePopover({
  treeId,
  items,
  more = 0,
}: {
  treeId: string;
  /** уже отфильтрованные активные ссылки древа (не больше трёх) */
  items: InviteItem[];
  /** сколько активных ссылок древа осталось за пределами панели */
  more?: number;
}) {
  const [open, setOpen] = useState(false);
  /** С какой стороны от кнопки раскрыта панель (на широком экране) */
  const [side, setSide] = useState<"below" | "above">("below");
  /** Предел высоты панели: остаток экрана, чтобы список прокручивался внутри */
  const [maxHeight, setMaxHeight] = useState<number | null>(null);
  /** Телефон: панель — лист по центру внизу, а не привязка к кнопке */
  const [narrow, setNarrow] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  /** панель одновременно и скролл-контейнер, и диалог: её же фокусируем */
  const panelRef = useRef<HTMLDivElement>(null);
  /** фокус ставим один раз на открытие, а не на каждый пересчёт */
  const focusedRef = useRef(false);
  const dialogId = useId();
  const total = items.length + more;

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  /**
   * Выбирает сторону и предел высоты. Место считаем от кнопки: снизу, если под
   * ней помещается весь список, иначе сверху — но всегда в пределах экрана.
   * `force` нужен, чтобы поменять сторону по кнопке.
   */
  const place = useCallback((force?: "above" | "below") => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const rect = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Снимок всей страницы (captureBeyondViewport) на миг ужимает вьюпорт до
    // 1×1: по такому размеру панель ужалась бы в ноль, поэтому пропускаем
    if (vw < 240 || vh < 240) return;

    const gap = 8;
    setNarrow(vw < 640);

    // scrollHeight скролл-контейнера — высота содержимого целиком, поэтому
    // замер не зависит от текущего предела высоты
    const natural = panel.scrollHeight;

    if (vw < 640) {
      // Телефон: лист у нижней кромки экрана, высота — доля окна
      setSide("below");
      setMaxHeight(Math.max(MIN_HEIGHT, Math.round(vh * SHEET_RATIO)));
      return;
    }

    // шапка приложения липкая: выше неё панель не поднимаем
    const header = document.querySelector("header");
    const limit = Math.max(0, (header?.getBoundingClientRect().bottom ?? 0) + gap);
    const spaceBelow = Math.max(0, vh - gap - rect.bottom - gap);
    const spaceAbove = Math.max(0, rect.top - gap - limit);
    const next =
      force ?? (spaceBelow >= natural || spaceBelow >= spaceAbove ? "below" : "above");
    setSide(next);
    setMaxHeight(Math.max(MIN_HEIGHT, Math.round(next === "below" ? spaceBelow : spaceAbove)));
  }, []);

  // Первая расстановка (до отрисовки) и пересчёт при прокрутке/повороте экрана
  useLayoutEffect(() => {
    if (!open) return;
    const reflow = () => place();
    place();
    window.addEventListener("resize", reflow);
    // capture: страница прокручивается и внутри вложенных контейнеров
    window.addEventListener("scroll", reflow, true);
    return () => {
      window.removeEventListener("resize", reflow);
      window.removeEventListener("scroll", reflow, true);
    };
  }, [open, place]);

  // Фокус уходит внутрь панели — ровно один раз на открытие: на первое
  // действие (как в меню дока), иначе на саму панель
  useEffect(() => {
    if (!open) {
      focusedRef.current = false;
      return;
    }
    if (focusedRef.current) return;
    focusedRef.current = true;
    const panel = panelRef.current;
    if (!panel) return;
    const first = panel.querySelector<HTMLElement>(
      'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    );
    (first ?? panel).focus({ preventScroll: true });
  }, [open]);

  // Esc закрывает панель и возвращает фокус на кнопку; клик вне — закрывает
  // (фокус возвращаем, только если он был внутри панели)
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close(true);
    };
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (popupRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      close(Boolean(panelRef.current?.contains(document.activeElement)));
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onDown, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onDown, true);
    };
  }, [open, close]);

  if (total === 0) return null;

  const panel = (
    <div
      id={dialogId}
      ref={panelRef}
      role="dialog"
      aria-label="Приглашения — ссылки для родных"
      tabIndex={-1}
      style={maxHeight ? { maxHeight } : undefined}
      className="glass flex flex-col overflow-y-auto overscroll-contain p-3 focus:outline-none"
    >
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <h3 className="text-[12.5px] font-medium text-ink-700">Ссылки для родных</h3>
        <span className="shrink-0 text-[11.5px] tabular-nums text-ink-400">
          {total} {invitesWord(total)}
        </span>
      </div>

      <ul className="grid min-w-0 grid-cols-1 gap-2.5">
        {items.map((invite) => {
          const used = Number(invite.uses ?? 0);
          const max =
            invite.max_uses === null || invite.max_uses === undefined
              ? null
              : Number(invite.max_uses);
          const percent = usesPercent(used, max);

          return (
            <li
              key={invite.id}
              className="min-w-0 rounded-[12px] border border-[var(--p-line)] bg-[var(--p-row-bg)] p-3"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="studio-chip">{ROLE_LABEL[invite.role] ?? invite.role}</span>
                <span className="studio-chip">{expiryLabel(invite.expires_at)}</span>

                <p className="ml-auto flex flex-wrap items-baseline gap-x-1.5">
                  <span className="font-mono text-[15px] leading-none tabular-nums text-ink-800">
                    {used}
                  </span>
                  <span className="text-[11.5px] leading-snug text-ink-400">
                    {usesLabel(used, max)}
                  </span>
                </p>
              </div>

              {percent !== null && (
                <div
                  aria-hidden="true"
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--p-line)]"
                >
                  <span
                    className="block h-full rounded-full bg-[linear-gradient(90deg,var(--p-brass-600),var(--p-brass-400))]"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              )}

              <div className="mt-2.5">
                <CopyInvite url={invite.url} />
              </div>
            </li>
          );
        })}
      </ul>

      {more > 0 && (
        <p className="mt-2.5 px-1 text-[12px] leading-snug text-ink-400">
          Ещё {more} {invitesWord(more)} — в разделе «Участники и доступ»
        </p>
      )}

      <Link
        href={`/tree/${treeId}/settings`}
        onClick={() => close(false)}
        className="mt-3 flex items-center justify-between gap-2 rounded-[11px] border border-[var(--p-line)] bg-[var(--p-field-bg)] px-3 py-2 text-[12.5px] font-medium text-brass-500 transition-colors hover:border-[var(--p-line-3)]"
      >
        Участники и доступ <span aria-hidden="true">→</span>
      </Link>
    </div>
  );

  return (
    <div ref={popupRef} className="relative w-fit max-w-full">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close(true) : setOpen(true))}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        className="inline-flex h-9 max-w-full items-center gap-2 rounded-full border border-[var(--p-acc-line)] bg-[var(--p-acc-bg)] px-3.5 text-[13px] font-medium text-brass-ink transition-colors hover:border-[var(--p-line-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-acc-line)]"
        title="Ссылки-приглашения в это древо"
      >
        <IconInvite />
        <span className="min-w-0 truncate">Приглашения</span>
        <span className="shrink-0 tabular-nums text-ink-500">· {total}</span>
      </button>

      {open &&
        (narrow ? (
          // Телефон: лист по центру внизу — как меню дока, шапку не задевает
          <div
            className="fixed inset-x-2 z-20"
            style={{ bottom: "calc(8px + env(safe-area-inset-bottom))" }}
          >
            {panel}
          </div>
        ) : (
          // Широкий экран: панель прижата к кнопке и растёт от неё вниз или вверх
          <div
            className="absolute right-0 z-20 w-[348px] max-w-[calc(100vw-24px)]"
            style={side === "below" ? { top: "calc(100% + 8px)" } : { bottom: "calc(100% + 8px)" }}
          >
            {panel}
          </div>
        ))}
    </div>
  );
}
