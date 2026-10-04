import type { CSSProperties, ReactNode } from "react";
import type { Gender } from "@/lib/types";

/**
 * ЕДИНСТВЕННЫЙ стандарт портрета-заглушки во всём приложении.
 *
 * Есть фотография — показываем фотографию. Нет — рисуем тот же силуэт, что на
 * холсте: круг `.card-face` с фоном --p-face-bg, голова и плечи цветом пола.
 *
 * ВАЖНО: второй раз рисовать силуэт руками нельзя. Ровно из-за двух разных
 * заглушек (CSS-человечек на холсте против серых растровых картинок в открытой
 * карточке) владелец и увидел расхождение: «на карточках холста синий и
 * оранжевый человечки, а в открытой карточке — другие». Любой портрет в
 * приложении — карточка холста, шапка панели деталей, чипы родни, палитра ⌘K,
 * герой открытой карточки — обязан идти через этот компонент.
 *
 * Как это устроено:
 *   - класс пола (is-male / is-female) висит на обёртке: `.card-face` берёт
 *     цвет фигуры из предка (`--face: var(--color-male | --color-female)`),
 *     поэтому класс на самом круге не сработал бы;
 *   - диаметр круга задаёт `--face-size`: его можно передать числом (`size`)
 *     или классом в `className` (например, адаптивно
 *     `[--face-size:64px] sm:[--face-size:80px]`). На холсте размер просто
 *     наследуется от `.person-card`, поэтому там `size` не нужен;
 *   - размеры и форму рамки фотографии задаёт место: `photoClassName`
 *     (например, `h-full w-full rounded-full` внутри готового круга или
 *     `h-[var(--face-size)] w-[var(--face-size)]` на карточке холста);
 *   - у умершего (isLiving === false) и фото, и силуэт приглушены — ровно как
 *     было на холсте;
 *   - `fallback` — что показать вместо силуэта, если пол неизвестен (инициалы
 *     в панели деталей, иконка человека в палитре). Если `fallback` не задан,
 *     силуэт рисуется и при неизвестном поле — как на карточке холста.
 */
export type PersonFaceProps = {
  /** главная фотография; без неё — силуэт по полу (.card-face) */
  photoUrl?: string | null;
  gender?: Gender;
  /** жив ли человек: у умершего портрет приглушён, как на холсте */
  isLiving?: boolean;
  /** диаметр круга в px: задаёт --face-size и размеры обёртки */
  size?: number;
  /** классы обёртки: размещение в сетке/флексе, отступы, --face-size */
  className?: string;
  /** классы фотографии: размеры и форма рамки зависят от места */
  photoClassName?: string;
  /** запрашивать фото с CORS (нужно карточке холста для экспорта) */
  crossOrigin?: boolean;
  /** что показать вместо силуэта при неизвестном поле (инициалы, иконка) */
  fallback?: ReactNode;
  /** подпись для незрячих; пусто — портрет декоративен */
  alt?: string;
};

export function PersonFace({
  photoUrl = null,
  gender = "unknown",
  isLiving = true,
  size,
  className = "",
  photoClassName = "",
  crossOrigin = false,
  fallback = null,
  alt = "",
}: PersonFaceProps) {
  const genderClass = gender === "male" ? "is-male" : gender === "female" ? "is-female" : "";
  // --face-size отдаём и обёртке, и силуэту через наследование; width/height
  // обёртки нужны, чтобы фотография с h-full/w-full знала, от чего считаться
  const style = size
    ? ({ "--face-size": `${size}px`, width: size, height: size } as CSSProperties)
    : undefined;

  return (
    <span className={`${genderClass} ${className}`} style={style}>
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={alt}
          crossOrigin={crossOrigin ? "anonymous" : undefined}
          className={`block object-cover ${isLiving ? "" : "opacity-80 saturate-50"} ${photoClassName}`}
        />
      ) : fallback != null && gender === "unknown" ? (
        fallback
      ) : (
        <span
          aria-hidden="true"
          className={`card-face block ${isLiving ? "" : "opacity-70"}`}
        />
      )}
    </span>
  );
}
