"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useStore,
  getNodesBounds,
  getViewportForBounds,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toPng } from "html-to-image";
import { toast } from "sonner";

import { PersonNode } from "./PersonNode";
import { CouplePlate } from "./CouplePlate";
import { FamilyBusEdge, familyEdgeGeometry } from "./FamilyBusEdge";
import { StudioMinimap } from "./StudioMinimap";
import { StudioZoom } from "./StudioZoom";
import { CANVAS_VIEWS, isCanvasView, type CanvasView } from "./ViewSwitcher";
import { MenuButton } from "./DockMenu";
import { Inspector, generationMap, relationOptions, type InspectorChange } from "./Inspector";
import { CommandPalette, type PaletteAction } from "./CommandPalette";
import { createClient } from "@/lib/supabase/client";
import { peopleWord, publicUrl, shortName } from "@/lib/format";
import { autoLayout, CARD_W, CARD_H } from "@/lib/layout";
import type { NewRelative } from "@/lib/place";
import { maleLineIds } from "@/lib/maleLine";
import { THEMES, THEME_COOKIE, resolveStoredTheme } from "@/lib/theme";
import { createRelationship, deleteRelationship } from "@/app/actions/persons";
import { exportTree } from "@/app/actions/gedcom";
import type { Person, Relationship, Attachment, MemberRole } from "@/lib/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const nodeTypes = { person: PersonNode, couplePlate: CouplePlate };
const edgeTypes = { family: FamilyBusEdge };
/**
 * proOptions — константа, а не объект в JSX: новая ссылка на каждом рендере
 * холста заставляла React Flow перерисовывать всё дерево узлов и рёбер даже
 * тогда, когда менялось только состояние интерфейса (меню, палитра, лист).
 */
const PRO_OPTIONS = { hideAttribution: true };

/**
 * Сколько места справа занимает парящий инспектор (панель 320px + поля).
 * Учитывается только в «уместить»: холст при этом на всю ширину окна,
 * никакой подложки под панелью нет.
 */
const INSPECTOR_RESERVE = 344;

/**
 * Телефон: зазор между нижней кромкой выбранной карточки и верхней кромкой
 * нижнего листа инспектора, а также поле от верхней кромки холста. По ним
 * холст поднимает карточку в свободную область над листом (см. эффект
 * выравнивания ниже).
 */
const SHEET_GAP = 14;
const SHEET_TOP_MARGIN = 12;

/** Переезд холста: без анимации, если система просит поменьше движения */
function motionDuration(ms: number) {
  if (typeof window === "undefined") return ms;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : ms;
}

/* Кнопка дока действий: иконка и подпись столбиком, как в студийном доке.
   До 640px — пилюля телефона: шире в высоту, круглее, мельче подпись. */
const DOCK_BTN =
  "flex h-[46px] w-[62px] flex-col items-center justify-center gap-px rounded-full border border-transparent text-[9.5px] leading-tight text-ink-600 transition-colors hover:bg-[var(--p-hover-bg)] hover:text-ink-800 disabled:pointer-events-none disabled:opacity-45 max-[420px]:w-[56px] max-[420px]:text-[9px] sm:h-auto sm:w-[68px] sm:gap-0.5 sm:rounded-xl sm:py-1.5 sm:text-[10.5px]";
/* Включённый фильтр — латунная заливка с тёмным текстом */
const DOCK_BTN_ON = "border-[var(--p-acc-line)] bg-[var(--p-acc-bg)] text-brass-ink";

/* Иконки панели: тонкие штрихи, размер 18, цвет наследуется от кнопки */
function IconAdd() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M9 3.5v11M3.5 9h11" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2.5v9M5.5 8.5 9 12l3.5-3.5M3 15.5h12" />
    </svg>
  );
}

/** Стрелки наружу — кнопка раскрывает всё древо вместо ветки */
function IconExpand() {  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.8 3.5h3.7v3.7M14.5 3.5 9.8 8.2M7.2 14.5H3.5V10.8M3.5 14.5l4.7-4.7" />
    </svg>
  );
}

/** Мужской знак — чип «Мужская линия» */
function IconMaleLine() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.4" cy="10.6" r="4" />
      <path d="M10.3 7.7 14.8 3.2M14.8 3.2h-3.7M14.8 3.2v3.7" />
    </svg>
  );
}

/** Воронка — кнопка «Фильтр» в доке, как в прототипе */
function IconFilter() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4.6h12M5.5 9h7M7.5 13.4h3" />
    </svg>
  );
}

/** Вид холста — кнопка «Вид» дока: карточки-поколения друг под другом */
function IconView() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5.5" y="2.6" width="7" height="3.4" rx="1" />
      <rect x="1.8" y="11.9" width="6" height="3.4" rx="1" />
      <rect x="10.2" y="11.9" width="6" height="3.4" rx="1" />
      <path d="M9 6v2.6M4.8 11.9V8.6h8.4v3.3" />
    </svg>
  );
}

/** Файл — пункт «Экспорт в формате GEDCOM» */
function IconFile() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 2.5h5.2l3.8 3.8v9.2H4.5z" />
      <path d="M9.6 2.6v3.8h3.8" />
    </svg>
  );
}

/** Снять выделение */
function IconClose() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M5.5 5.5l7 7M12.5 5.5l-7 7" />
    </svg>
  );
}

/** Ветвь: карточка и её семья */
function IconBranch() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6.5" y="2.5" width="5" height="4" rx="1" />
      <rect x="2.5" y="11.5" width="5" height="4" rx="1" />
      <rect x="10.5" y="11.5" width="5" height="4" rx="1" />
      <path d="M9 6.5v2.5M5 11.5V9h8v2.5" />
    </svg>
  );
}

/** Два человека и связь между ними — кнопка «Связь» мультивыделения */
function IconRelation() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="4.6" cy="9" r="2.1" />
      <circle cx="13.4" cy="9" r="2.1" />
      <path d="M6.7 9h4.6" />
    </svg>
  );
}

/* Диаграммы предков («Веер» и «Часовая») удалены вместе с их данными и
   экспортом SVG: на холсте остались три вида — нисходящее, восходящее и
   «слева направо» (см. ViewSwitcher). */

type Props = {
  treeId: string;
  treeTitle: string;
  role: MemberRole;
  persons: Person[];
  relationships: Relationship[];
  attachments: Attachment[];
  /** последние правки карточек древа — раздел «История» в инспекторе */
  changes?: InspectorChange[] | null;
  /**
   * Оставлен для страницы ветки (чужой файл): раскладка теперь всегда
   * автоматическая и в базу не пишется, поэтому значение ни на что не влияет.
   */
  persistLayout?: boolean;
  /** на странице ветки — ссылка на всё древо: кнопка с расходящимися стрелками */
  wholeTreeHref?: string;
  /** на странице ветки — её родоначальник и число людей, не попавших в ветку */
  branchRoot?: { id: string; hidden: number };
  /**
   * Ключ вида холста в localStorage: `canvas-view:<userId>:<treeId>` — его
   * строит страница (см. tree/[treeId]/page.tsx), чтобы выбор вида был свой
   * у каждого пользователя и каждого древа. Пропа нет (страница ветки) —
   * вид не запоминается, но переключатель работает.
   */
  viewStorageKey?: string;
};

function Canvas({
  treeId,
  treeTitle,
  role,
  persons,
  relationships,
  attachments,
  changes = null,
  wholeTreeHref,
  branchRoot,
  viewStorageKey,
}: Props) {
  const router = useRouter();
  const canEdit = role === "owner" || role === "editor";
  const { getNodes, getNode, fitView, setCenter, getViewport, setViewport } = useReactFlow();
  // размеры области холста: по ним считаем «уместить» с запасом под инспектор
  const containerW = useStore((state) => state.width);
  const containerH = useStore((state) => state.height);

  const [exporting, setExporting] = useState(false);
  // фильтр мужской линии: только мужчины по крови от старшего предка
  const [maleLineOnly, setMaleLineOnly] = useState(false);
  // выделение на холсте: один или несколько человек (Shift + клик)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  /**
   * Геометрия нижнего листа инспектора на телефоне: верхняя кромка и высота
   * относительно холста. Отдаёт сам лист (Inspector) через ResizeObserver —
   * его высота зависит от содержимого, поэтому проценты не подходят. Лист
   * стоит над доком, так что учёт его кромки учитывает и высоту дока.
   */
  const sheetRef = useRef<{ top: number; height: number } | null>(null);
  // тик: лист доизмерился или изменился — будим эффект выравнивания
  const [sheetTick, setSheetTick] = useState(0);
  const onSheetMetrics = useCallback((metrics: { top: number; height: number } | null) => {
    const prev = sheetRef.current;
    if (!metrics) {
      if (!prev) return;
      sheetRef.current = null;
      setSheetTick((tick) => tick + 1);
      return;
    }
    if (prev && Math.abs(prev.top - metrics.top) < 1 && Math.abs(prev.height - metrics.height) < 1) {
      return;
    }
    sheetRef.current = metrics;
    setSheetTick((tick) => tick + 1);
  }, []);
  // «Скрыть на холсте» — только отображение, в базу ничего не пишется
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  // командная палитра: ⌘K, событие из шапки или ?palette=1
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  // ---- Вид холста: нисходящее · восходящее · слева направо ----
  // До чтения localStorage всегда нисходящее — так же отрисуется и на сервере.
  const [view, setView] = useState<CanvasView>("desc");
  /** восходящее: раскладка зеркалится по вертикали, шина идёт снизу вверх */
  const mirror = view === "asc";
  /** «слева направо»: раскладка повёрнута на 90°, шина идёт вертикально */
  const horizontal = view === "lr";

  // Кому есть что показывать на отдельной странице ветки: у кого есть супруги
  // или дети. У остальных кнопка ветки в панели деталей неактивна.
  const branchable = useMemo(() => {
    const ids = new Set<string>();
    for (const r of relationships) {
      if (r.kind === "spouse") {
        ids.add(r.from_person_id);
        ids.add(r.to_person_id);
      } else if (r.kind === "parent") {
        ids.add(r.from_person_id);
      }
    }
    return ids;
  }, [relationships]);

  // Поколения по связям «родитель — ребёнок»: по ним «Связь» выбирает, кто из
  // двух выбранных становится родителем (см. relateSelected).
  const generations = useMemo(() => generationMap(persons, relationships), [persons, relationships]);

  // фильтр мужской линии: набор карточек, которые остаются на холсте
  const lineIds = useMemo(
    () => (maleLineOnly ? maleLineIds(persons, relationships) : null),
    [maleLineOnly, persons, relationships]
  );
  // счётчик для значка на кнопке «Фильтр» — как в прототипе
  const maleLineCount = useMemo(
    () => maleLineIds(persons, relationships).size,
    [persons, relationships]
  );
  const shownPersons = useMemo(
    () => (lineIds ? persons.filter((person) => lineIds.has(person.id)) : persons),
    [lineIds, persons]
  );
  const shownRelationships = useMemo(
    // связи, у которых оба конца в линии: иначе тянулись бы к скрытым карточкам
    () =>
      lineIds
        ? relationships.filter((rel) => lineIds.has(rel.from_person_id) && lineIds.has(rel.to_person_id))
        : relationships,
    [lineIds, relationships]
  );

  // «Скрыть на холсте»: карточки убираются только с экрана
  const hiddenSet = useMemo(() => new Set(hiddenIds), [hiddenIds]);
  const visiblePersons = useMemo(
    () => shownPersons.filter((person) => !hiddenSet.has(person.id)),
    [shownPersons, hiddenSet]
  );
  const visibleIds = useMemo(() => new Set(visiblePersons.map((person) => person.id)), [visiblePersons]);
  const visibleRelationships = useMemo(
    () =>
      shownRelationships.filter(
        (rel) => visibleIds.has(rel.from_person_id) && visibleIds.has(rel.to_person_id)
      ),
    [shownRelationships, visibleIds]
  );

  /**
   * Рёбра для раскладки: ей нужен только вид связи, а сторону хэндлов (её
   * выбирает вид) на этом шаге ещё нельзя посчитать — позиций нет.
   */
  const layoutEdges = useMemo<Edge[]>(
    () =>
      visibleRelationships.map((r) => ({
        id: r.id,
        source: r.from_person_id,
        target: r.to_person_id,
        type: r.kind === "spouse" ? "straight" : "family",
        data: { kind: r.kind },
      })),
    [visibleRelationships]
  );

  /**
   * Раскладка по поколениям считается на клиенте для того, что сейчас на холсте:
   * при каждой загрузке, при включении фильтра и при скрытии карточек. Позиции
   * нигде не хранятся: карточки не перетаскиваются (nodesDraggable={false}), а в
   * базу геометрия не пишется. Размер карточки фиксирован (176×100 в PersonNode),
   * поэтому раскладка по константам совпадает с измеренной.
   */
  const layoutPositions = useMemo(() => {
    const stubs: Node[] = visiblePersons.map((p) => ({
      id: p.id,
      type: "person",
      position: { x: 0, y: 0 },
      data: { person: p },
    }));
    // «Слева направо» — та же раскладка, повёрнутая на 90°: поколения идут
    // колонками слева направо, соседи по поколению — друг под другом.
    const laid = autoLayout(stubs, layoutEdges, { horizontal });
    // Восходящее — та же раскладка, отражённая по вертикали: y' = -(y + h).
    // Порядок поколений разворачивается (корень внизу, поколения растут вверх),
    // а все зазоры раскладки сохраняются, поэтому карточки не наезжают друг на
    // друга. Отрицательные координаты React Flow принимает как обычные.
    return new Map(
      laid.map((n) => [
        n.id,
        mirror ? { x: n.position.x, y: -(n.position.y + CARD_H) } : n.position,
      ])
    );
  }, [visiblePersons, layoutEdges, mirror, horizontal]);

  /**
   * Готовые пути рёбер «родитель — ребёнок»: одна шина на семью, считается по
   * раскладке (не по состоянию React Flow). Раньше это делало само ребро — на
   * каждое изменение узлов и с O(E)-поиском внутри O(E)-перебора; теперь путь
   * считается один раз на раскладку, а ребро остаётся чистой отрисовкой.
   */
  const familyEdges = useMemo(
    () => familyEdgeGeometry(visibleRelationships, (id) => layoutPositions.get(id), { horizontal, mirror }),
    [visibleRelationships, layoutPositions, horizontal, mirror]
  );

  /**
   * Рёбра холста. Хэндлы выбираются по виду: в вертикальных видах связи идут
   * сверху вниз, а в «слева направо» — слева направо, поэтому у карточки есть
   * и боковые точки. Супруги в горизонтальном виде стоят друг под другом, и
   * линия идёт из нижней кромки верхнего в верхнюю кромку нижнего: кто выше —
   * решает раскладка (layoutPositions), а не порядок связи в базе.
   */
  const initialEdges = useMemo<Edge[]>(
    () =>
      visibleRelationships.map((r) => {
        const spouse = r.kind === "spouse";
        let source = r.from_person_id;
        let target = r.to_person_id;
        let sourceHandle = spouse ? "spouse-r" : "child-out";
        let targetHandle = spouse ? "spouse-l" : "parent-in";
        if (horizontal) {
          if (spouse) {
            const from = layoutPositions.get(source);
            const to = layoutPositions.get(target);
            if (from && to && from.y > to.y) {
              source = r.to_person_id;
              target = r.from_person_id;
            }
            sourceHandle = "pair-out";
            targetHandle = "pair-in";
          } else {
            // саму линию рисует FamilyBusEdge, хэндлы — только для порядка
            sourceHandle = "kin-out";
            targetHandle = "kin-in";
          }
        }
        return {
          id: r.id,
          source,
          target,
          sourceHandle,
          targetHandle,
          type: spouse ? "straight" : "family",
          animated: false,
          // family читает FamilyBusEdge: готовый путь стебля, шины и отводов
          data: { kind: r.kind, family: familyEdges.get(r.id) ?? null },
          style: spouse
            ? // связь супругов — сплошная линия чуть плотнее кровной, как
              // .w-bond в прототипе: цвет --wire-bond, без пунктира
              { stroke: "var(--color-wire-bond)", strokeWidth: 1.5 }
            : { stroke: "var(--color-canvas-line)", strokeWidth: 1.5 },
        };
      }),
    [visibleRelationships, layoutPositions, horizontal, familyEdges]
  );

  const initialNodes = useMemo<Node[]>(
    () =>
      visiblePersons.map((p) => ({
        id: p.id,
        type: "person",
        // позиции всегда считает раскладка по поколениям — в базе их нет
        position: layoutPositions.get(p.id) ?? { x: 0, y: 0 },
        data: {
          person: p,
          photoUrl: publicUrl(SUPABASE_URL, "photos", p.photo_path),
          hiddenCount: branchRoot?.id === p.id ? branchRoot.hidden : undefined,
          // Двойной клик по карточке открывает её страницу; одиночный клик —
          // выделение, по нему открывается панель деталей с действиями
          onOpen: (id: string) => router.push(`/tree/${treeId}/person/${id}`),
        },
      })),
    [visiblePersons, layoutPositions, branchRoot, router, treeId]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Синхронизация с серверными данными. Возвращаем прежний массив, если ничего
  // не поменялось: иначе React Flow пересобирает узлы и рёбра пропадают до
  // первого обновления. Измеренные размеры карточек при этом сохраняем.
  useEffect(() => {
    setNodes((prev) => {
      const prevById = new Map(prev.map((n) => [n.id, n]));
      const next = initialNodes.map((n) => {
        const p = prevById.get(n.id);
        if (!p) return { ...n, measured: n.measured };
        const sameData = (p.data as { person?: unknown })?.person === (n.data as { person?: unknown })?.person;
        const same =
          sameData &&
          p.position.x === n.position.x &&
          p.position.y === n.position.y &&
          p.measured === n.measured;
        return same ? p : { ...n, measured: p.measured, selected: p.selected };
      });
      const unchanged = next.length === prev.length && next.every((n, i) => n === prev[i]);
      return unchanged ? prev : next;
    });
  }, [initialNodes, setNodes]);
  useEffect(() => setEdges(initialEdges), [initialEdges, setEdges]);

  /* ---- Выделение на холсте ----
     Источник правды — сам React Flow: клик выделяет одного, Shift + клик
     добавляет к выделению (multiSelectionKeyCode). Здесь только читаем набор
     и умеем задавать его программно — из инспектора и палитры. */
  const applySelection = useCallback(
    (ids: string[]) => {
      setSelectedIds(ids);
      setNodes((prev) => {
        let changed = false;
        const next = prev.map((node) => {
          if (node.type !== "person") return node;
          const selected = ids.includes(node.id);
          if (!!node.selected === selected) return node;
          changed = true;
          return { ...node, selected };
        });
        return changed ? next : prev;
      });
    },
    [setNodes]
  );

  /** Выделить одного и показать его на холсте */
  const selectOnly = useCallback(
    (id: string) => {
      applySelection([id]);
      const centerOnNode = (attempt = 0) => {
        const node = getNode(id);
        if (!node) return;
        const width = node.measured?.width ?? CARD_W;
        const height = node.measured?.height ?? CARD_H;
        // До 640px инспектор — нижний лист: карточку ставим прямо над ним,
        // в центр окна она бы уехала под лист.
        const mobile = window.matchMedia("(max-width: 639px)").matches;
        const sheet = sheetRef.current;
        // лист только что смонтировался и ещё не измерен — подождём кадр
        if (mobile && !sheet && attempt < 8) {
          setTimeout(() => centerOnNode(attempt + 1), 40);
          return;
        }
        if (mobile && sheet) {
          const zoom = 1;
          // центр карточки — по центру холста, низ — на SHEET_GAP выше листа
          const targetX = (containerW || window.innerWidth) / 2 - width / 2;
          const targetY = sheet.top - SHEET_GAP - height;
          setViewport(
            {
              x: targetX - node.position.x * zoom,
              y: targetY - node.position.y * zoom,
              zoom,
            },
            { duration: motionDuration(400) }
          );
          return;
        }
        setCenter(node.position.x + width / 2, node.position.y + height / 2, {
          zoom: 1,
          duration: motionDuration(400),
        });
      };
      // человека могли до этого скрыть с холста — тогда сначала возвращаем его
      if (getNode(id)) {
        setTimeout(centerOnNode, 30);
        return;
      }
      setHiddenIds((prev) => (prev.includes(id) ? prev.filter((hidden) => hidden !== id) : prev));
      setTimeout(centerOnNode, 220);
    },
    [applySelection, getNode, setCenter, setViewport, containerW]
  );

  /**
   * Телефон: выбранную карточку поднимаем над нижним листом инспектора.
   * Срабатывает только на новое выделение (и на смену выбранного): раскладку,
   * изменение размера листа и панораму пользователя не перебиваем. Если
   * карточка и так целиком видна над листом — холст не двигаем.
   */
  const alignedSelection = useRef<string | null>(null);
  const selectionKey = selectedIds.length ? [...selectedIds].sort().join("|") : "";

  useEffect(() => {
    if (!selectionKey) {
      alignedSelection.current = null;
      return;
    }
    if (alignedSelection.current === selectionKey) return;
    // до 640px инспектор — нижний лист; на десктопе панель справа и геометрии нет
    if (!containerW || containerW >= 640) {
      alignedSelection.current = selectionKey;
      return;
    }
    const sheet = sheetRef.current;
    if (!sheet) return; // лист ещё не измерен — эффект повторится по sheetTick

    const viewport = getViewport();
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const id of selectionKey.split("|")) {
      const node = getNode(id);
      if (!node || node.type !== "person") continue;
      const width = (node.measured?.width ?? CARD_W) * viewport.zoom;
      const height = (node.measured?.height ?? CARD_H) * viewport.zoom;
      const x = viewport.x + node.position.x * viewport.zoom;
      const y = viewport.y + node.position.y * viewport.zoom;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x + width);
      bottom = Math.max(bottom, y + height);
    }
    alignedSelection.current = selectionKey;
    if (!Number.isFinite(left)) return;

    // свободная область: от верхней кромки холста до кромки листа с зазором
    const freeBottom = Math.max(SHEET_TOP_MARGIN + 40, sheet.top - SHEET_GAP);
    const visible =
      bottom <= sheet.top - SHEET_GAP &&
      top >= SHEET_TOP_MARGIN &&
      left >= SHEET_TOP_MARGIN &&
      right <= containerW - SHEET_TOP_MARGIN;
    if (visible) return;

    // Сдвиг по вертикали — ровно настолько, чтобы карточка встала прямо над
    // листом с зазором SHEET_GAP от его верхней кромки; по горизонтали
    // выравниваем в центр свободной области (лист занимает всю ширину). Если
    // выделение выше свободной области, низ всё равно прижимаем к листу.
    const centerX = containerW / 2;
    const centerY = freeBottom - (bottom - top) / 2;
    setViewport(
      {
        x: viewport.x + centerX - (left + right) / 2,
        y: viewport.y + centerY - (top + bottom) / 2,
        zoom: viewport.zoom,
      },
      { duration: motionDuration(380) }
    );
  }, [selectionKey, sheetTick, containerW, getNode, getViewport, setViewport]);

  // если выделенный человек ушёл с холста (фильтр или скрытие), снимаем выделение
  useEffect(() => {
    setSelectedIds((prev) => {
      const next = prev.filter((id) => visibleIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [visibleIds]);

  const clearSelection = useCallback(() => applySelection([]), [applySelection]);

  function restoreHidden() {
    setHiddenIds([]);
  }

  /**
   * «Связь» из мультивыделения: соединяет ровно двух выбранных. Направление
   * «Родитель — ребёнок» определяет поколение: родителем становится тот, кто
   * старше; при равных поколениях — выбранный первым. Супруги — порядок выбора.
   * Ошибки (в том числе «Такая связь уже есть») приходят из действия и
   * показываются тостом; после успеха холст обновляется, как в других действиях.
   */
  function relateSelected(kind: "parent" | "spouse") {
    if (selectedIds.length !== 2) {
      toast.error("Выберите ровно двух человек");
      return;
    }
    const [first, second] = selectedIds;
    const parentFirst = (generations.get(first) ?? 1) <= (generations.get(second) ?? 1);
    const from = kind === "parent" && !parentFirst ? second : first;
    const to = kind === "parent" ? (from === first ? second : first) : second;

    startTransition(async () => {
      const result = await createRelationship(treeId, kind, from, to);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const byId = new Map(persons.map((person) => [person.id, person]));
      const nameOf = (id: string) => {
        const person = byId.get(id);
        return person ? shortName(person) : "человек";
      };
      toast.success(
        kind === "parent"
          ? `Связь создана: ${nameOf(from)} — родитель ${nameOf(to)}`
          : `Связь создана: ${nameOf(from)} и ${nameOf(to)} — супруги`
      );
      applySelection([]);
      router.refresh();
    });
  }

  /** Показать всех, кто связан с этим местом: выделяем их на холсте */
  function selectPlace(place: string) {
    const key = place.trim().toLowerCase();
    const ids = visiblePersons
      .filter((person) =>
        [person.birth_place, person.residence, person.death_place].some(
          (value) => value?.trim().toLowerCase() === key
        )
      )
      .map((person) => person.id);
    if (!ids.length) {
      toast.error("В этом месте пока никто не записан");
      return;
    }
    applySelection(ids);
    setTimeout(() => fitView({ nodes: ids.map((id) => ({ id })), padding: 0.3, duration: 400, maxZoom: 1 }), 40);
    toast.success(`Выбрано: ${ids.length} ${peopleWord(ids.length)} — ${place}`);
  }

  // Только карточки людей (без служебных узлов-рамок)
  const personNodes = useCallback(() => getNodes().filter((n) => n.type === "person"), [getNodes]);

  /**
   * «Уместить древо в окне». Холст занимает всю ширину окна, а инспектор парит
   * поверх него справа, поэтому место под панель резервируется только здесь:
   * вписываем карточки в область левее панели, фоном ничего не подкладывая.
   */
  const fitAll = useCallback(
    ({ padding = 0.2, duration = 400 }: { padding?: number; duration?: number } = {}) => {
      const list = personNodes();
      if (!list.length || !containerW || !containerH) return;
      // до 640px инспектор — нижний лист и места сбоку не занимает
      const reserve = containerW >= 640 ? INSPECTOR_RESERVE : 0;
      const availW = Math.max(180, containerW - reserve);
      const bounds = getNodesBounds(list);
      setViewport(getViewportForBounds(bounds, availW, containerH, 0.15, 2, padding), { duration });
    },
    [personNodes, containerW, containerH, setViewport]
  );

  // Первый показ: сразу показываем древо целиком, с местом под будущую панель
  const fittedOnce = useRef(false);
  useEffect(() => {
    if (fittedOnce.current || !containerW || !containerH || !visiblePersons.length) return;
    const t = setTimeout(() => {
      fittedOnce.current = true;
      fitAll({ padding: 0.2, duration: 0 });
    }, 60);
    return () => clearTimeout(t);
  }, [containerW, containerH, visiblePersons.length, fitAll]);

  // ---- Вид холста: сохранение выбора и фокус диаграмм ----

  // Читаем ключ после монтирования: в localStorage на сервере нет, а первая
  // отрисовка обязана совпасть с серверной — нисходящее.
  const [viewHydrated, setViewHydrated] = useState(!viewStorageKey);
  useEffect(() => {
    if (!viewStorageKey) return;
    try {
      const saved = window.localStorage.getItem(viewStorageKey);
      if (isCanvasView(saved)) setView(saved);
    } catch {
      // приватный режим или запрет хранилища — просто работаем по умолчанию
    }
    setViewHydrated(true);
  }, [viewStorageKey]);

  // Запись выбора. До первого чтения не пишем: иначе значение по умолчанию
  // затёрло бы сохранённый вид.
  useEffect(() => {
    if (!viewStorageKey || !viewHydrated) return;
    try {
      window.localStorage.setItem(viewStorageKey, view);
    } catch {
      // хранилище недоступно — вид просто не запомнится
    }
  }, [view, viewStorageKey, viewHydrated]);

  // Смена вида: раскладка пересобирается целиком, поэтому вписываем древо
  // заново — иначе оно осталось бы в начале координат. Выделение живёт в
  // состоянии узлов и переживает пересборку (см. синхронизацию initialNodes).
  const prevView = useRef<CanvasView>("desc");
  useEffect(() => {
    const previous = prevView.current;
    prevView.current = view;
    if (previous === view) return;
    fittedOnce.current = false;
    const timer = setTimeout(() => {
      fittedOnce.current = true;
      fitAll({ padding: 0.2, duration: 0 });
    }, 80);
    return () => clearTimeout(timer);
  }, [view, fitAll]);

  /**
   * Отпечаток геометрии карточек: id, позиция и измеренный размер. Нужен, чтобы
   * список рамок не пересобирался от одной лишь смены выделения: массив nodes
   * при этом получает новую ссылку, а геометрия не меняется.
   *
   * Без этого React Flow на каждой пересборке получал новые объекты рамок,
   * заново их измерял и слал dimensions в onNodesChange — холст перерисовывался
   * бесконечно (замер: ~216 перерисовок в секунду в покое).
   */
  const nodesGeometryKey = useMemo(
    () =>
      nodes
        .map(
          (n) =>
            `${n.id}:${n.position.x},${n.position.y},${n.measured?.width ?? 0}x${n.measured?.height ?? 0}`
        )
        .join("|"),
    [nodes]
  );

  // Мягкая рамка вокруг пары супругов — когда они рядом.
  // Кнопок «+» на линии пары больше нет: добавление родственников живёт
  // в панели деталей (инспекторе) и не всплывает при наведении.
  const plateNodes = useMemo<Node[]>(() => {
    const out: Node[] = [];
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const e of edges) {
      if (e.data?.kind !== "spouse") continue;
      const a = byId.get(e.source);
      const b = byId.get(e.target);
      if (!a || !b) continue;
      const aw = a.measured?.width ?? CARD_W;
      const ah = a.measured?.height ?? CARD_H;
      const bw = b.measured?.width ?? CARD_W;
      const bh = b.measured?.height ?? CARD_H;
      // Пара читается как одна семья: в вертикальных видах супруги стоят рядом
      // по горизонтали, в «слева направо» — друг под другом по вертикали.
      const gap = horizontal
        ? Math.max(b.position.y - (a.position.y + ah), a.position.y - (b.position.y + bh))
        : Math.max(b.position.x - (a.position.x + aw), a.position.x - (b.position.x + bw));
      const aligned = horizontal
        ? Math.abs(a.position.x + aw / 2 - (b.position.x + bw / 2)) <= 48
        : Math.abs(a.position.y + ah / 2 - (b.position.y + bh / 2)) <= 48;
      if (!aligned || gap > 120) continue;
      const left = Math.min(a.position.x, b.position.x) - 10;
      const top = Math.min(a.position.y, b.position.y) - 10;
      out.push({
        id: `plate-${e.id}`,
        type: "couplePlate",
        position: { x: left, y: top },
        data: {
          w: Math.max(a.position.x + aw, b.position.x + bw) + 10 - left,
          h: Math.max(a.position.y + ah, b.position.y + bh) + 10 - top,
        },
        zIndex: -1,
        draggable: false,
        selectable: false,
        focusable: false,
        connectable: false,
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- геометрию читаем через отпечаток
  }, [nodesGeometryKey, edges, horizontal]);

  /**
   * Список узлов для React Flow: карточки людей и рамки пар. Одна и та же
   * ссылка, пока не изменились ни узлы, ни рамки: новая ссылка на каждом
   * рендере холста заставляла React Flow пересобирать внутренний список узлов.
   */
  const flowNodes = useMemo<Node[]>(() => [...nodes, ...plateNodes], [nodes, plateNodes]);

  // ---- Правки родственников приходят без перезагрузки страницы ----
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`tree:${treeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "persons", filter: `tree_id=eq.${treeId}` },
        () => router.refresh()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "relationships", filter: `tree_id=eq.${treeId}` },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [treeId, router]);

  // ---- Командная палитра: ⌘K, событие из шапки и ?palette=1 ----
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key === "k" || event.key === "K" || event.key === "л" || event.key === "Л") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    // контракт с шапкой: кнопка поиска только шлёт событие
    const onPalette = () => setPaletteOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("studio:palette", onPalette);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("studio:palette", onPalette);
    };
  }, []);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("palette") === "1") setPaletteOpen(true);
  }, []);

  /** Закрыть палитру и убрать ?palette=1, чтобы она не открывалась снова */
  const closePalette = useCallback(() => {
    setPaletteOpen(false);
    const url = new URL(window.location.href);
    if (url.searchParams.get("palette") !== "1") return;
    url.searchParams.delete("palette");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }, []);

  // ---- Смена темы: та же кука и data-theme, что у переключателя в шапке.
  // Тем две (светлая и тёмная): старые значения куки — «sepia», «auto» —
  // разбирает resolveStoredTheme из lib/theme.
  const cycleTheme = useCallback(() => {
    const match = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`));
    const current = resolveStoredTheme(match ? decodeURIComponent(match[1]) : null);
    const keys = THEMES.map((theme) => theme.key);
    const next = keys[(keys.indexOf(current) + 1) % keys.length];
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.dataset.theme = next;
    toast.success(`Тема: ${(THEMES.find((theme) => theme.key === next)?.label ?? next).toLowerCase()}`);
  }, []);

  // ---- Экспорт GEDCOM: то же действие, что в настройках древа ----
  function exportGedcom() {
    startTransition(async () => {
      const result = await exportTree(treeId);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const blob = new Blob([result.content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Файл GEDCOM скачан");
    });
  }

  /** Действия палитры: только то, что холст уже умеет */
  const paletteActions = useMemo<PaletteAction[]>(() => {
    const list: PaletteAction[] = [];
    if (canEdit) {
      list.push({
        id: "add",
        title: "Добавить человека",
        hint: "Новая карточка в этом древе",
        icon: "plus",
        run: () => router.push(`/tree/${treeId}/person/new`),
      });
    }
    list.push({
      id: "male",
      title: "Мужская линия",
      hint: maleLineOnly ? "Снять фильтр — показать всех" : "Только мужчины по крови",
      kbd: "F",
      icon: "filter",
      run: () => toggleMaleLine(),
    });
    list.push({
      id: "fit",
      title: "Уместить холст",
      hint: "Показать всё древо в окне",
      kbd: "0",
      icon: "fit",
      run: () => fitAll({ padding: 0.2 }),
    });
    list.push({
      id: "png",
      title: "Экспорт картинки",
      hint: "PNG со всеми карточками и подписью",
      icon: "image",
      run: () => void exportPng(),
    });
    list.push({
      id: "gedcom",
      title: "Экспорт GEDCOM",
      hint: "Файл для других генеалогических программ",
      icon: "file",
      run: exportGedcom,
    });
    list.push({
      id: "theme",
      title: "Переключить тему",
      hint: "Светлая или тёмная",
      kbd: "T",
      icon: "theme",
      run: cycleTheme,
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, maleLineOnly, treeId, router, fitAll, cycleTheme]);

  // Слушатель горячих клавиш ставим один раз, а свежие обработчики берём из ref:
  // иначе после реалтайм-обновления клавиша дёргала бы устаревший фильтр.
  const shortcutRef = useRef({ male: toggleMaleLine });
  useEffect(() => {
    shortcutRef.current = { male: toggleMaleLine };
  });

  useEffect(() => {
    if (paletteOpen) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const inField =
        !!target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable);
      if (inField || event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.code === "Digit0" || event.code === "Numpad0") {
        event.preventDefault();
        fitAll({ padding: 0.2 });
        return;
      }
      if (event.code === "KeyF") {
        event.preventDefault();
        shortcutRef.current.male();
        return;
      }
      if (event.code === "KeyT") {
        event.preventDefault();
        cycleTheme();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, cycleTheme, fitAll]);

  /** Мужская линия: включаем фильтр — раскладка оставшихся считается сама. */
  function toggleMaleLine() {
    const next = !maleLineOnly;
    setMaleLineOnly(next);
    setTimeout(() => fitAll({ padding: 0.2 }), 80);
    if (!next) {
      toast.success("Показаны все родственники");
      return;
    }
    if (!maleLineCount) toast.error("В этом древе не нашлось мужской линии");
    else toast.success(`Мужская линия: ${maleLineCount} ${peopleWord(maleLineCount)}`);
  }

  // ---- Экспорт в картинку: PNG карточек (SVG-экспорт был нужен только
  // диаграммам «Веер» и «Часовая» и удалён вместе с ними) ----
  async function exportPng() {
    const viewport = document.querySelector<HTMLElement>(".react-flow__viewport");
    if (!viewport || personNodes().length === 0) {
      return toast.error("В древе пока нет карточек");
    }

    setExporting(true);
    await new Promise((r) => setTimeout(r, 60));

    try {
      const bounds = getNodesBounds(personNodes());
      const pad = 120;
      const width = Math.ceil(bounds.width + pad * 2);
      const height = Math.ceil(bounds.height + pad * 2 + 90); // место под подпись
      const tf = getViewportForBounds(bounds, width, height, 0.4, 2, 0.06);

      // цвета картинки берём из текущей темы, иначе экспорт в тёмной теме
      // остался бы светлым
      const canvasBg = themeToken("--color-canvas", "#eef1f6");

      const dataUrl = await toPng(viewport, {
        backgroundColor: canvasBg,
        width,
        height,
        pixelRatio: 2,
        cacheBust: true,
        style: {
          width: `${width}px`,
          height: `${height}px`,
          transform: `translate(${tf.x}px, ${tf.y}px) scale(${tf.zoom})`,
        },
      });

      // Подпись древа снизу картинки
      const final = await withCaption(dataUrl, width, height, treeTitle, {
        background: canvasBg,
        title: themeToken("--color-ink-800", "#131e33"),
        note: themeToken("--color-ink-300", "#7487a5"),
      });

      const a = document.createElement("a");
      a.href = final;
      a.download = `${treeTitle.replace(/[^\wа-яА-ЯёЁ\- ]/g, "").trim() || "древо"}.png`;
      a.click();
      toast.success("Картинка скачана");
    } catch {
      toast.error("Не удалось собрать картинку. Попробуйте ещё раз.");
    } finally {
      setExporting(false);
    }
  }

  /** Пункты меню «Связь»: тип связи выбирается до вызова действия. При любом
      числе выбранных, кроме двух, пункты выключены с подсказкой. */
  const exactlyTwo = selectedIds.length === 2;

  /**
   * Имена выбранных для пилюли мультивыделения. Считаем по словарю людей, а не
   * поиском по всему списку на каждую карточку: раньше это был O(выбранных ×
   * людей) на каждом рендере холста.
   */
  const selectedNames = useMemo(() => {
    if (selectedIds.length < 2) return "";
    const byId = new Map(persons.map((person) => [person.id, person]));
    return selectedIds
      .map((id) => {
        const person = byId.get(id);
        return person ? shortName(person) : "";
      })
      .filter(Boolean)
      .join(", ");
  }, [selectedIds, persons]);

  /* Колбэки холста — стабильные: React Flow сравнивает пропсы по ссылке, и новые
     функции на каждом рендере холста тянули за собой перерисовку узлов и рёбер
     при любом изменении состояния интерфейса (меню, палитра, метрики листа). */

  /** Двойной клик по линии связи — разрыв (только для владельца и редактора) */
  const onEdgeDoubleClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      if (!canEdit) return;
      if (!confirm("Разорвать эту связь?")) return;
      startTransition(async () => {
        await deleteRelationship(treeId, edge.id);
        router.refresh();
      });
    },
    [canEdit, treeId, router]
  );

  /** Выделение живёт в React Flow: здесь только читаем набор людей */
  const onFlowSelectionChange = useCallback(({ nodes: selected }: { nodes: Node[] }) => {
    setSelectedIds((prev) => {
      const next = selected.filter((n) => n.type === "person").map((n) => n.id);
      return next.length === prev.length && next.every((id, i) => id === prev[i]) ? prev : next;
    });
  }, []);

  return (
    <div className={`relative h-full w-full bg-canvas ${exporting ? "exporting" : ""}`}>
      {/* Ореол холста — как .app__halo прототипа: холодное пятно слева сверху и
          тёплое справа. Лежит под сеткой React Flow, ничего не ловит и в
          экспорт картинки не попадает (тот снимает только viewport). */}
      <div aria-hidden="true" className="canvas-halo" />
      {/* Холст — на всю ширину окна, без сужения и без отдельного слоя точек
          под панелью: инспектор парит поверх холста, а место под него
          резервирует только «уместить» (см. fitAll). Вид меняет только
          раскладку и направление связей — сам холст один и тот же. */}
      <div className="relative z-[1] h-full w-full">
        <ReactFlow
          nodes={flowNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onEdgeDoubleClick={onEdgeDoubleClick}
          onSelectionChange={onFlowSelectionChange}
          elementsSelectable
          /* выделение: клик — один, Shift + клик — добавить к выделению */
          multiSelectionKeyCode="Shift"
          selectionKeyCode={null}
          /* карточки не перетаскиваются: раскладка всегда автоматическая */
          nodesDraggable={false}
          minZoom={0.15}
          maxZoom={2}
          proOptions={PRO_OPTIONS}
        >
          {/* холст в точку: шаг и диаметр точки — как у .canvas-dots прототипа */}
          <Background variant={BackgroundVariant.Dots} gap={26} size={2} color="var(--color-canvas-dot)" />
        </ReactFlow>
      </div>

      {/* Панели холста — свои, студийные: у библиотечных MiniMap и Controls
          серая подложка и системная рамка. На широком экране стоят в левом
          нижнем углу: масштаб — прямо над миникартой, как в прототипе.
          На телефоне миникарты нет, поэтому панель масштаба уходит к правому
          краю по центру — так до неё дотягивается большой палец, не отпуская
          телефон. Миникарту показываем только там, где под неё есть место: на
          узких экранах её перекрыла бы пилюля «Выбрано» — в прототипе она тоже
          скрыта до широкого окна. */}
      <StudioZoom
        className="absolute right-3 top-1/2 z-10 -translate-y-1/2 lg:bottom-[152px] lg:left-6 lg:right-auto lg:top-auto lg:translate-y-0"
        onFit={() => fitAll({ padding: 0.2 })}
      />
      <StudioMinimap className="absolute bottom-5 left-6 z-10 hidden lg:block" />

      {/* Левая колонка холста: возврат ко всему древу (страница ветки) и
          возврат скрытых карточек. Переключателя вида здесь больше нет — выбор
          вида переехал в меню кнопки «Вид» дока, поэтому подписи спокойно живут
          слева, а инспектор парит справа. На телефоне кнопка «Всё древо»
          уступает место доку и нижнему листу деталей. */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-col items-start gap-1.5">
        {wholeTreeHref && (
          <button
            type="button"
            onClick={() => router.push(wholeTreeHref)}
            aria-label="Раскрыть всё древо"
            title="Раскрыть всё древо"
            className="glass pointer-events-auto hidden items-center gap-2 px-3 py-2 text-[12.5px] text-ink-600 transition-colors hover:text-ink-800 sm:flex"
          >
            <IconExpand />
            <span>Всё древо</span>
          </button>
        )}
        {hiddenIds.length > 0 && (
          <button
            type="button"
            onClick={restoreHidden}
            title="Вернуть скрытые карточки на холст"
            className="studio-chip pointer-events-auto"
          >
            Скрыто: {hiddenIds.length} · вернуть
          </button>
        )}
        {/* Включённый фильтр: чип «Мужская линия» тут же в колонке — видно, что
            показано, и легко вернуть всех. Раньше он висел по центру холста, но
            там его перекрывали панели. */}
        {maleLineOnly && (
          <button
            type="button"
            onClick={toggleMaleLine}
            title="Показать всех родственников"
            style={{
              borderColor: "var(--p-acc-line)",
              background: "var(--p-acc-bg)",
              color: "var(--p-brass-ink)",
            }}
            className="studio-chip pointer-events-auto shadow-[var(--shadow-lift)]"
          >
            <IconMaleLine />
            Мужская линия: {shownPersons.length} {peopleWord(shownPersons.length)}
            <span className="text-ink-400">· показать всех</span>
          </button>
        )}
      </div>

      {/* Док действий: стеклянная панель снизу строго по центру окна, как в
          прототипе (.dock: left 50% + translateX(-50%)). Состав —
          «Добавить · Фильтр · Вид · Экспорт»: раскладка автоматическая, отдельной
          кнопки у неё нет. «Фильтр», «Вид» и «Экспорт» открывают меню ВВЕРХ над
          своей кнопкой (см. DockMenu) — выбор подпунктов не уводит с холста.
          Панель деталей парит справа поверх холста и док не сдвигает: на
          1440/1280/1024 центр дока совпадает с центром окна и до панели
          остаётся запас. На телефоне это та же панель-пилюля
          (см. .studio-dock и DOCK_BTN). */}
      <div className="pointer-events-none absolute inset-x-0 bottom-[calc(12px+env(safe-area-inset-bottom))] z-10 flex justify-center sm:bottom-3">
        <div
          className="studio-dock pointer-events-auto max-sm:h-[58px] max-sm:gap-0.5 max-sm:rounded-full max-sm:p-1.5"
          role="toolbar"
          aria-label="Действия с древом"
        >
          {canEdit && (
            <button
              type="button"
              onClick={() => router.push(`/tree/${treeId}/person/new`)}
              disabled={pending}
              aria-label="Добавить человека"
              title="Добавить человека"
              className={DOCK_BTN}
            >
              <IconAdd />
              <span>Добавить</span>
            </button>
          )}
          {/* Фильтр мужской линии: кнопка дока раскрывает меню вверх, внутри —
              единственный пункт-переключатель. Поведение фильтра прежнее. */}
          <MenuButton
            className={`${DOCK_BTN} ${maleLineOnly ? DOCK_BTN_ON : ""}`}
            pressed={maleLineOnly}
            ariaLabel={maleLineOnly ? "Показать всех родственников" : "Фильтр: мужская линия"}
            title={maleLineOnly ? "Показать всех родственников" : "Фильтр: только мужская линия"}
            menuLabel="Фильтр холста"
            width={236}
            options={[
              {
                id: "male-line",
                label: "Мужская линия",
                hint: maleLineOnly
                  ? "Снять фильтр — показать всех родственников"
                  : "Оставить только мужчин по крови от старшего предка",
                icon: <IconMaleLine />,
                role: "menuitemcheckbox",
                checked: maleLineOnly,
                trailing: maleLineOnly ? maleLineCount : undefined,
                onSelect: toggleMaleLine,
              },
            ]}
          >
            <span className="relative block">
              <IconFilter />
              {/* счётчик — только у включённого фильтра: в обычном состоянии
                  на кнопке никаких цифр (число видно ещё в чипе над холстом) */}
              {maleLineOnly && (
                <i
                  aria-hidden="true"
                  className="absolute -right-3 -top-2 min-w-[16px] rounded-full px-1 text-[10px] font-semibold not-italic leading-4"
                  style={{ background: "var(--p-fill)", color: "var(--p-on-fill)" }}
                >
                  {maleLineCount}
                </i>
              )}
            </span>
            <span>Фильтр</span>
          </MenuButton>
          {/* Вид холста: переключатель переехал с левого верхнего угла в меню
              этой кнопки. Активный вид отмечен галочкой и латунью. */}
          <MenuButton
            className={DOCK_BTN}
            ariaLabel={`Вид холста: ${CANVAS_VIEWS.find((item) => item.key === view)?.label ?? ""}`}
            title="Вид холста"
            menuLabel="Вид холста"
            options={CANVAS_VIEWS.map((item) => ({
              id: item.key,
              label: item.label,
              hint: item.hint,
              icon: <item.icon />,
              role: "menuitemradio",
              checked: view === item.key,
              onSelect: () => setView(item.key),
            }))}
          >
            <IconView />
            <span>Вид</span>
          </MenuButton>
          {/* Экспорт: PNG карточек и GEDCOM — тот же механизм, что в настройках
              древа (см. exportGedcom и action exportTree). */}
          <MenuButton
            className={DOCK_BTN}
            ariaLabel="Экспорт"
            title="Экспорт"
            menuLabel="Экспорт"
            options={[
              {
                id: "png",
                label: "Экспорт изображения древа",
                hint: "PNG со всеми карточками и подписью",
                icon: <IconDownload />,
                disabled: exporting,
                onSelect: () => void exportPng(),
              },
              {
                id: "gedcom",
                label: "Экспорт в формате GEDCOM",
                hint: "Файл .ged для других генеалогических программ",
                icon: <IconFile />,
                onSelect: exportGedcom,
              },
            ]}
          >
            <IconDownload />
            <span>Экспорт</span>
          </MenuButton>
        </div>
      </div>

      {/* Мультивыделение: сколько выбрано и что с этим можно сделать.
          Только отображение — данные не меняются. Пилюля центрируется в
          свободной части холста: справа парит инспектор, под него не заезжаем.
          На телефоне пилюля скрыта: её перекрывает нижний лист инспектора,
          а те же действия лежат внутри листа (см. Inspector). */}
      {selectedIds.length > 1 && (
        <div className="absolute bottom-[152px] left-1/2 z-20 hidden max-w-[calc(100%-24px)] -translate-x-1/2 items-center gap-1.5 rounded-[14px] border border-[var(--p-line)] bg-[var(--p-glass)] px-3 py-1.5 shadow-[var(--shadow-lift)] backdrop-blur-[14px] sm:flex sm:max-w-[calc(100%-368px)] sm:left-[calc((100%-344px)/2)] sm:gap-2 lg:bottom-[86px] lg:left-[calc(240px+(100%-584px)/2)] lg:max-w-[calc(100%-608px)]">
          <b className="whitespace-nowrap text-[13px] font-medium text-brass-ink">
            Выбрано: {selectedIds.length}
          </b>
          <span className="hidden max-w-[200px] truncate text-[12px] text-ink-400 sm:block">
            {selectedNames}
          </span>
          <button
            type="button"
            onClick={() => router.push(`/tree/${treeId}/branch/${selectedIds[0]}`)}
            disabled={!branchable.has(selectedIds[0])}
            title={
              branchable.has(selectedIds[0])
                ? "Показать ветвь первого выбранного"
                : "У первого выбранного нет супругов и детей"
            }
            className="flex h-8 items-center gap-1.5 rounded-[10px] border border-[var(--p-line)] bg-[var(--p-field-bg)] px-2.5 text-[12.5px] text-ink-600 transition-colors hover:bg-[var(--p-hover-bg)] hover:text-ink-800 disabled:opacity-45"
          >
            <IconBranch />
            <span className="hidden sm:inline">Показать ветвь</span>
          </button>
          {/* «Связь» — соединяет ровно двух выбранных: сначала тип связи, затем
              серверное действие createRelationship (см. relateSelected). */}
          {canEdit && (
            <MenuButton
              className="flex h-8 items-center gap-1.5 rounded-[10px] border border-[var(--p-line)] bg-[var(--p-field-bg)] px-2.5 text-[12.5px] text-ink-600 transition-colors hover:bg-[var(--p-hover-bg)] hover:text-ink-800"
              ariaLabel="Связать выбранных"
              title={
                selectedIds.length === 2
                  ? "Создать связь между двумя выбранными"
                  : "Выберите ровно двух человек"
              }
              menuLabel="Тип связи"
              note={
                exactlyTwo
                  ? undefined
                  : `Нужно ровно два человека — сейчас выбрано ${selectedIds.length}`
              }
              options={relationOptions(exactlyTwo, relateSelected)}
            >
              <IconRelation />
              <span className="hidden sm:inline">Связь</span>
            </MenuButton>
          )}
          <button
            type="button"
            onClick={clearSelection}
            title="Снять выделение"
            aria-label="Снять выделение"
            className="flex h-8 items-center gap-1.5 rounded-[10px] border border-[var(--p-line)] bg-[var(--p-field-bg)] px-2.5 text-[12.5px] text-ink-600 transition-colors hover:bg-[var(--p-hover-bg)] hover:text-ink-800"
          >
            <IconClose />
            <span className="hidden sm:inline">Снять</span>
          </button>
        </div>
      )}

      {/* Инспектор выделенного человека: панель справа или нижний лист.
          Пока никто не выбран, панели нет вовсе. */}
      <Inspector
        persons={persons}
        relationships={relationships}
        selectedIds={selectedIds}
        changes={changes}
        canEdit={canEdit}
        photoUrlFor={(person) => publicUrl(SUPABASE_URL, "photos", person.photo_path)}
        branchable={branchable}
        onSelect={selectOnly}
        onOpenCard={(id) => router.push(`/tree/${treeId}/person/${id}`)}
        onEditCard={(id) => router.push(`/tree/${treeId}/person/${id}#person-form`)}
        onBranch={(id) => router.push(`/tree/${treeId}/branch/${id}`)}
        onAddRelative={(id: string, relation: NewRelative, gender?: "male" | "female") =>
          // пол передаём только для «Сын»/«Дочь»: без него ссылка та же, что была
          router.push(
            `/tree/${treeId}/person/new?relateTo=${id}&relation=${relation}` +
              (gender ? `&gender=${gender}` : "")
          )
        }
        onRelate={relateSelected}
        onSheetMetrics={onSheetMetrics}
        onHide={(ids) => {
          setHiddenIds((prev) => [...new Set([...prev, ...ids])]);
          applySelection([]);
          toast.success(`Скрыто на холсте: ${ids.length}`);
        }}
        onClear={clearSelection}
      />

      {/* Командная палитра: ⌘K, кнопка поиска в шапке, ?palette=1 */}
      <CommandPalette
        open={paletteOpen}
        onClose={closePalette}
        persons={visiblePersons}
        relationshipsCount={visibleRelationships.length}
        actions={paletteActions}
        onPickPerson={selectOnly}
        onPickPlace={selectPlace}
      />
    </div>
  );
}

/** Значение токена темы для картинки: цвет берём из текущей темы */
function themeToken(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/** Дорисовывает название древа и дату под картинкой */
function withCaption(
  dataUrl: string,
  w: number,
  h: number,
  title: string,
  colors: { background: string; title: string; note: string }
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = w * 2;
      canvas.height = h * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);

      ctx.fillStyle = colors.background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      ctx.fillStyle = colors.title;
      ctx.font = "500 40px Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillText(title, canvas.width / 2, canvas.height - 96);

      ctx.fillStyle = colors.note;
      ctx.font = "400 26px system-ui, sans-serif";
      ctx.fillText(
        `Составлено в Torlmud · ${new Date().toLocaleDateString("ru-RU")}`,
        canvas.width / 2,
        canvas.height - 52
      );

      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export function TreeCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <Canvas {...props} />
    </ReactFlowProvider>
  );
}
