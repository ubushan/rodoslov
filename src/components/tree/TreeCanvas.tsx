"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  getNodesBounds,
  getViewportForBounds,
  type Node,
  type Edge,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toPng } from "html-to-image";
import { toast } from "sonner";

import { PersonNode, type NewRelative } from "./PersonNode";
import { CouplePlate } from "./CouplePlate";
import { CouplePlus } from "./CouplePlus";
import { FamilyBusEdge } from "./FamilyBusEdge";
import { NodeMenu, MenuItem } from "./NodeMenu";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { peopleWord, publicUrl } from "@/lib/format";
import { autoLayout, CARD_W, CARD_H } from "@/lib/layout";
import { maleLineIds } from "@/lib/maleLine";
import { savePositions, deleteRelationship } from "@/app/actions/persons";
import type { Gender, Person, Relationship, Attachment, MemberRole } from "@/lib/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const nodeTypes = { person: PersonNode, couplePlate: CouplePlate, couplePlus: CouplePlus };
const edgeTypes = { family: FamilyBusEdge };

/* Иконки панели: тонкие штрихи, размер 18, цвет наследуется от кнопки */
function IconAdd() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M9 3.5v11M3.5 9h11" />
    </svg>
  );
}

function IconLayout() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <rect x="2.5" y="2.5" width="5" height="4" rx="1" />
      <rect x="10.5" y="2.5" width="5" height="4" rx="1" />
      <rect x="6.5" y="11.5" width="5" height="4" rx="1" />
      <path d="M5 6.5v2.5h8V6.5" strokeLinecap="round" />
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

/** Мужской знак — фильтр мужской линии */
function IconMaleLine() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.4" cy="10.6" r="4" />
      <path d="M10.3 7.7 14.8 3.2M14.8 3.2h-3.7M14.8 3.2v3.7" />
    </svg>
  );
}

/** Ползунки — свёрнутая панель действий на телефоне */
function IconTools() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M3 5.5h12M3 12.5h12" />
      <circle cx="7" cy="5.5" r="1.9" style={{ fill: "var(--color-surface)" }} />
      <circle cx="12" cy="12.5" r="1.9" style={{ fill: "var(--color-surface)" }} />
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
  /** на странице ветки раскладку не сохраняем в базу, чтобы не сдвигать общее древо */
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
  persistLayout = true,
  wholeTreeHref,
  branchRoot,
}: Props) {
  const router = useRouter();
  const canEdit = role === "owner" || role === "editor";
  const { getNodes, fitView } = useReactFlow();

  const [exporting, setExporting] = useState(false);
  // фильтр мужской линии: только мужчины по крови от старшего предка
  const [maleLineOnly, setMaleLineOnly] = useState(false);
  // раскладка отфильтрованного древа — только на экране, в базу её не пишем
  const [linePositions, setLinePositions] = useState<Record<string, { x: number; y: number }> | null>(null);
  // меню свёрнутой панели действий на телефоне
  const [tools, setTools] = useState<{ x: number; y: number } | null>(null);
  const toolsRef = useRef<HTMLButtonElement>(null);
  // карточка под курсором — по ней показываем «+» на линии её пары
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Пол родителей каждого человека — чтобы в меню не предлагать
  // завести второго отца или вторую мать
  const parentGendersByChild = useMemo(() => {
    const genderById = new Map(persons.map((p) => [p.id, p.gender]));
    const out = new Map<string, Gender[]>();
    for (const r of relationships) {
      if (r.kind !== "parent") continue;
      const g = genderById.get(r.from_person_id) ?? "unknown";
      out.set(r.to_person_id, [...(out.get(r.to_person_id) ?? []), g]);
    }
    return out;
  }, [persons, relationships]);

  // Кому есть что показывать на отдельной странице ветки: у кого есть супруги
  // или дети. У остальных кнопка ветки неактивна.
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

  const initialNodes = useMemo<Node[]>(
    () =>
      shownPersons.map((p) => ({
        id: p.id,
        type: "person",
        // при включённом фильтре берём позиции его раскладки, иначе — сохранённые
        position: linePositions?.[p.id] ?? { x: p.pos_x, y: p.pos_y },
        draggable: canEdit,
        data: {
          person: p,
          photoUrl: publicUrl(SUPABASE_URL, "photos", p.photo_path),
          canEdit,
          parentGenders: parentGendersByChild.get(p.id) ?? [],
          canOpenBranch: branchable.has(p.id),
          hiddenCount: branchRoot?.id === p.id ? branchRoot.hidden : undefined,
          onBranch: (id: string) => router.push(`/tree/${treeId}/branch/${id}`),
          onHover: (id: string, over: boolean) =>
            setHoveredId((cur) => (over ? id : cur === id ? null : cur)),
          onOpen: (id: string) => router.push(`/tree/${treeId}/person/${id}`),
          onAdd: (id: string, relation: NewRelative) =>
            router.push(`/tree/${treeId}/person/new?relateTo=${id}&relation=${relation}`),
        },
      })),
    [shownPersons, linePositions, canEdit, parentGendersByChild, branchable, branchRoot, router, treeId]
  );

  const initialEdges = useMemo<Edge[]>(
    () =>
      shownRelationships.map((r) => ({
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
            ? { stroke: "var(--color-bond-400)", strokeDasharray: "6 5" }
            : { stroke: "var(--color-canvas-line)", strokeWidth: 1.5 },
      })),
    [shownRelationships]
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
        return same ? p : { ...n, measured: p.measured };
      });
      const unchanged = next.length === prev.length && next.every((n, i) => n === prev[i]);
      return unchanged ? prev : next;
    });
  }, [initialNodes, setNodes]);
  useEffect(() => setEdges(initialEdges), [initialEdges, setEdges]);

  // Ветка открывается уже разложенной; в базу эти позиции не пишем
  const arrangedOnce = useRef(false);
  useEffect(() => {
    if (persistLayout || arrangedOnce.current) return;
    const t = setTimeout(() => {
      arrangedOnce.current = true;
      arrange();
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistLayout]);

  // Только карточки людей (без служебных узлов-рамок)
  const personNodes = useCallback(() => getNodes().filter((n) => n.type === "person"), [getNodes]);

  // Мягкая рамка вокруг пары супругов — когда они рядом
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
      // центр просвета между карточками — туда встанет «+» добавления ребёнка
      const [l, r] = a.position.x <= b.position.x ? [a, b] : [b, a];
      const lw = l === a ? aw : bw;
      const gapLeft = l.position.x + lw;
      const gapW = Math.max(24, r.position.x - gapLeft);
      const gapH = Math.max(ah, bh);
      const centerY = (a.position.y + ah / 2 + (b.position.y + bh / 2)) / 2;
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

      // «+» по центру просвета — отдельным узлом поверх линий, иначе линия связи
      // перехватывает клик. Показывается, когда курсор на любой карточке пары.
      out.push({
        id: `plus-${e.id}`,
        type: "couplePlus",
        position: { x: gapLeft, y: centerY - gapH / 2 },
        data: {
          w: gapW,
          h: gapH,
          canEdit,
          open: hoveredId === a.id || hoveredId === b.id,
          anchorId: e.source,
          onAddChild: (id: string) =>
            router.push(`/tree/${treeId}/person/new?relateTo=${id}&relation=child`),
        },
        zIndex: 2,
        draggable: false,
        selectable: false,
        focusable: false,
        connectable: false,
      });
    }
    return out;
  }, [nodes, edges, canEdit, hoveredId, router, treeId]);

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

  // ---- Перетаскивание карточек ----
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      onNodesChange(changes);
      const finished = changes.filter(
        (c): c is NodeChange & { type: "position"; dragging: boolean; id: string } =>
          c.type === "position" && c.dragging === false
      );
      if (!finished.length || !canEdit) return;

      const moved = getNodes()
        .filter((n) => finished.some((c) => c.id === n.id))
        .map((n) => ({ id: n.id, x: n.position.x, y: n.position.y }));

      // на странице ветки и при включённом фильтре позиции не пишем:
      // иначе в базу уехала бы раскладка отфильтрованного древа
      if (!persistLayout || maleLineOnly) return;
      startTransition(() => {
        savePositions(treeId, moved);
      });
    },
    [onNodesChange, getNodes, canEdit, treeId, persistLayout, maleLineOnly]
  );

  // ---- Автоматическая раскладка по поколениям ----
  // на телефоне панель свёрнута в одну кнопку — меню раскрывается под ней
  function openTools() {
    const rect = toolsRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTools({ x: Math.round(rect.left), y: Math.round(rect.bottom + 8) });
  }

  /** Раскладка переданных карточек: размеры берём из DOM, ничего не сохраняя. */
  function computeLayout(list: Node[], forEdges: Edge[]) {
    // Измерение React Flow приходит с задержкой (шрифты в dev-режиме),
    // поэтому читаем размеры карточек прямо из DOM.
    const vp = document.querySelector(".react-flow__viewport") as HTMLElement | null;
    const zoom = vp ? new DOMMatrix(getComputedStyle(vp).transform).a || 1 : 1;
    const withSizes = list.map((n) => {
      if (n.measured) return n;
      const card = document
        .querySelector(`[data-id="${n.id}"]`)
        ?.querySelector(".person-card") as HTMLElement | null;
      if (!card) return n;
      return {
        ...n,
        measured: { width: card.offsetWidth / zoom, height: card.offsetHeight / zoom },
      };
    });
    return autoLayout(withSizes, forEdges);
  }

  /** Мужская линия: включаем фильтр и сразу выстраиваем то, что осталось. */
  function toggleMaleLine() {
    const next = !maleLineOnly;
    setMaleLineOnly(next);

    if (!next) {
      setLinePositions(null);
      setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 60);
      toast.success("Показаны все родственники");
      return;
    }

    const ids = maleLineIds(persons, relationships);
    const nodes = persons
      .filter((person) => ids.has(person.id))
      .map((person) => ({
        id: person.id,
        type: "person",
        position: { x: person.pos_x, y: person.pos_y },
      })) as Node[];
    const forEdges = initialEdges.filter((e) => ids.has(e.source) && ids.has(e.target));

    setTimeout(() => {
      const laid = computeLayout(nodes, forEdges);
      const positions: Record<string, { x: number; y: number }> = {};
      for (const node of laid) positions[node.id] = node.position;
      setLinePositions(positions);
      setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 60);
      if (!nodes.length) toast.error("В этом древе не нашлось мужской линии");
      else toast.success(`Мужская линия: ${nodes.length} ${peopleWord(nodes.length)}`);
    }, 80);
  }

  function arrange() {
    const laid = computeLayout(personNodes(), edges);
    setNodes(laid);
    startTransition(async () => {
      // на странице ветки позиции не пишем — иначе сдвинем общее древо
      if (persistLayout) {
        await savePositions(
          treeId,
          laid.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y }))
        );
      }
      setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 30);
      toast.success("Древо выстроено по поколениям");
    });
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
      <ReactFlow
        nodes={[...nodes, ...plateNodes]}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onEdgeDoubleClick={(_, edge) => {
          if (!canEdit) return;
          if (!confirm("Разорвать эту связь?")) return;
          startTransition(async () => {
            await deleteRelationship(treeId, edge.id);
            router.refresh();
          });
        }}
        elementsSelectable
        fitView
        fitViewOptions={{ padding: 0.2, minZoom: 0.45 }}
        minZoom={0.15}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="var(--color-canvas-dot)" />
        <Controls showInteractive={false} position="bottom-right" />
        <MiniMap
          pannable
          zoomable
          position="bottom-left"
          nodeColor="var(--color-canvas-minimap)"
          maskColor="var(--color-canvas-mask)"
          className="!rounded-xl !border !border-mist-200"
        />
      </ReactFlow>

      {/* Панель действий: на телефоне — одна кнопка с меню, на компьютере — колонка */}
      <div className="pointer-events-none absolute left-3 top-3 flex flex-col">
        <div className="pointer-events-auto sm:hidden">
          <button
            ref={toolsRef}
            type="button"
            onClick={openTools}
            aria-label="Действия с древом"
            aria-haspopup="menu"
            aria-expanded={!!tools}
            title="Действия с древом"
            className="grid h-10 w-10 place-items-center rounded-xl border border-mist-200 bg-surface/95 text-ink-600 shadow-lift backdrop-blur"
          >
            <IconTools />
          </button>

          {tools && (
            <NodeMenu x={tools.x} y={tools.y} onClose={() => setTools(null)}>
              {wholeTreeHref && (
                <MenuItem
                  label="Раскрыть всё древо"
                  onClick={() => {
                    setTools(null);
                    router.push(wholeTreeHref);
                  }}
                />
              )}
              {canEdit && (
                <MenuItem
                  label="Добавить человека"
                  disabled={pending}
                  onClick={() => {
                    setTools(null);
                    router.push(`/tree/${treeId}/person/new`);
                  }}
                />
              )}
              <MenuItem
                label={maleLineOnly ? "Показать всех родственников" : "Только мужская линия"}
                onClick={() => {
                  setTools(null);
                  toggleMaleLine();
                }}
              />
              {canEdit && (
                <MenuItem
                  label="Выстроить по поколениям"
                  onClick={() => {
                    setTools(null);
                    arrange();
                  }}
                />
              )}
              <MenuItem
                label={exporting ? "Собираем картинку…" : "Скачать картинку"}
                disabled={exporting}
                onClick={() => {
                  setTools(null);
                  exportPng();
                }}
              />
            </NodeMenu>
          )}
        </div>

        <div className="pointer-events-auto hidden flex-col gap-2.5 rounded-2xl border border-mist-200 bg-surface/95 p-2.5 shadow-lift backdrop-blur sm:flex">
          {wholeTreeHref && (
            <button
              type="button"
              onClick={() => router.push(wholeTreeHref)}
              aria-label="Раскрыть всё древо"
              title="Раскрыть всё древо"
              className="grid h-10 w-10 place-items-center rounded-xl text-ink-600 transition-colors
                         hover:bg-mist-100 hover:text-ink-900"
            >
              <IconExpand />
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => router.push(`/tree/${treeId}/person/new`)}
              disabled={pending}
              aria-label="Добавить человека"
              title="Добавить человека"
              className="grid h-10 w-10 place-items-center rounded-xl text-ink-600 transition-colors
                         hover:bg-mist-100 hover:text-ink-900 disabled:pointer-events-none disabled:opacity-45"
            >
              <IconAdd />
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={arrange}
              aria-label="Выстроить по поколениям"
              title="Выстроить по поколениям"
              className="grid h-10 w-10 place-items-center rounded-xl text-ink-600 transition-colors
                         hover:bg-mist-100 hover:text-ink-900"
            >
              <IconLayout />
            </button>
          )}
          <button
            type="button"
            onClick={toggleMaleLine}
            aria-pressed={maleLineOnly}
            aria-label={maleLineOnly ? "Показать всех родственников" : "Показать мужскую линию"}
            title={maleLineOnly ? "Показать всех родственников" : "Только мужская линия"}
            className={`grid h-10 w-10 place-items-center rounded-xl transition-colors ${
              maleLineOnly
                ? "bg-brass-500 text-ink-900"
                : "text-ink-600 hover:bg-mist-100 hover:text-ink-900"
            }`}
          >
            <IconMaleLine />
          </button>
          <button
            type="button"
            onClick={exportPng}
            disabled={exporting}
            aria-label="Скачать картинку"
            title={exporting ? "Собираем картинку…" : "Скачать картинку"}
            className="grid h-10 w-10 place-items-center rounded-xl text-ink-600 transition-colors
                       hover:bg-mist-100 hover:text-ink-900 disabled:pointer-events-none disabled:opacity-45"
          >
            <IconDownload />
          </button>
        </div>
      </div>

      {/* Включённый фильтр: видно, что показано, и легко вернуть всех */}
      {maleLineOnly && (
        <button
          type="button"
          onClick={toggleMaleLine}
          className="absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-2 rounded-full border border-brass-500/50 bg-brass-500/15 px-3 py-1.5 text-[13px] text-ink-700 shadow-sm backdrop-blur"
        >
          <IconMaleLine />
          Мужская линия: {shownPersons.length} {peopleWord(shownPersons.length)}
          <span className="text-ink-400">· показать всех</span>
        </button>
      )}

      {/* Легенда */}
      <div className="pointer-events-none absolute right-3 top-3 hidden rounded-xl border border-mist-200 bg-surface/95 px-3 py-2.5 text-[12px] text-ink-500 shadow-sm sm:block">
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-6 rounded bg-canvas-line" /> родитель — ребёнок
        </span>
        <span className="mt-1.5 flex items-center gap-2">
          <span className="h-0.5 w-6 rounded border-t-2 border-dashed border-bond-400" /> супруги
        </span>
      </div>

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
        `Составлено в Родослове · ${new Date().toLocaleDateString("ru-RU")}`,
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
