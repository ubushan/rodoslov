import { PersonCardFace } from "@/components/person/PersonCardFace";
import { familyEdgeGeometry } from "@/components/tree/familyGeometry";
import { CARD_W, CARD_H } from "@/lib/place";
import type { Relationship } from "@/lib/types";

/**
 * Фрагмент древа на главной.
 *
 * ВАЖНО: пример обязан собираться из тех же компонентов и токенов, что и холст:
 * карточка — PersonCardFace, связи — familyEdgeGeometry (та чистая геометрия,
 * которой FamilyBusEdge рисует стебель, шину и отводы), размеры — CARD_W/CARD_H.
 * Своей разметки карточки, своей геометрии и своих цветов здесь быть не должно:
 * иначе пример снова разойдётся с приложением — ровно на это и была жалоба.
 *
 * Модуль серверный: ни React Flow, ни лишний клиентский JS на главную не
 * попадают, хотя пример и берёт геометрию холста — она вынесена в отдельный
 * чистый модуль без библиотеки холста (./tree/familyGeometry).
 *
 * Карточки настоящие, 176×100: фрагмент уменьшается целиком контейнером
 * (.mini-tree, transform: scale), а не подгонкой размеров карточек, поэтому
 * пропорции, кегли и кромка пола — как на холсте.
 *
 * Родство примера: Пётр и Анна Ковалёвы, их сын Сергей, внуки Мария и Артём.
 * Зазоры — как в автораскладке холста (NODE_GAP/RANK_GAP в lib/layout.ts).
 */

/** зазор между супругами в ряду — NODE_GAP автораскладки */
const COUPLE_GAP = 34;
/** зазор между поколениями — RANK_GAP автораскладки */
const RANK_GAP = 64;
/** ширина и высота фрагмента: три ряда по три карточки-места */
const FRAGMENT_W = CARD_W * 2 + COUPLE_GAP;
const FRAGMENT_H = CARD_H * 3 + RANK_GAP * 2;
/** поле вокруг фрагмента: тени карточек не должны обрезаться контейнером */
const PAD = 16;
/** размер сцены до масштабирования — её и уменьшает .mini-tree */
const STAGE_W = FRAGMENT_W + PAD * 2;
const STAGE_H = FRAGMENT_H + PAD * 2;

/** ось семьи: середина пары — на ней же стоит сын и его дети */
const AXIS = FRAGMENT_W / 2;

type ExamplePerson = {
  id: string;
  name: string;
  /** годы в том же виде, что печатает cardYears на холсте */
  years: string;
  gender: "male" | "female";
  isLiving: boolean;
  x: number;
  y: number;
};

const PEOPLE: ExamplePerson[] = [
  { id: "p1", name: "Пётр Ковалёв", years: "1931–2004", gender: "male", isLiving: false, x: 0, y: 0 },
  { id: "p2", name: "Анна Ковалёва", years: "1934–2011", gender: "female", isLiving: false, x: CARD_W + COUPLE_GAP, y: 0 },
  { id: "p3", name: "Сергей Ковалёв", years: "1958", gender: "male", isLiving: true, x: AXIS - CARD_W / 2, y: CARD_H + RANK_GAP },
  { id: "p4", name: "Мария Ковалёва", years: "1989", gender: "female", isLiving: true, x: 0, y: (CARD_H + RANK_GAP) * 2 },
  { id: "p5", name: "Артём Ковалёв", years: "1993", gender: "male", isLiving: true, x: CARD_W + COUPLE_GAP, y: (CARD_H + RANK_GAP) * 2 },
];

const at = (id: string) => {
  const person = PEOPLE.find((p) => p.id === id);
  if (!person) throw new Error(`мини-древо: нет карточки ${id}`);
  return person;
};

/** связи примера в том же виде, в каком их читает геометрия холста */
const RELATIONSHIPS: Pick<Relationship, "id" | "kind" | "from_person_id" | "to_person_id">[] = [
  { id: "s1", kind: "spouse", from_person_id: "p1", to_person_id: "p2" },
  { id: "c1", kind: "parent", from_person_id: "p1", to_person_id: "p3" },
  { id: "c2", kind: "parent", from_person_id: "p2", to_person_id: "p3" },
  { id: "c3", kind: "parent", from_person_id: "p3", to_person_id: "p4" },
  { id: "c4", kind: "parent", from_person_id: "p3", to_person_id: "p5" },
];

/** стебли, шины и отводы — ровно те же path, что FamilyBusEdge рисует на холсте */
const FAMILY_PATHS = [
  ...familyEdgeGeometry(RELATIONSHIPS, (id) => at(id), { horizontal: false, mirror: false }).values(),
].map((family) => family.d);

/** связь супругов: в вертикальном виде — прямой отрезок между боковыми кромками */
const SPOUSE_PATHS = RELATIONSHIPS.filter((r) => r.kind === "spouse").map((r) => {
  const from = at(r.from_person_id);
  const to = at(r.to_person_id);
  const [left, right] = from.x <= to.x ? [from, to] : [to, from];
  return `M ${left.x + CARD_W},${left.y + CARD_H / 2} H ${right.x}`;
});

export function MiniTree() {
  return (
    <div
      className="mini-tree canvas-surface panel mx-auto w-fit max-w-full overflow-hidden p-3"
      style={{ borderColor: "var(--p-line-3)" }}
    >
      <div
        className="relative"
        style={{
          width: `calc(${STAGE_W}px * var(--mini-tree-scale))`,
          height: `calc(${STAGE_H}px * var(--mini-tree-scale))`,
        }}
      >
        <div
          className="absolute left-0 top-0"
          style={{
            width: STAGE_W,
            height: STAGE_H,
            transform: "scale(var(--mini-tree-scale))",
            transformOrigin: "top left",
          }}
        >
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox={`${-PAD} ${-PAD} ${STAGE_W} ${STAGE_H}`}
            fill="none"
            aria-hidden="true"
          >
            {/* связь супругов — сплошная и тонкая, как --color-wire-bond на холсте */}
            {SPOUSE_PATHS.map((d) => (
              <path
                key={d}
                d={d}
                stroke="var(--color-wire-bond)"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            ))}
            {/* кровные связи — цвет и толщина линий холста, углы прямые со скруглением */}
            {FAMILY_PATHS.map((d) => (
              <path
                key={d}
                d={d}
                stroke="var(--color-canvas-line)"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </svg>

          {PEOPLE.map((person, index) => (
            <div
              key={person.id}
              className="rise absolute"
              style={{
                left: PAD + person.x,
                top: PAD + person.y,
                animationDelay: `${0.12 * index + 0.15}s`,
              }}
            >
              <PersonCardFace
                name={person.name}
                years={person.years}
                gender={person.gender}
                isLiving={person.isLiving}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
