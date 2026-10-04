"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

/**
 * Пункт меню дока. Пункт с `checked` рисует отметку и получает aria-checked:
 * для одиночного выбора (вид) роль menuitemradio, для переключателя (фильтр) —
 * menuitemcheckbox. У обычных действий (экспорт, связь) роль menuitem.
 */
export type MenuOption = {
  id: string;
  label: string;
  /** текст подсказки (title) — нужен и активным, и выключенным пунктам */
  hint?: string;
  icon?: ReactNode;
  /** значение справа: счётчик людей у включённого фильтра */
  trailing?: ReactNode;
  checked?: boolean;
  role?: "menuitem" | "menuitemradio" | "menuitemcheckbox";
  disabled?: boolean;
  onSelect?: () => void;
};

/** Галочка выбранного пункта — та же латунь, что у активной кнопки дока */
function IconCheck() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M3.5 9.5 7 13l7.5-7.5" />
    </svg>
  );
}

type Box = { left: number; width: number; top: number; maxHeight: number };

/**
 * Кнопка с меню, выпадающим ВВЕРХ. Поверхность — та же стеклянная панель, что
 * у .studio-dock (класс .dock-menu: стекло, скругление, тень парящей панели).
 *
 * Поведение: меню выравнивается по кнопке и не выходит за экран; на узком
 * экране (до 480px) встаёт по центру над доком и занимает ширину экрана.
 * Закрывается по Esc, клику вне и выбору пункта; фокус уходит в меню и
 * возвращается на кнопку. Стрелки, Home/End — навигация, Tab — выход.
 * У кнопки aria-haspopup/aria-expanded, у меню role="menu", у выбранных
 * пунктов aria-checked.
 */
export function MenuButton({
  className,
  children,
  ariaLabel,
  title,
  pressed,
  disabled,
  options,
  menuLabel,
  note,
  width = 248,
}: {
  className: string;
  /** содержимое кнопки: иконка, подпись, значок-счётчик */
  children: ReactNode;
  ariaLabel?: string;
  title?: string;
  /** кнопка-переключатель: aria-pressed и латунная заливка (задаёт вызывающий) */
  pressed?: boolean;
  disabled?: boolean;
  options: MenuOption[];
  menuLabel: string;
  /** пояснение над пунктами: например, «Выберите ровно двух человек» */
  note?: string;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<Box | null>(null);
  const [focused, setFocused] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /** Пункты, которые можно выбрать с клавиатуры (выключенные пропускаем) */
  const enabled = useMemo(
    () => options.map((option, index) => ({ option, index })).filter(({ option }) => !option.disabled),
    [options]
  );

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    setBox(null);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  // Меню растёт вверх от кнопки: его нижняя кромка садится на 8px выше кнопки
  // (top + translateY(-100%)), ширина — по кнопке, на узком экране по центру,
  // высота ограничена местом до верха окна. Привязка к кнопке, а не к высоте
  // окна: транзиентное изменение вьюпорта не уводит меню за экран.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect || !rect.width) return;
      const vw = window.innerWidth;
      const gap = 8;
      // до sm док — телефонная пилюля: меню встаёт по центру и на всю ширину
      const narrow = vw < 640;
      const w = narrow ? vw - 16 : Math.max(180, Math.min(width, vw - 16));
      const left = narrow ? Math.round((vw - w) / 2) : Math.min(Math.max(8, rect.left), Math.max(8, vw - w - 8));
      // нижняя кромка — над кнопкой; если кнопка оказалась ниже экрана
      // (страница ветки длиннее окна), прижимаем меню к низу окна
      const top = Math.min(Math.max(8, rect.top - gap), Math.max(8, window.innerHeight - gap));
      setBox({
        left,
        width: w,
        top,
        maxHeight: Math.max(120, top - 8),
      });
    };
    place();
    window.addEventListener("resize", place);
    // capture: холст прокручивается внутри себя, обычного события на window мало
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, width]);

  // Фокус уходит в меню: на выбранный пункт, иначе на первый доступный. Если
  // доступных пунктов нет вовсе (например, «Связь» при трёх выбранных), фокус
  // остаётся на кнопке: Esc ловит слушатель документа ниже.
  useEffect(() => {
    if (!open) return;
    if (!enabled.length) return;
    const checked = options.findIndex((option) => option.checked && !option.disabled);
    const start = checked >= 0 ? checked : enabled[0].index;
    setFocused(start);
    const timer = window.setTimeout(() => itemRefs.current[start]?.focus(), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Esc закрывает меню и возвращает фокус на кнопку, даже если фокус не попал
  // внутрь меню (все пункты выключены).
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close(true);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, close]);

  // Клик вне меню и кнопки закрывает его. Слушаем capture: React Flow гасит
  // всплытие кликов по холсту.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
      setBox(null);
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [open]);

  const focusItem = (index: number) => {
    setFocused(index);
    itemRefs.current[index]?.focus();
  };

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
      return;
    }
    if (!enabled.length) return;
    const position = enabled.findIndex(({ index }) => index === focused);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem(enabled[(position + 1) % enabled.length].index);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem(enabled[(position - 1 + enabled.length) % enabled.length].index);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      focusItem(enabled[0].index);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      focusItem(enabled[enabled.length - 1].index);
      return;
    }
    if (event.key === "Tab") {
      // закрываем и отдаём фокус кнопке: дальше Tab идёт своим чередом
      close(true);
    }
  };

  const menu =
    open && box
      ? createPortal(
          // Внешний слой только позиционирует: top + translateY(-100%) ставит
          // нижнюю кромку меню над кнопкой. Анимация появления живёт на
          // внутреннем .dock-menu, иначе она перебила бы этот transform.
          <div
            ref={menuRef}
            style={{
              left: box.left,
              width: box.width,
              top: box.top,
              transform: "translateY(-100%)",
            }}
            className="fixed z-[1000]"
          >
            <div
              role="menu"
              aria-label={menuLabel}
              tabIndex={-1}
              onKeyDown={onMenuKeyDown}
              style={{ maxHeight: box.maxHeight }}
              className="dock-menu flex flex-col overflow-y-auto overscroll-contain p-1 focus:outline-none"
            >
              {note && (
                <p className="px-2.5 pb-1 pt-1.5 text-[11.5px] leading-snug text-ink-400">{note}</p>
              )}
              {options.map((option, index) => {
                const active = !!option.checked;
                const role = option.role ?? (option.checked !== undefined ? "menuitemradio" : "menuitem");
                return (
                  <button
                    key={option.id}
                    ref={(node) => {
                      itemRefs.current[index] = node;
                    }}
                    type="button"
                    role={role}
                    aria-checked={role === "menuitem" ? undefined : active}
                    aria-disabled={option.disabled || undefined}
                    tabIndex={index === focused ? 0 : -1}
                    title={option.hint}
                    onClick={() => {
                      if (option.disabled) return;
                      close(true);
                      option.onSelect?.();
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-[11px] px-2.5 py-2 text-left text-[13px] transition-colors focus-visible:bg-[var(--p-hover-bg)] focus-visible:outline-none ${
                      option.disabled
                        ? "cursor-default text-ink-300"
                        : active
                          ? "text-brass-ink hover:bg-[var(--p-hover-bg)]"
                          : "text-ink-700 hover:bg-[var(--p-hover-bg)]"
                    }`}
                  >
                    {option.icon && (
                      <span aria-hidden="true" className={`shrink-0 ${active ? "" : "text-ink-400"}`}>
                        {option.icon}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {option.trailing !== undefined && (
                      <span className="shrink-0 text-[12px] tabular-nums text-ink-400">{option.trailing}</span>
                    )}
                    {active && <IconCheck />}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close(false) : setOpen(true))}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-pressed={pressed}
        title={title}
        className={className}
      >
        {children}
      </button>
      {menu}
    </>
  );
}
