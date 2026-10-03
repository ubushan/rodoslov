"use client";

import { useReactFlow, useStore } from "@xyflow/react";

/** Стрелки внутрь — «уместить древо в окне», иконка как в прототипе */
function IconFit() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 8V4h4M16 12v4h-4M16 8V4h-4M4 12v4h4" />
    </svg>
  );
}

/** Кнопка панели масштаба: квадрат под иконку, подсветка при наведении */
const ZOOM_BTN =
  "grid h-8 w-8 place-items-center rounded-[9px] text-[17px] leading-none text-ink-500 transition-colors hover:bg-[var(--p-hover-bg)] hover:text-ink-800";

/**
 * Панель масштаба — вертикальная стеклянная, как в прототипе:
 * приблизить, отдалить, «уместить» и текущий уровень в процентах.
 * Стоит в левом нижнем углу, прямо над миникартой.
 *
 * `onFit` передаёт холст: он умеет оставлять место под парящий инспектор,
 * поэтому библиотечный fitView здесь не используется.
 */
export function StudioZoom({
  className = "",
  onFit,
}: {
  className?: string;
  onFit?: () => void;
}) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const zoom = useStore((state) => state.transform[2]);
  const fit = onFit ?? (() => fitView({ padding: 0.2, duration: 400 }));

  return (
    <div
      role="group"
      aria-label="Масштаб холста"
      className={`glass grid w-11 gap-1 p-[5px] ${className}`}
    >
      <button
        type="button"
        onClick={() => zoomIn({ duration: 200 })}
        aria-label="Приблизить"
        title="Приблизить"
        className={ZOOM_BTN}
      >
        +
      </button>
      <button
        type="button"
        onClick={() => zoomOut({ duration: 200 })}
        aria-label="Отдалить"
        title="Отдалить"
        className={ZOOM_BTN}
      >
        −
      </button>
      <button
        type="button"
        onClick={fit}
        aria-label="Уместить древо"
        title="Уместить древо"
        className={ZOOM_BTN}
      >
        <IconFit />
      </button>
      <span
        aria-hidden="true"
        className="pb-0.5 text-center font-mono text-[10px] tabular-nums text-ink-400"
      >
        {Math.round(zoom * 100)}%
      </span>
    </div>
  );
}
