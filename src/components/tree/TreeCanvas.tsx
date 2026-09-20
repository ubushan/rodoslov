"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
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
  type Connection,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toPng } from "html-to-image";
import { toast } from "sonner";

import { PersonNode } from "./PersonNode";
import { PersonEditor } from "./PersonEditor";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { publicUrl } from "@/lib/format";
import { autoLayout } from "@/lib/layout";
import {
  createPerson,
  savePositions,
  createRelationship,
  deleteRelationship,
} from "@/app/actions/persons";
import type { Person, Relationship, Attachment, MemberRole } from "@/lib/types";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const nodeTypes = { person: PersonNode };

type Props = {
  treeId: string;
  treeTitle: string;
  role: MemberRole;
  persons: Person[];
  relationships: Relationship[];
  attachments: Attachment[];
};

function Canvas({ treeId, treeTitle, role, persons, relationships, attachments }: Props) {
  const router = useRouter();
  const canEdit = role === "owner" || role === "editor";
  const { getNodes, fitView } = useReactFlow();

  const [openId, setOpenId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [, startTransition] = useTransition();

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
          onOpen: (id: string) => setOpenId(id),
        },
      })),
    [persons, canEdit]
  );

  const initialEdges = useMemo<Edge[]>(
    () =>
      relationships.map((r) => ({
        id: r.id,
        source: r.from_person_id,
        target: r.to_person_id,
        sourceHandle: r.kind === "spouse" ? "spouse-r" : "child-out",
        targetHandle: r.kind === "spouse" ? "spouse-l" : "parent-in",
        type: r.kind === "spouse" ? "straight" : "smoothstep",
        animated: false,
        data: { kind: r.kind },
        style:
          r.kind === "spouse"
            ? { stroke: "#7fa6c9", strokeDasharray: "6 5" }
            : { stroke: "#c9a227" },
      })),
    [relationships]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => setNodes(initialNodes), [initialNodes, setNodes]);
  useEffect(() => setEdges(initialEdges), [initialEdges, setEdges]);

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

      startTransition(() => {
        savePositions(treeId, moved);
      });
    },
    [onNodesChange, getNodes, canEdit, treeId]
  );

  // ---- Протягивание связи мышью ----
  const onConnect = useCallback(
    (c: Connection) => {
      if (!canEdit || !c.source || !c.target) return;
      const kind = c.sourceHandle === "spouse-r" ? "spouse" : "parent";

      startTransition(async () => {
        const res = await createRelationship(treeId, kind, c.source!, c.target!);
        if (res.error) toast.error(res.error);
        else {
          router.refresh();
          toast.success(kind === "spouse" ? "Супруги связаны" : "Связь родитель — ребёнок создана");
        }
      });
    },
    [canEdit, treeId, router]
  );

  // ---- Добавление человека ----
  function addPerson() {
    const bounds = getNodesBounds(getNodes());
    const fd = new FormData();
    fd.set("first_name", "Новый");
    fd.set("last_name", "родственник");
    fd.set("is_living", "on");
    fd.set("pos_x", String(bounds.x ?? 0));
    fd.set("pos_y", String((bounds.y ?? 0) + (bounds.height ?? 0) + 140));

    startTransition(async () => {
      const id = await createPerson(treeId, fd);
      router.refresh();
      setOpenId(id);
    });
  }

  // ---- Автоматическая раскладка по поколениям ----
  function arrange() {
    const laid = autoLayout(getNodes(), edges);
    setNodes(laid);
    startTransition(async () => {
      await savePositions(
        treeId,
        laid.map((n) => ({ id: n.id, x: n.position.x, y: n.position.y }))
      );
      setTimeout(() => fitView({ padding: 0.15, duration: 400 }), 30);
      toast.success("Древо выстроено по поколениям");
    });
  }

  // ---- Экспорт в картинку ----
  async function exportPng() {
    const viewport = document.querySelector<HTMLElement>(".react-flow__viewport");
    if (!viewport || getNodes().length === 0) {
      return toast.error("В древе пока нет карточек");
    }

    setExporting(true);
    await new Promise((r) => setTimeout(r, 60));

    try {
      const bounds = getNodesBounds(getNodes());
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

  const openPerson = persons.find((p) => p.id === openId) ?? null;

  return (
    <div className={`relative h-full w-full ${exporting ? "exporting" : ""}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeDoubleClick={(_, edge) => {
          if (!canEdit) return;
          if (!confirm("Разорвать эту связь?")) return;
          startTransition(async () => {
            await deleteRelationship(treeId, edge.id);
            router.refresh();
          });
        }}
        nodesConnectable={canEdit}
        elementsSelectable
        fitView
        fitViewOptions={{ padding: 0.2 }}
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
      <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center p-3">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-2xl border border-mist-200 bg-white/95 px-2.5 py-2 shadow-lift backdrop-blur">
          {canEdit && <Button size="sm" onClick={addPerson}>Добавить человека</Button>}
          {canEdit && (
            <Button size="sm" variant="secondary" onClick={arrange}>
              Выстроить по поколениям
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={exportPng} disabled={exporting}>
            {exporting ? "Собираем…" : "Скачать картинку"}
          </Button>
        </div>
      </div>

      {/* Легенда */}
      <div className="pointer-events-none absolute right-3 top-20 hidden rounded-xl border border-mist-200 bg-white/95 px-3 py-2.5 text-[12px] text-ink-500 shadow-sm sm:block">
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-6 rounded bg-brass-500" /> родитель — ребёнок
        </span>
        <span className="mt-1.5 flex items-center gap-2">
          <span className="h-0.5 w-6 rounded border-t-2 border-dashed border-bond-400" /> супруги
        </span>
      </div>

      {openPerson && (
        <PersonEditor
          treeId={treeId}
          person={openPerson}
          people={persons}
          relationships={relationships}
          attachments={attachments.filter((a) => a.person_id === openPerson.id)}
          canEdit={canEdit}
          onClose={() => setOpenId(null)}
          onChanged={() => router.refresh()}
        />
      )}
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
