import Link from "next/link";
import { TorlmudMark } from "@/components/brand/TorlmudMark";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { MiniTree } from "@/components/landing/MiniTree";
import {
  IconBranch,
  IconMore,
  IconPersonPlus,
  PERSON_DETAILS_PANEL_SURFACE,
  PersonDetailsFace,
  PersonDetailsFacts,
  PersonDetailsPortrait,
} from "@/components/person/PersonDetailsFace";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

const STEPS = [
  {
    title: "Создайте древо и добавьте себя",
    text: "Одна карточка — один человек. ФИО, год рождения, место, фотография. Остальное можно дополнить позже.",
  },
  {
    title: "Пришлите ссылку родным",
    text: "Родственник открывает ссылку, входит и сразу видит древо. Вы решаете, кто может менять карточки, а кто только смотреть.",
  },
  {
    title: "Соберите общую картину",
    text: "Правки родных появляются у вас без обновления страницы. Готовое древо скачивается картинкой — распечатать или отправить в семейный чат.",
  },
];

const ROLES = [
  {
    role: "Владелец",
    can: "Приглашает и удаляет участников, переименовывает и удаляет древо, плюс всё, что может редактор.",
  },
  {
    role: "Редактор",
    can: "Добавляет и меняет карточки, строит и разрывает связи, загружает фотографии и документы.",
  },
  {
    role: "Зритель",
    can: "Смотрит древо, открывает карточки и скачивает картинку. Ничего не меняет.",
  },
];

const CARD_FIELDS = [
  ["Имя и даты", "ФИО, девичья фамилия, другие варианты написания, годы жизни"],
  ["География", "Место рождения и место проживания"],
  ["Портрет", "Главная фотография, которая видна прямо на древе"],
  ["История", "Биография, заметки, устные семейные воспоминания"],
  ["Архив", "Сканы свидетельств, писем, справок и дополнительные снимки"],
];

/**
 * Пример панели деталей для секции «Карточка» — та же панель, что открывается
 * на холсте по клику на карточку. Данные статичные и осмысленные: Анна
 * Ковалёва, 1934–2011, Вологда, II поколение — та же семья, что в мини-древе
 * выше. Вкладка «Факты» — потому что панель на холсте открывается на ней.
 */
const DETAILS_TABS = [
  { id: "facts", label: "Факты" },
  { id: "family", label: "Семья" },
  { id: "history", label: "История" },
] as const;

const DETAILS_FACTS = [
  { label: "Рождение", value: "12.03.1934 · г. Вологда" },
  { label: "Брак", value: "Пётр Ковалёв (1931–2004)" },
];

/**
 * Размер сцены превью в масштабе 1 — панель настоящая, 320px (ширина панели на
 * десктопе), и увеличивается целиком через transform: scale, как мини-древо.
 * Высоту блока приходится задавать числом: transform размеров в раскладке не
 * меняет, а место под панель занять надо. 345px — высота панели с шапкой, рядом
 * действий, веткой, вкладками и двумя строками фактов (замер на 1440px). Нижнее
 * поле взято с запасом: на телефоне у панели появляется ручка нижнего листа, и
 * панель становится выше на 16px. Если содержимое примера поменяется, высоту
 * нужно померить заново: иначе низ панели срежет overflow-hidden.
 */
const PANEL_W = 320;
const PANEL_H = 345;
const STAGE_PAD_X = 4;
const STAGE_PAD_TOP = 4;
/** место под тень и под ручку нижнего листа, которая есть на телефоне */
const STAGE_PAD_BOTTOM = 24;
const STAGE_W = PANEL_W + STAGE_PAD_X * 2;
const STAGE_H = PANEL_H + STAGE_PAD_TOP + STAGE_PAD_BOTTOM;

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-brass-600">
    {children}
  </p>
);

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-dvh bg-mist-100">
      {/* ---------------- Шапка ---------------- */}
      <header
        className="absolute inset-x-0 top-0 z-20"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="grid h-9 w-9 place-items-center rounded-[10px] border border-brass-400/50 bg-white/[0.06] text-brass-400"
            >
              <TorlmudMark className="h-5 w-5" />
            </span>
            <span className="font-display text-[18px] text-album-text">Torlmud</span>
          </Link>

          <nav className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href="#how"
              className="hidden rounded-[10px] px-3 py-2 text-sm text-album-muted transition-colors hover:text-album-text md:block"
            >
              Как устроено
            </Link>
            <Link
              href="#card"
              className="hidden rounded-[10px] px-3 py-2 text-sm text-album-muted transition-colors hover:text-album-text md:block"
            >
              Карточка
            </Link>
            {user ? (
              <Link href="/dashboard">
                <Button size="md" className="min-h-[44px]">
                  Мои древа
                </Button>
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="inline-flex h-11 items-center rounded-[10px] px-3 text-sm text-album-muted transition-colors hover:text-album-text"
                >
                  Войти
                </Link>
                <Link href="/signup" className="hidden sm:block">
                  <Button size="md" className="min-h-[44px]">
                    Создать древо
                  </Button>
                </Link>
              </>
            )}
            <ThemeSwitcher />
          </nav>
        </div>
      </header>

      {/* ---------------- Герой ---------------- */}
      <section className="plate grain relative overflow-hidden">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-28 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:pb-28 lg:pt-36">
          <div className="rise">
            <p className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-brass-400">
              Семейный архив
            </p>

            <h1 className="mt-4 max-w-[16ch] font-display text-[clamp(2.15rem,6vw,4rem)] leading-[1.04] text-album-text">
              Семейное древо, которое собирают всей семьёй
            </h1>

            <p className="mt-6 max-w-[54ch] text-[16.5px] leading-relaxed text-album-muted">
              Бабушка помнит имена и деревни, дядя хранит фотографии, двоюродная сестра
              знает, кто на ком женился. Torlmud собирает эти кусочки в одно древо —
              открывайте доступ по ссылке и заполняйте его вместе.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href={user ? "/dashboard" : "/signup"}>
                <Button size="lg">{user ? "Открыть мои древа" : "Начать древо"}</Button>
              </Link>
              <Link href="#how">
                <Button
                  size="lg"
                  variant="ghost"
                  className="text-album-text hover:bg-white/10 hover:text-album-text"
                >
                  Посмотреть, как устроено
                </Button>
              </Link>
            </div>

            <p className="mt-6 text-sm text-album-muted">
              Бесплатно, без ограничения на число родственников в древе.
            </p>
          </div>

          <div className="lg:pl-4">
            <MiniTree />
          </div>
        </div>
      </section>

      {/* ---------------- Как устроено ---------------- */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-20 lg:py-28">
        <Eyebrow>Как устроено</Eyebrow>
        <h2 className="mt-3 max-w-[20ch] text-[clamp(1.75rem,3.6vw,2.6rem)] leading-tight text-ink-800">
          Три шага от первой карточки до готового древа
        </h2>

        <ol className="mt-11 grid gap-4 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="panel p-6">
              <span className="studio-chip">Шаг {i + 1}</span>
              <h3 className="mt-4 text-[19px] leading-snug text-ink-800">{s.title}</h3>
              <p className="mt-2.5 text-[15px] leading-relaxed text-ink-500">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---------------- Карточка человека ---------------- */}
      <section id="card" className="border-y border-[var(--p-line)] bg-mist-50">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 lg:grid-cols-2 lg:py-28">
          <div>
            <Eyebrow>Карточка</Eyebrow>
            <h2 className="mt-3 max-w-[18ch] text-[clamp(1.75rem,3.6vw,2.6rem)] leading-tight text-ink-800">
              Человек — это не только имя и даты
            </h2>
            <p className="mt-5 max-w-[56ch] text-[16.5px] leading-relaxed text-ink-500">
              В карточке хранится всё, что удалось выяснить: девичья фамилия, места, где
              человек жил, история, рассказанная за столом, и отсканированные документы.
              Незаполненные поля не мешают — их можно дописать, когда найдётся
              подтверждение.
            </p>

            <dl className="mt-9 space-y-4 text-[15px]">
              {CARD_FIELDS.map(([term, def]) => (
                <div key={term} className="flex gap-4 border-b border-[var(--p-line)] pb-4">
                  <dt className="w-32 shrink-0 font-medium text-ink-700">{term}</dt>
                  <dd className="text-ink-500">{def}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Превью панели деталей — ровно та панель, что открывается на холсте
              по клику на карточку: её рисует PersonDetailsFace, а не отдельная
              разметка примера (иначе главная снова разошлась бы с приложением).
              Панель настоящая, 320px: увеличивает её контейнер (.details-preview),
              поэтому кегли, чипы и кнопки — как на холсте.

              Интерактив на главной не нужен: обёртка с inert и aria-hidden
              делает кнопки примеров нефокусируемыми и некликабельными. */}
          <div className="relative">
            <div
              className="details-preview canvas-surface panel mx-auto w-fit max-w-full overflow-hidden p-0.5"
              style={{ borderColor: "var(--p-line-3)" }}
            >
              <div
                className="relative"
                style={{
                  width: `calc(${STAGE_W}px * var(--details-preview-scale))`,
                  height: `calc(${STAGE_H}px * var(--details-preview-scale))`,
                }}
              >
                <div
                  className="absolute left-0 top-0"
                  style={{
                    width: STAGE_W,
                    height: STAGE_H,
                    padding: `${STAGE_PAD_TOP}px ${STAGE_PAD_X}px ${STAGE_PAD_BOTTOM}px`,
                    transform: "scale(var(--details-preview-scale))",
                    transformOrigin: "top left",
                  }}
                  inert
                  aria-hidden="true"
                >
                  <PersonDetailsFace
                    surfaceClassName={PERSON_DETAILS_PANEL_SURFACE}
                    surfaceLabel="Панель деталей человека — пример"
                    name="Анна Ковалёва"
                    years="1934–2011"
                    age={77}
                    place="г. Вологда · II поколение"
                    portrait={<PersonDetailsPortrait gender="female" initials="АК" />}
                    chips={
                      <>
                        <span className="studio-chip">Женщина</span>
                        <span className="studio-chip">Поколение II</span>
                      </>
                    }
                    actions={
                      <>
                        <button
                          type="button"
                          tabIndex={-1}
                          className="btn-accent h-9 min-w-0 flex-1 text-[13px]"
                        >
                          Открыть карточку
                        </button>
                        <button
                          type="button"
                          tabIndex={-1}
                          aria-label="Добавить родственника"
                          className="icon-btn h-9 w-9 shrink-0"
                        >
                          <IconPersonPlus />
                        </button>
                        <button
                          type="button"
                          tabIndex={-1}
                          aria-label="Ещё действия"
                          className="icon-btn h-9 w-9 shrink-0"
                        >
                          <IconMore />
                        </button>
                      </>
                    }
                    branch={
                      <button
                        type="button"
                        tabIndex={-1}
                        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-[10px] border border-[var(--p-line)] bg-[var(--p-field-bg)] px-3 text-[13px] text-ink-600 transition-colors hover:bg-[var(--p-hover-bg)] hover:text-ink-800"
                      >
                        <IconBranch />
                        Открыть семейную ветку
                      </button>
                    }
                    tabs={DETAILS_TABS}
                    activeTab="facts"
                  >
                    <PersonDetailsFacts rows={DETAILS_FACTS} />
                  </PersonDetailsFace>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Совместная работа ---------------- */}
      <section className="mx-auto max-w-6xl px-5 py-20 lg:py-28">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <Eyebrow>Доступ</Eyebrow>
            <h2 className="mt-3 max-w-[18ch] text-[clamp(1.75rem,3.6vw,2.6rem)] leading-tight text-ink-800">
              Доступ по ссылке, права — на ваше усмотрение
            </h2>
            <p className="mt-5 max-w-[52ch] text-[16.5px] leading-relaxed text-ink-500">
              Создайте ссылку-приглашение, выберите роль и отправьте родственнику в
              мессенджер. Ссылку можно ограничить по сроку и числу переходов, а потом
              отозвать. Правки участников видны сразу, без перезагрузки страницы.
            </p>
          </div>

          <ul className="panel divide-y divide-[var(--p-line)] overflow-hidden">
            {ROLES.map((r) => (
              <li key={r.role} className="flex flex-col gap-1.5 p-6 sm:flex-row sm:gap-6">
                <span className="w-28 shrink-0 font-display text-[17px] text-ink-800">
                  {r.role}
                </span>
                <span className="text-[15px] leading-relaxed text-ink-500">{r.can}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------------- Экспорт и приватность ---------------- */}
      <section className="border-t border-[var(--p-line)] bg-mist-50">
        <div className="mx-auto grid max-w-6xl gap-4 px-5 py-20 md:grid-cols-2 lg:py-24">
          <div className="panel p-7">
            <span className="studio-chip">Экспорт</span>
            <h2 className="mt-4 text-[clamp(1.5rem,2.8vw,2rem)] leading-tight text-ink-800">
              Древо скачивается картинкой
            </h2>
            <p className="mt-4 max-w-[52ch] text-[16px] leading-relaxed text-ink-500">
              Одна кнопка — PNG в высоком разрешении со всем древом целиком, даже с той
              частью, что не помещается на экран. Подходит для печати на плакат и для
              отправки родным, у которых нет аккаунта.
            </p>
          </div>
          <div className="panel p-7">
            <span className="studio-chip">Приватность</span>
            <h2 className="mt-4 text-[clamp(1.5rem,2.8vw,2rem)] leading-tight text-ink-800">
              Никто посторонний не увидит
            </h2>
            <p className="mt-4 max-w-[52ch] text-[16px] leading-relaxed text-ink-500">
              Древо доступно только его участникам. Данные о живых родственниках не
              индексируются поисковиками и не показываются по прямой ссылке без входа в
              аккаунт.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------- Финальный призыв ---------------- */}
      <section className="plate grain relative overflow-hidden">
        <div className="mx-auto max-w-3xl px-5 py-24 text-center">
          <h2 className="mx-auto max-w-[20ch] font-display text-[clamp(1.9rem,4.4vw,3rem)] leading-tight text-album-text">
            Начните с себя — остальных добавят родные
          </h2>
          <div className="mt-9 flex justify-center">
            <Link href={user ? "/dashboard" : "/signup"}>
              <Button size="lg">{user ? "Открыть мои древа" : "Создать древо"}</Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-album-2 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 text-sm text-album-muted sm:flex-row">
          <span>Torlmud</span>
          <span>Семейный архив, который переживёт нас</span>
        </div>
      </footer>
    </div>
  );
}
