import type { ReactNode, Ref } from "react";
import { PersonFace } from "@/components/person/PersonFace";
import { yearsWord } from "@/lib/format";
import type { Gender } from "@/lib/types";

/**
 * Лицо панели деталей человека: поверхность, шапка (портрет, имя, годы и
 * возраст, место · поколение), чипы, ряд действий, «Открыть семейную ветку»,
 * вкладки и строки фактов.
 *
 * ВАЖНО: это единственное место, где описана внешность панели деталей. И
 * панель на холсте (Inspector), и превью в секции «Карточка» на главной
 * (app/page.tsx) обязаны собираться из этого компонента и его классов, а не
 * рисовать панель своей разметкой: иначе пример на главной снова разойдётся с
 * приложением — ровно на это и была жалоба владельца.
 *
 * Здесь только внешность: данные приходят пропсами, а действия и содержимое
 * вкладок — слотами (`actions`, `branch`, `children`, `footer`), поэтому
 * Inspector передаёт сюда настоящие кнопки, меню и вкладки, а главная —
 * декоративные. Своего состояния у компонента нет: активной вкладкой управляет
 * вызывающий; без `onTabChange` вкладки рисуются некликабельными — так их
 * показывает главная.
 *
 * Модуль без React Flow и без "use client": его одинаково берут и клиентский
 * Inspector, и серверная главная, поэтому библиотека холста на главную не
 * попадает (её тянут TreeCanvas и PersonNode, а не панель деталей).
 *
 * Что осталось внутри Inspector и почему: состояние (выделение, вкладка, меню),
 * расчёт родни и поколений, вкладки «Семья» и «История» (они про данные: чипы
 * родни кликают по холсту, история — список правок) и нижний лист как таковой
 * (его геометрию Inspector отдаёт наверх через onSheetMetrics). Разметка шапки,
 * чипов, ряда действий, вкладок и строк фактов отсюда больше не дублируется.
 */

/**
 * Поверхность панели деталей. На телефоне — нижний лист, который поднят над
 * нижней панелью действий (её высота 58px + отступ 12px + зазор) и учитывает
 * системный отступ снизу: иначе на телефоне с полосой-индикатором док заезжал
 * бы на лист. На десктопе — парящая стеклянная панель справа поверх холста:
 * холст при этом на всю ширину окна, а место под панель учитывает только
 * «уместить» (см. TreeCanvas).
 *
 * Стекло — общий токен `--p-glass` (0.72) и на телефоне, и на десктопе:
 * раньше лист брал `--p-glass-2` (0.94) и читался непрозрачной заливкой.
 * Прокрутка: на телефоне лист целиком (`overflow-y-auto`) — на низких экранах
 * фиксированные ряды выше `max-h`, и `overflow-hidden` срезал вкладки и низ
 * карточки. На десктопе прокручивается только тело раздела.
 *
 * Потолок высоты листа — 56% холста (было 46%): на телефоне лист читался
 * приплюснутым, а список фактов и истории упирался в прокрутку на первом же
 * экране. Отсчёт идёт от высоты холста (окно без шапки), поэтому запас до
 * нижней панели остаётся и на низких экранах: 56% + 76px дока + зазор всегда
 * меньше высоты холста.
 */
const SURFACE_CORE =
  "flex flex-col gap-3 border border-[var(--p-line)] bg-[var(--p-glass)] backdrop-blur-[14px]";

/** поверхность инспектора: телефон — нижний лист, десктоп — панель справа */
export const PERSON_DETAILS_SURFACE = `absolute inset-x-0 bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 ${SURFACE_CORE} max-h-[56%] overflow-y-auto overscroll-contain rounded-[22px] p-4 pb-6 shadow-[var(--p-shadow-sheet)] sm:inset-x-auto sm:bottom-3 sm:right-3 sm:top-3 sm:max-h-none sm:w-[320px] sm:overflow-hidden sm:rounded-[20px] sm:p-3.5 sm:shadow-[var(--shadow-lift)]`;

/**
 * Та же поверхность в «десктопном» виде — для превью на главной. Панель стоит
 * в потоке (её увеличивает контейнер, .details-preview), а не прижата к правой
 * кромке холста, и высота у неё по содержимому: на холсте панель растянута от
 * `top-3` до `bottom-3`, потому что место под неё занимает холст. Остальные
 * классы — ровно те, что даёт `sm:`-ветка PERSON_DETAILS_SURFACE, иначе превью
 * разошлось бы с приложением.
 */
export const PERSON_DETAILS_PANEL_SURFACE = `${SURFACE_CORE} w-[320px] overflow-hidden overscroll-contain rounded-[20px] p-3.5 shadow-[var(--shadow-lift)]`;

/** Вкладка раздела: id — состояние вызывающего, label — надпись */
export type PersonDetailsTab<TId extends string = string> = { id: TId; label: string };

/** Строка факта: «Рождение» — «12.03.1934 · г. Вологда» */
export type PersonDetailsFact = { label: string; value: ReactNode };

export type PersonDetailsFaceProps<TId extends string = string> = {
  /** «Анна Ковалёва» — короткое имя, как на холсте */
  name: string;
  /** «1934–2011»; null — «Годы неизвестны» */
  years?: string | null;
  /** возраст: подпись «77 лет» достроит сам компонент */
  age?: number | null;
  /** «г. Вологда · II поколение» */
  place: string;
  /** портрет 52px — PersonDetailsPortrait или своя картинка */
  portrait?: ReactNode;
  /** чипы пола и поколения */
  chips?: ReactNode;
  /** ряд действий: акцентная кнопка, иконки, меню */
  actions?: ReactNode;
  /** «Открыть семейную ветку» */
  branch?: ReactNode;
  tabs: readonly PersonDetailsTab<TId>[];
  activeTab: TId;
  /** без обработчика вкладки рисуются декоративно (превью на главной) */
  onTabChange?: (id: TId) => void;
  /** содержимое активной вкладки; факты удобнее через PersonDetailsFacts */
  children?: ReactNode;
  /** подвал панели: подсказка о холсте (только Inspector) */
  footer?: ReactNode;
  /** класс поверхности; по умолчанию — поверхность инспектора */
  surfaceClassName?: string;
  /** подпись панели для незрячих */
  surfaceLabel?: string;
  /** ссылка на саму панель: Inspector меряет по ней нижний лист */
  surfaceRef?: Ref<HTMLElement>;
};

/**
 * Портрет-круг: фотография, иначе холстовый силуэт по полу, иначе инициалы.
 * Тот же портрет носят шапка панели деталей (52px) и чипы родни в инспекторе
 * (22–24px), поэтому живёт здесь, а не в Inspector. Силуэт рисует общий
 * PersonFace — тот же, что на карточке холста и в открытой карточке: вторая
 * копия заглушки недопустима.
 */
export function PersonDetailsPortrait({
  photoUrl,
  gender,
  initials,
  size = 52,
  isLiving = true,
}: {
  photoUrl?: string | null;
  gender?: Gender;
  initials?: string;
  size?: number;
  isLiving?: boolean;
}) {
  return (
    <PersonFace
      photoUrl={photoUrl}
      gender={gender}
      isLiving={isLiving}
      size={size}
      className="shrink-0"
      photoClassName="h-full w-full rounded-full"
      fallback={
        <span
          aria-hidden="true"
          className="grid h-full w-full place-items-center rounded-full bg-[var(--p-row-bg)] text-[10px] text-ink-500"
        >
          {initials}
        </span>
      }
    />
  );
}

/** Строка «подпись — значение»: факты и данные человека */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-t border-[var(--p-line-2)] py-2 first:border-t-0 first:pt-0">
      <span className="w-[74px] shrink-0 text-[12.5px] leading-5 text-ink-400">{label}</span>
      <span className="min-w-0 flex-1 text-[13px] leading-5 text-ink-700">{children}</span>
    </div>
  );
}

/**
 * Список фактов вкладки «Факты»: Рождение, Смерть, Брак, Отец, Мать — что
 * найдётся. Пустой список объясняет, где взять даты, — и на холсте, и на
 * главной одинаково.
 */
export function PersonDetailsFacts({
  rows,
  empty = "Дат и мест пока нет — их можно добавить в карточке человека.",
}: {
  rows: readonly PersonDetailsFact[];
  empty?: ReactNode;
}) {
  if (!rows.length) {
    return <p className="px-1 py-2 text-[12.5px] text-ink-400">{empty}</p>;
  }
  return (
    <div>
      {rows.map((row) => (
        <Row key={row.label} label={row.label}>
          {row.value}
        </Row>
      ))}
    </div>
  );
}

/** «Человек + плюс» — «Добавить родственника»: надписи у кнопки нет */
export function IconPersonPlus() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="7" cy="6.4" r="3.1" />
      <path d="M1.9 15.4c0-2.7 2.3-4.4 5.1-4.4.9 0 1.7.2 2.4.5" />
      <path d="M13.4 11.2v4.2M11.3 13.3h4.2" />
    </svg>
  );
}

/** Ветвь: карточка и её семья — «Открыть семейную ветку» */
export function IconBranch() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="6.5" y="2.5" width="5" height="4" rx="1" />
      <rect x="2.5" y="11.5" width="5" height="4" rx="1" />
      <rect x="10.5" y="11.5" width="5" height="4" rx="1" />
      <path d="M9 6.5v2.5M5 11.5V9h8v2.5" />
    </svg>
  );
}

/** Три точки — меню «…» с остальными действиями */
export function IconMore() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
      <circle cx="4" cy="9" r="1.5" />
      <circle cx="9" cy="9" r="1.5" />
      <circle cx="14" cy="9" r="1.5" />
    </svg>
  );
}

export function PersonDetailsFace<TId extends string = string>({
  name,
  years = null,
  age = null,
  place,
  portrait,
  chips,
  actions,
  branch,
  tabs,
  activeTab,
  onTabChange,
  children,
  footer,
  surfaceClassName = PERSON_DETAILS_SURFACE,
  surfaceLabel = "Инспектор выделенного человека",
  surfaceRef,
}: PersonDetailsFaceProps<TId>) {
  return (
    <aside ref={surfaceRef} aria-label={surfaceLabel} className={surfaceClassName}>
      <span
        aria-hidden="true"
        className="mx-auto h-1 w-10 shrink-0 rounded-full bg-[var(--p-line-3)] sm:hidden"
      />

      {/* Шапка: портрет, имя, годы, место и поколение, чипы */}
      <div className="flex shrink-0 items-start gap-3">
        {portrait}
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[17px] leading-tight text-ink-800">{name}</h3>
          <span className="mt-0.5 block text-[12.5px] text-ink-500">
            {years ?? "Годы неизвестны"}
            {age != null && (
              <span className="text-ink-400">
                {" "}
                · {age} {yearsWord(age)}
              </span>
            )}
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-ink-400">{place}</span>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">{chips}</div>
        </div>
      </div>

      {/* Действия: карточка, «Скрыть на холсте» иконкой, «Добавить родственника»
          и меню «…» — сюда их передаёт Inspector. */}
      <div className="flex shrink-0 items-center gap-2">{actions}</div>

      {/* Семья: отдельная страница ветки человека */}
      <div className="flex shrink-0 flex-col gap-2">{branch}</div>

      {/* Вкладки разделов. Без onTabChange (превью на главной) — некликабельные
          подписи: интерактив на главной не нужен. */}
      <div
        role={onTabChange ? "tablist" : undefined}
        aria-label="Разделы инспектора"
        className="flex shrink-0 gap-0.5 border-b border-[var(--p-line)]"
      >
        {tabs.map((item) => {
          const active = item.id === activeTab;
          const className = `-mb-px border-b-2 px-3 py-1.5 text-[13px] transition-colors ${
            active
              ? "border-brass-500 text-ink-800"
              : "border-transparent text-ink-400 hover:text-ink-700"
          }`;
          return onTabChange ? (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onTabChange(item.id)}
              className={className}
            >
              {item.label}
            </button>
          ) : (
            <span key={item.id} className={className}>
              {item.label}
            </span>
          );
        })}
      </div>

      {/* Содержимое раздела. На телефоне прокручивается сам лист целиком
          (см. PERSON_DETAILS_SURFACE): здесь высота по содержимому и никакого
          `overflow`, иначе высота схлопнулась бы в ноль. На десктопе прокрутка
          своя, а фиксированные ряды остаются на месте. */}
      <div className="flex-1 pr-0.5 sm:min-h-0 sm:overflow-x-hidden sm:overflow-y-auto">
        {children}
      </div>

      {footer}
    </aside>
  );
}
