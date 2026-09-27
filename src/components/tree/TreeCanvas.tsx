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
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { publicUrl } from "@/lib/format";
import { autoLayout, CARD_W, CARD_H } from "@/lib/layout";
import { paternalLine } from "@/lib/paternal";
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

type Props = {
  treeId: string;
  treeTitle: string;
  role: MemberRole;
  persons: Person[];
  relationships: Relationship[];
  attachments: Attachment[];
  /** на странице ветки раскладку не сохраняем в базу, чтобы не сдвигать общее древо */
  persistLayout?: boolean;
};

function Canvas({
  treeId,
  treeTitle,
  role,
  persons,
  relationships,
  attachments,
  persistLayout = true,
}: Props) {
  const router = useRouter();
  const canEdit = role === "owner" || role === "editor";
  const { getNodes, fitView } = useReactFlow();

  const [exporting, setExporting] = useState(false);
  // карточка под курсором — по ней показываем «+» на линии её пары
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // чей род по отцу подсвечен: включается кнопкой на карточке
  const [paternalOf, setPaternalOf] = useState<string | null>(null);
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

  const paternal = useMemo(
    () => (paternalOf ? paternalLine(paternalOf, persons, relationships) : null),
    [paternalOf, persons, relationships]
  );

  const initialNodes = useMemo<Node[]>(
    () =>
      persons.map((p) => ({
        id: p.id,
        type: "person",
        position: { x: p.pos_x, y: p.pos_y },
        draggable: canEdit,
        data: {
          person: p,
          photoUrl: publicUrl(SUPABASE_URL, "photos", p.photo_path),
          canEdit,
          parentGenders: parentGendersByChild.get(p.id) ?? [],
          highlighted: paternal ? paternal.has(p.id) : false,
          dimmed: paternal ? !paternal.has(p.id) : false,
          paternalActive: paternalOf === p.id,
          onPaternal: (id: string) => setPaternalOf((cur) => (cur === id ? null : id)),
          onBranch: (id: string) => router.push(`/tree/${treeId}/branch/${id}`),
          onHover: (id: string, over: boolean) =>
            setHoveredId((cur) => (over ? id : cur === id ? null : cur)),
          onOpen: (id: string) => router.push(`/tree/${treeId}/person/${id}`),
          onAdd: (id: string, relation: NewRelative) =>
            router.push(`/tree/${treeId}/person/new?relateTo=${id}&relation=${relation}`),
        },
      })),
    [persons, canEdit, parentGendersByChild, paternal, paternalOf, router, treeId]
  );

  const initialEdges = useMemo<Edge[]>(
    () =>
      relationships.map((r) => ({
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
            ? { stroke: "#7fa6c9", strokeDasharray: "6 5" }
            : { stroke: "#7a8ca6", strokeWidth: 1.5 },
      })),
    [relationships]
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

      if (!persistLayout) return;
      startTransition(() => {
        savePositions(treeId, moved);
      });
    },
    [onNodesChange, getNodes, canEdit, treeId, persistLayout]
  );

  // ---- Автоматическая раскладка по поколениям ----
  function arrange() {
    // Размеры карточек берём из DOM: измерение React Flow приходит с задержкой
    // (шрифты в dev-режиме), а раскладка с дефолтными 208×104 съезжает.
    const vp = document.querySelector(".react-flow__viewport") as HTMLElement | null;
    const zoom = vp ? new DOMMatrix(getComputedStyle(vp).transform).a || 1 : 1;
    const withSizes = personNodes().map((n) => {
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
    const laid = autoLayout(withSizes, edges);
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

      const dataUrl = await toPng(viewport, {
        backgroundColor: "#eef1f6",
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
      const final = await withCaption(dataUrl, width, height, treeTitle);

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
    <div className={`relative h-full w-full ${exporting ? "exporting" : ""}`}>
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
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="#c6cfdd" />
        <Controls showInteractive={false} position="bottom-right" />
        <MiniMap
          pannable
          zoomable
          position="bottom-left"
          nodeColor="#2b3d5c"
          maskColor="rgba(238,241,246,0.75)"
          className="!rounded-xl !border !border-mist-200"
        />
      </ReactFlow>

      {/* Панель действий */}
      <div className="pointer-events-none absolute left-3 top-3 flex flex-col">
        <div className="pointer-events-auto flex flex-col gap-2.5 rounded-2xl border border-mist-200 bg-white/95 p-2.5 shadow-lift backdrop-blur">
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

      {/* Легенда */}
      <div className="pointer-events-none absolute right-3 top-3 hidden rounded-xl border border-mist-200 bg-white/95 px-3 py-2.5 text-[12px] text-ink-500 shadow-sm sm:block">
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-6 rounded bg-[#7a8ca6]" /> родитель — ребёнок
        </span>
        <span className="mt-1.5 flex items-center gap-2">
          <span className="h-0.5 w-6 rounded border-t-2 border-dashed border-bond-400" /> супруги
        </span>
      </div>

    </div>
  );
}

/** Дорисовывает название древа и дату под картинкой */
function withCaption(dataUrl: string, w: number, h: number, title: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = w * 2;
      canvas.height = h * 2;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);

      ctx.fillStyle = "#eef1f6";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#131e33";
      ctx.font = "500 40px Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillText(title, canvas.width / 2, canvas.height - 96);

      ctx.fillStyle = "#7487a5";
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
