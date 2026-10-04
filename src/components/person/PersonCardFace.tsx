import { PersonFace } from "@/components/person/PersonFace";
import type { Gender } from "@/lib/types";

/**
 * Лицо карточки человека: портрет кругом по центру верхней кромки, годы в
 * правом верхнем углу, имя по центру — то, что видно на древе.
 *
 * ВАЖНО: это единственное место, где описана внешность карточки. И холст
 * (PersonNode), и примеры на главной (мини-древо и превью в секции «Карточка»)
 * обязаны собираться из этого компонента и его токенов, а не рисовать карточку
 * своей разметкой: иначе пример на главной снова разойдётся с приложением —
 * ровно на это и была жалоба владельца.
 *
 * Здесь только визуальная часть карточки: ни Handles, ни обработчиков, ни
 * состояния. Поэтому компонент годится и для серверной страницы — React Flow,
 * который тянет PersonNode, на главную не попадает.
 *
 * Разметка ровно та же, что была телом .person-card в PersonNode:
 *   - диаметр портрета задаёт --face-size в .person-card: карточка, сетка и
 *     круг берут одно значение, поэтому круг можно растить, не трогая размеры;
 *   - годы лежат в углу вне сетки: в своей строке над портретом они отнимали бы
 *     у круга высоту, а в общей — наезжали бы на него;
 *   - кромку пола по низу рисует .person-card::after по --card-accent, цвет
 *     задаёт класс is-male / is-female.
 */
export type PersonCardFaceProps = {
  /** «Мария Ковалёва» — короткое имя, как на холсте */
  name: string;
  /** «1889–1954», «1974»; null — угол пустой */
  years?: string | null;
  gender?: Gender;
  /** жив ли человек: у умершего портрет приглушён */
  isLiving?: boolean;
  /** главная фотография; без неё — силуэт по полу (.card-face) */
  photoUrl?: string | null;
  /** добавка к классам карточки: курсор, анимация появления и т.п. */
  className?: string;
};

export function PersonCardFace({
  name,
  years = null,
  gender = "unknown",
  isLiving = true,
  photoUrl = null,
  className = "",
}: PersonCardFaceProps) {
  // кромка по низу и свечение выделения — по полу: значения заданы токенами
  // темы, поэтому карточка читается и в тёмной, и в светлой
  const genderClass = gender === "male" ? "is-male" : gender === "female" ? "is-female" : "";

  return (
    <div
      className={`person-card studio-card ${genderClass} relative grid h-[100px] w-[176px] grid-cols-1 grid-rows-[var(--face-size)_auto] content-start justify-items-center px-2.5 pb-2 pt-2 ${className}`}
    >
      {/* портрет кругом --face-size по центру карточки — фото или силуэт по
          полу. Обе ветки и приглушение умершего рисует PersonFace — тот же
          общий компонент, что и в открытой карточке, панели деталей и палитре:
          своей разметки силуэта здесь больше нет. */}
      <PersonFace
        photoUrl={photoUrl}
        gender={gender}
        isLiving={isLiving}
        className="col-start-1 row-start-1 justify-self-center"
        photoClassName="h-[var(--face-size)] w-[var(--face-size)] rounded-full border border-[var(--p-line)]"
        crossOrigin
      />

      {/* годы — правый верхний угол, моноширинным набором. Кегль 10px и воздух
          сверху: у самой кромки цифры липли к рамке и спорили с портретом. */}
      {years && (
        <span className="absolute right-2.5 top-[7px] font-mono text-[10px] leading-none tabular-nums text-ink-400">
          {years}
        </span>
      )}

      {/* имя — во всю ширину, по центру, до двух строк. Три строки с крупным
          портретом в 100px карточки не влезают: третья уходила бы под кромку
          пола. 1px нижнего отступа расширяет область обрезки клэмпа, а
          отрицательный margin его компенсирует — хвосты букв не срезаются. */}
      <span className="col-span-1 col-start-1 row-start-2 line-clamp-2 -mb-px w-full pb-px text-center font-display text-[14px] font-medium leading-[1.2] tracking-[-0.01em] text-ink-800 [overflow-wrap:anywhere]">
        {name}
      </span>
    </div>
  );
}
