"use client";

import { useCallback, useMemo } from "react";
import { useReactFlow, useStore } from "@xyflow/react";
import { CARD_W, CARD_H } from "@/lib/layout";
import type { Gender } from "@/lib/types";

/** Запас вокруг силуэта в мировых координатах — как поля прототипа. */
const PAD = 60;

/** Кромка карточки на миникарте: приглушённый цвет пола, как в прототипе */
function fillFor(gender: Gender | undefined) {
  const token =
    gender === "male" ? "--color-male" : gender === "female" ? "--color-female" : "--color-plain";
  return `color-mix(in srgb, var(${token}) 55%, transparent)`;
}

/**
 * Миникарта древа: стеклянная панель со скруглением, внутри — силуэт из
 * прямоугольников-карточек, приглушённых по полу, и рамка текущего вида.
 *
 * Своя, а не `<MiniMap />` из React Flow: у библиотечной серые квадраты,
 * белая подложка и системная рамка — они выбивались из студии. Здесь та же
 * геометрия, но в токенах темы. Клик по силуэту переносит холст в это место.
 */
export function StudioMinimap({ className = "" }: { className?: string }) {
  const nodes = useStore((state) => state.nodes);
  const transform = useStore((state) => state.transform);
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const { setCenter } = useReactFlow();

  // только карточки людей: служебные узлы-рамки в силуэт не входят
  const people = useMemo(() => nodes.filter((node) => node.type === "person"), [nodes]);

  // границы занятых карточек: по ним считается viewBox миникарты
  const box = useMemo(() => {
    if (!people.length) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const node of people) {
      const w = node.measured?.width ?? CARD_W;
      const h = node.measured?.height ?? CARD_H;
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + w);
      maxY = Math.max(maxY, node.position.y + h);
    }
    return {
      x: minX - PAD,
      y: minY - PAD,
      w: Math.max(1, maxX - minX + PAD * 2),
      h: Math.max(1, maxY - minY + PAD * 2),
    };
  }, [people]);

  // текущий вид холста в мировых координатах — рамка на миникарте
  const viewport = useMemo(() => {
    const [tx, ty, zoom] = transform;
    return { x: -tx / zoom, y: -ty / zoom, w: width / zoom, h: height / zoom };
  }, [transform, width, height]);

  // рамка вида нужна только тогда, когда в окно помещается не всё древо
  const showViewport = !!box && (viewport.w < box.w * 0.98 || viewport.h < box.h * 0.98);

  // клик по силуэту переносит холст в это место, не меняя масштаб
  const pick = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      if (!box) return;
      const rect = event.currentTarget.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = box.x + ((event.clientX - rect.left) / rect.width) * box.w;
      const y = box.y + ((event.clientY - rect.top) / rect.height) * box.h;
      setCenter(x, y, { zoom: transform[2], duration: 300 });
    },
    [box, setCenter, transform]
  );

  // силуэт карточек: пересобирается только при смене состава и геометрии.
  // Панорама и зум меняют только transform, поэтому 30 прямоугольников (а на
  // большом древе — сотни) не пересобираются на каждый кадр перетаскивания.
  const cards = useMemo(
    () =>
      people.map((node) => {
        const person = node.data?.person as { gender?: Gender } | undefined;
        const w = node.measured?.width ?? CARD_W;
        const h = node.measured?.height ?? CARD_H;
        return (
          <rect
            key={node.id}
            x={node.position.x}
            y={node.position.y}
            width={w}
            height={h}
            rx={14}
            style={{ fill: fillFor(person?.gender) }}
          />
        );
      }),
    [people]
  );

  return (
    <div className={`glass h-[120px] w-[200px] p-2 ${className}`}>
      {box ? (
        <svg
          viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="Миникарта древа: клик переносит холст"
          onClick={pick}
          className="block h-full w-full cursor-pointer"
        >
          {/* Рамка текущего вида — только когда древо больше окна: если видно
              всё, рамка совпадает с панелью и ничего не показывает */}
          {showViewport && (
            <rect
              x={viewport.x}
              y={viewport.y}
              width={viewport.w}
              height={viewport.h}
              rx={8}
              vectorEffect="non-scaling-stroke"
              style={{
                fill: "color-mix(in srgb, var(--color-brass-500) 12%, transparent)",
                stroke: "var(--p-acc-line)",
                strokeWidth: 1,
                strokeDasharray: "4 4",
              }}
            />
          )}
          {cards}
        </svg>
      ) : (
        <span className="grid h-full w-full place-items-center text-[11.5px] text-ink-400">
          Пусто
        </span>
      )}
    </div>
  );
}
