"use client";

import type { ReactElement } from "react";

/**
 * Виды холста. «desc» — нисходящее (как было: предки сверху, поколения вниз),
 * «asc» — восходящее (корень внизу, поколения растут вверх), «lr» — «слева
 * направо» (поколения колонками: предки слева, потомки правее).
 *
 * Здесь остались только данные видов и иконки: отдельного переключателя в
 * верхнем углу холста больше нет — выбор переехал в меню кнопки «Вид» дока
 * (см. TreeCanvas). Файл переиспользован как содержимое этого меню.
 */
export type CanvasView = "desc" | "asc" | "lr";

export type CanvasViewInfo = {
  key: CanvasView;
  label: string;
  /** подсказка в title: чем режим отличается от соседнего */
  hint: string;
  icon: () => ReactElement;
};

/** Стрелка вниз к基线 — нисходящее: поколения идут вниз */
function IconDesc() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 2.8v9.2M5.4 8.4 9 12l3.6-3.6" />
      <path d="M3.2 15.4h11.6" />
    </svg>
  );
}

/** Стрелка вверх от基线 — восходящее: поколения растут вверх */
function IconAsc() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 15.2V6M5.4 9.6 9 6l3.6 3.6" />
      <path d="M3.2 2.6h11.6" />
    </svg>
  );
}

/** Стрелка вправо к базовой линии — «слева направо»: то же нисходящее, но повёрнутое */
function IconLeftRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.8 9h9.2M8.4 5.4 12 9l-3.6 3.6" />
      <path d="M15.4 3.2v11.6" />
    </svg>
  );
}

/** Порядок и подписи видов — их берёт меню кнопки «Вид» дока */
export const CANVAS_VIEWS: CanvasViewInfo[] = [
  { key: "desc", label: "Нисходящее", hint: "Нисходящее: предки сверху, поколения вниз", icon: IconDesc },
  { key: "asc", label: "Восходящее", hint: "Восходящее: корень внизу, поколения растут вверх", icon: IconAsc },
  { key: "lr", label: "Слева направо", hint: "Слева направо: предки слева, поколения — колонками вправо", icon: IconLeftRight },
];

/** Значение из localStorage может быть чем угодно — пускаем только свои */
export function isCanvasView(value: unknown): value is CanvasView {
  return value === "desc" || value === "asc" || value === "lr";
}
