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
import { FamilyBusEdge } from "./FamilyBusEdge";
import { StudioMinimap } from "./StudioMinimap";
import { StudioZoom } from "./StudioZoom";
import { Inspector, type InspectorChange } from "./Inspector";
import { CommandPalette, type PaletteAction } from "./CommandPalette";
import { createClient } from "@/lib/supabase/client";
import { peopleWord, publicUrl, shortName } from "@/lib/format";
import { autoLayout, CARD_W, CARD_H } from "@/lib/layout";
import type { NewRelative } from "@/lib/place";
import { maleLineIds } from "@/lib/maleLine";
import { THEMES, THEME_COOKIE, resolveStoredTheme } from "@/lib/theme";
import { deleteRelationship } from "@/app/actions/persons";
import { exportTree } from "@/app/actions/gedcom";
import type { Person, Relationship, Attachment, MemberRole } from "@/lib/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const nodeTypes = { person: PersonNode, couplePlate: CouplePlate };
const edgeTypes = { family: FamilyBusEdge };

/**
 * Сколько места справа занимает парящий инспектор (панель 320px + поля).
 * Учитывается только в «уместить»: холст при этом на всю ширину окна,
 * никакой подложки под панелью нет.
 */
const INSPECTOR_RESERVE = 344;

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

/** Скрыть с холста — глаз перечёркнут */
function IconEyeOff() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.6 6.3C4.3 4.6 6.6 3.6 9 3.6s4.7 1 6.4 2.7M3.9 12.4C5.1 13.6 6.9 14.4 9 14.4s3.9-.8 5.1-2" />
      <path d="M3 3l12 12" />
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
}: Props) {
  const router = useRouter();
  const canEdit = role === "owner" || role === "editor";
  const { getNodes, getNode, fitView, setCenter, setViewport } = useReactFlow();
  // размеры области холста: по ним считаем «уместить» с запасом под инспектор
  const containerW = useStore((state) => state.width);
  const containerH = useStore((state) => state.height);

  const [exporting, setExporting] = useState(false);
  // фильтр мужской линии: только мужчины по крови от старшего предка
  const [maleLineOnly, setMaleLineOnly] = useState(false);
  // выделение на холсте: один или несколько человек (Shift + клик)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // «Скрыть на холсте» — только отображение, в базу ничего не пишется
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  // командная палитра: ⌘K, событие из шапки или ?palette=1
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pending, startTransition] = useTransition();

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

  const initialEdges = useMemo<Edge[]>(
    () =>
      visibleRelationships.map((r) => ({
        id: r.id,
        source: r.from_person_id,
        target: r.to_person_id,
        sourceHandle: r.kind === "spouse" ? "spouse-r" : "child-out",
        targetHandle: r.kind === "spouse" ? "spouse-l" : "parent-in",
        type: r.kind === "spouse" ? "straight" : "family",
        animated: false,
        data: { kind: r.kind },
        style:
          r.kind === "spouse"
            ? // связь супругов — сплошная линия чуть плотнее кровной, как
              // .w-bond в прототипе: цвет --wire-bond, без пунктира
              { stroke: "var(--color-wire-bond)", strokeWidth: 1.5 }
            : { stroke: "var(--color-canvas-line)", strokeWidth: 1.5 },
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
    const laid = autoLayout(stubs, initialEdges);
    return new Map(laid.map((n) => [n.id, n.position]));
  }, [visiblePersons, initialEdges]);

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

  /** Выделить одного и показать его в центре холста */
  const selectOnly = useCallback(
    (id: string) => {
      applySelection([id]);
      const centerOnNode = () => {
        const node = getNode(id);
        if (!node) return;
        const width = node.measured?.width ?? CARD_W;
        const height = node.measured?.height ?? CARD_H;
        setCenter(node.position.x + width / 2, node.position.y + height / 2, {
          zoom: 1,
          duration: 400,
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
    [applySelection, getNode, setCenter]
  );

  // если выделенный человек ушёл с холста (фильтр или «Скрыть»), снимаем выделение
  useEffect(() => {
    setSelectedIds((prev) => {
      const next = prev.filter((id) => visibleIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [visibleIds]);

  const clearSelection = useCallback(() => applySelection([]), [applySelection]);

  function hideSelected() {
    if (!selectedIds.length) return;
    const ids = selectedIds;
    setHiddenIds((prev) => [...new Set([...prev, ...ids])]);
    clearSelection();
    toast.success(
      `Скрыто на холсте: ${ids.length} ${peopleWord(ids.length)}`,
      { description: "Данные не меняются — вернуть можно чипом справа." }
    );
  }

  function restoreHidden() {
    setHiddenIds([]);
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
      if (Math.abs(a.position.y + ah / 2 - (b.position.y + bh / 2)) > 48) continue;
      const gap = Math.max(b.position.x - (a.position.x + aw), a.position.x - (b.position.x + bw));
      if (gap > 120) continue;
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
  }, [nodes, edges]);

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

  // ---- Экспорт в картинку ----
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
      const theme = getComputedStyle(document.documentElement);
      const themeColor = (name: string, fallback: string) =>
        theme.getPropertyValue(name).trim() || fallback;
      const canvasBg = themeColor("--color-canvas", "#eef1f6");

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
        title: themeColor("--color-ink-800", "#131e33"),
        note: themeColor("--color-ink-300", "#7487a5"),
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

  return (
    <div className={`relative h-full w-full bg-canvas ${exporting ? "exporting" : ""}`}>
      {/* Ореол холста — как .app__halo прототипа: холодное пятно слева сверху и
          тёплое справа. Лежит под сеткой React Flow, ничего не ловит и в
          экспорт картинки не попадает (тот снимает только viewport). */}
      <div aria-hidden="true" className="canvas-halo" />
      {/* Холст — на всю ширину окна, без сужения и без отдельного слоя точек
          под панелью: инспектор парит поверх холста, а место под него
          резервирует только «уместить» (см. fitAll) */}
      <div className="relative z-[1] h-full w-full">
        <ReactFlow
          nodes={[...nodes, ...plateNodes]}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onEdgeDoubleClick={(_, edge) => {
            if (!canEdit) return;
            if (!confirm("Разорвать эту связь?")) return;
            startTransition(async () => {
              await deleteRelationship(treeId, edge.id);
              router.refresh();
            });
          }}
          onSelectionChange={({ nodes: selected }) =>
            setSelectedIds((prev) => {
              const next = selected.filter((n) => n.type === "person").map((n) => n.id);
              return next.length === prev.length && next.every((id, i) => id === prev[i]) ? prev : next;
            })
          }
          elementsSelectable
          /* выделение: клик — один, Shift + клик — добавить к выделению */
          multiSelectionKeyCode="Shift"
          selectionKeyCode={null}
          /* карточки не перетаскиваются: раскладка всегда автоматическая */
          nodesDraggable={false}
          minZoom={0.15}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          {/* холст в точку: шаг и диаметр точки — как у .canvas-dots прототипа */}
          <Background variant={BackgroundVariant.Dots} gap={26} size={2} color="var(--color-canvas-dot)" />
        </ReactFlow>
      </div>

      {/* Панели холста — свои, студийные: у библиотечных MiniMap и Controls
          серая подложка и системная рамка. Стоят в левом нижнем углу:
          масштаб — прямо над миникартой, как в прототипе. Миникарту показываем
          только там, где под неё есть место: на узких экранах её перекрыла бы
          пилюля «Выбрано» — в прототипе она тоже скрыта до широкого окна. */}
      <StudioZoom
        className="absolute bottom-3 left-3 z-10 lg:bottom-[152px] lg:left-6"
        onFit={() => fitAll({ padding: 0.2 })}
      />
      <StudioMinimap className="absolute bottom-5 left-6 z-10 hidden lg:block" />

      {/* Левая колонка холста: возврат ко всему древу (страница ветки), легенда
          связей и возврат скрытых карточек. Инспектор парит справа, поэтому
          подписи живут слева. На телефоне колонки нет: её роль берёт нижняя
          панель действий. */}
      <div className="pointer-events-none absolute left-3 top-3 z-10 hidden flex-col items-start gap-1.5 sm:flex">
        {wholeTreeHref && (
          <button
            type="button"
            onClick={() => router.push(wholeTreeHref)}
            aria-label="Раскрыть всё древо"
            title="Раскрыть всё древо"
            className="glass pointer-events-auto flex items-center gap-2 px-3 py-2 text-[12.5px] text-ink-600 transition-colors hover:text-ink-800"
          >
            <IconExpand />
            <span>Всё древо</span>
          </button>
        )}
        <span className="studio-chip">
          <span aria-hidden="true" className="h-0.5 w-6 rounded-[2px] bg-canvas-line" />
          родитель — ребёнок
        </span>
        <span className="studio-chip">
          <span
            aria-hidden="true"
            className="h-0.5 w-6 rounded-[2px]"
            style={{ background: "var(--color-wire-bond)" }}
          />
          супруги
        </span>
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
      </div>

      {/* Док действий: стеклянная панель снизу строго по центру окна, как в
          прототипе (.dock: left 50% + translateX(-50%)). Состав —
          «Добавить · Фильтр · Экспорт»: раскладка автоматическая, отдельной
          кнопки у неё нет. Панель деталей парит справа поверх холста и док не
          сдвигает: на 1440/1280/1024 центр дока совпадает с центром окна и до
          панели остаётся запас. На телефоне это та же панель-пилюля
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
          <button
            type="button"
            onClick={toggleMaleLine}
            aria-pressed={maleLineOnly}
            aria-label={maleLineOnly ? "Показать всех родственников" : "Фильтр: мужская линия"}
            title={maleLineOnly ? "Показать всех родственников" : "Фильтр: только мужская линия"}
            className={`${DOCK_BTN} ${maleLineOnly ? DOCK_BTN_ON : ""}`}
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
          </button>
          <button
            type="button"
            onClick={exportPng}
            disabled={exporting}
            aria-label="Скачать картинку"
            title={exporting ? "Собираем картинку…" : "Скачать картинку"}
            className={DOCK_BTN}
          >
            <IconDownload />
            <span>Экспорт</span>
          </button>
        </div>
      </div>

      {/* Мультивыделение: сколько выбрано и что с этим можно сделать.
          Только отображение — данные не меняются. Пилюля центрируется в
          свободной части холста: справа парит инспектор, под него не заезжаем.
          На телефоне пилюля скрыта: её перекрывает нижний лист инспектора,
          а те же три действия лежат внутри листа (см. Inspector). */}
      {selectedIds.length > 1 && (
        <div className="absolute bottom-[152px] left-1/2 z-20 hidden max-w-[calc(100%-24px)] -translate-x-1/2 items-center gap-1.5 rounded-[14px] border border-[var(--p-line)] bg-[var(--p-glass)] px-3 py-1.5 shadow-[var(--shadow-lift)] backdrop-blur-[14px] sm:flex sm:max-w-[calc(100%-368px)] sm:left-[calc((100%-344px)/2)] sm:gap-2 lg:bottom-[86px] lg:left-[calc(240px+(100%-584px)/2)] lg:max-w-[calc(100%-608px)]">
          <b className="whitespace-nowrap text-[13px] font-medium text-brass-ink">
            Выбрано: {selectedIds.length}
          </b>
          <span className="hidden max-w-[200px] truncate text-[12px] text-ink-400 sm:block">
            {selectedIds
              .map((id) => {
                const person = persons.find((p) => p.id === id);
                return person ? shortName(person) : "";
              })
              .filter(Boolean)
              .join(", ")}
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
          <button
            type="button"
            onClick={hideSelected}
            title="Скрыть на холсте — только отображение"
            className="flex h-8 items-center gap-1.5 rounded-[10px] border border-[var(--p-line)] bg-[var(--p-field-bg)] px-2.5 text-[12.5px] text-ink-600 transition-colors hover:bg-[var(--p-hover-bg)] hover:text-ink-800"
          >
            <IconEyeOff />
            <span className="hidden sm:inline">Скрыть на холсте</span>
          </button>
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

      {/* Включённый фильтр: чип «Мужская линия» рядом с холстом — видно, что
          показано, и легко вернуть всех */}
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
          className="studio-chip absolute left-1/2 top-3 z-10 -translate-x-1/2 shadow-[var(--shadow-lift)]"
        >
          <IconMaleLine />
          Мужская линия: {shownPersons.length} {peopleWord(shownPersons.length)}
          <span className="text-ink-400">· показать всех</span>
        </button>
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
