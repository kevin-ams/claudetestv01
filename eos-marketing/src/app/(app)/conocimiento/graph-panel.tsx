"use client";

import { Button, Input } from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppCheckbox } from "@/components/ui/checkbox";
import { AppSelect } from "@/components/ui/select";
import { Segmented } from "@/components/ui/segmented";
import type { EosEntity, NoteSummary } from "@/lib/domain/vault-shared";
import { semanticEdgesAction } from "./actions";
import { buildGraph, folderColors, orphanIds, type NodeAttrs } from "./graph-model";
import { GraphView, matchNodes, type GraphHandle } from "./graph-view";

export type GraphActions = {
  onOpen: (id: number) => void;
  onCreate: (title: string) => void;
  onEntity: (href: string) => void;
  onTag: (tag: string) => void;
};

function handleNode(a: NodeAttrs, act: GraphActions) {
  if (a.kind === "note" && a.noteId) act.onOpen(a.noteId);
  else if (a.kind === "ghost" && a.target) act.onCreate(a.target);
  else if (a.kind === "eos" && a.href) act.onEntity(a.href);
  else if (a.kind === "tag" && a.tag) act.onTag(a.tag);
}

/** Grafo global del vault con filtros, capas opcionales y búsqueda. */
export function GraphPanel({ notes, entities, actions }: { notes: NoteSummary[]; entities: EosEntity[]; actions: GraphActions }) {
  const [showTags, setShowTags] = useState(false);
  const [showEos, setShowEos] = useState(true);
  const [showGhosts, setShowGhosts] = useState(true);
  const [showSemantic, setShowSemantic] = useState(false);
  const [threshold, setThreshold] = useState(0.85);
  const [semantic, setSemantic] = useState<{ a: number; b: number; score: number }[] | null>(null);
  const [folder, setFolder] = useState("");
  const [tag, setTag] = useState("");
  const [sinceDays, setSinceDays] = useState(0);
  const [q, setQ] = useState("");
  const [onlyOrphans, setOnlyOrphans] = useState(false);
  const center = useRef<GraphHandle | null>(null);

  useEffect(() => {
    if (!showSemantic) return;
    let alive = true;
    semanticEdgesAction(threshold)
      .then((r) => alive && setSemantic(r))
      .catch(() => alive && setSemantic([]));
    return () => {
      alive = false;
    };
  }, [showSemantic, threshold]);

  const graph = useMemo(
    () => buildGraph(notes, entities, { showTags, showEos, showGhosts, semantic: showSemantic ? semantic : null, folder, tag, sinceDays }),
    [notes, entities, showTags, showEos, showGhosts, showSemantic, semantic, folder, tag, sinceDays],
  );
  const orphans = useMemo(() => orphanIds(graph), [graph]);
  const highlight = useMemo(() => {
    if (onlyOrphans) return new Set(orphans.map((id) => `n:${id}`));
    return matchNodes(graph, q);
  }, [graph, q, onlyOrphans, orphans]);

  const roots = useMemo(() => [...folderColors(notes.filter((n) => !n.path.startsWith("plantillas/"))).entries()], [notes]);
  const tags = useMemo(() => [...new Set(notes.flatMap((n) => n.tags))].sort((a, b) => a.localeCompare(b, "es")), [notes]);
  const noteCount = useMemo(() => {
    let c = 0;
    graph.forEachNode((_k, a) => {
      if (a.kind === "note") c++;
    });
    return c;
  }, [graph]);

  return (
    <div className="flex flex-col gap-2">
      <div className="card card--default flex flex-row flex-wrap items-center gap-2 p-3">
        <Input aria-label="Buscar en el grafo" placeholder="Resaltar nodos…" value={q} onChange={(e) => setQ(e.target.value)} className="w-48" />
        <AppSelect aria-label="Carpeta" className="w-44" value={folder || "-"} onChange={(e) => setFolder(e.target.value === "-" ? "" : e.target.value)}>
          <option value="-">Todas las carpetas</option>
          {roots.map(([r]) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </AppSelect>
        <AppSelect aria-label="Tag" className="w-40" value={tag || "-"} onChange={(e) => setTag(e.target.value === "-" ? "" : e.target.value)}>
          <option value="-">Todos los tags</option>
          {tags.map((t) => (
            <option key={t} value={t}>
              #{t}
            </option>
          ))}
        </AppSelect>
        <Segmented
          aria-label="Actualizadas"
          options={[
            { id: 0, label: "Todas" },
            { id: 7, label: "7 días" },
            { id: 30, label: "30 días" },
            { id: 90, label: "90 días" },
          ]}
          value={sinceDays}
          onChange={setSinceDays}
        />
        <Button size="sm" variant="outline" className="ml-auto" onPress={() => center.current?.center()}>
          Centrar
        </Button>
      </div>
      <div className="card card--default flex flex-row flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm">
        <AppCheckbox checked={showGhosts} onChange={(e) => setShowGhosts(e.target.checked)}>
          <span className="text-sm">Notas por crear</span>
        </AppCheckbox>
        <AppCheckbox checked={showTags} onChange={(e) => setShowTags(e.target.checked)}>
          <span className="text-sm">Tags</span>
        </AppCheckbox>
        <AppCheckbox checked={showEos} onChange={(e) => setShowEos(e.target.checked)}>
          <span className="text-sm">Rocks, Issues y KPIs</span>
        </AppCheckbox>
        <AppCheckbox checked={showSemantic} onChange={(e) => setShowSemantic(e.target.checked)}>
          <span className="text-sm">Relaciones por significado</span>
        </AppCheckbox>
        {showSemantic && (
          <label className="flex items-center gap-1 text-xs text-muted">
            umbral {Math.round(threshold * 100)}%
            <input type="range" min={0.75} max={0.95} step={0.01} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} aria-label="Umbral de similitud" />
            {semantic && <span>({semantic.length})</span>}
          </label>
        )}
        <button
          type="button"
          onClick={() => setOnlyOrphans((v) => !v)}
          aria-pressed={onlyOrphans}
          className={`ml-auto rounded-full px-2 py-0.5 text-xs ${onlyOrphans ? "bg-yellow-bg text-yellow" : "bg-default text-muted hover:text-foreground"}`}
          title="Notas sin enlaces de entrada ni de salida"
        >
          {orphans.length} huérfana(s){onlyOrphans ? " · resaltadas" : ""}
        </button>
        <span className="text-xs text-muted">{noteCount} nota(s)</span>
      </div>
      <GraphView
        graph={graph}
        highlight={highlight}
        onNode={(_k, a) => handleNode(a, actions)}
        handle={(h) => (center.current = h)}
        className="card card--default h-[70vh] min-h-96 overflow-hidden"
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
        {roots.map(([r, c]) => (
          <span key={r} className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-full" style={{ background: c }} /> {r}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <span className="size-2.5 rounded-full bg-[#64748b]" /> raíz
        </span>
        {showGhosts && (
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-[#9ca3af]" /> por crear
          </span>
        )}
        {showEos && (
          <span className="inline-flex items-center gap-1">
            <span className="size-2.5 rounded-full bg-[#059669]" /> rock <span className="ml-1 size-2.5 rounded-full bg-[#e11d48]" /> issue
            <span className="ml-1 size-2.5 rounded-full bg-[#0284c7]" /> KPI
          </span>
        )}
        {showSemantic && (
          <span className="inline-flex items-center gap-1">
            <span className="h-0.5 w-4 bg-[#fbbf24]" /> por significado
          </span>
        )}
        <span>· El tamaño indica cuántas notas enlazan a esa nota. Arrastra para mover, rueda para acercar.</span>
      </div>
    </div>
  );
}

/** Grafo local (panel derecho): la nota abierta y sus vecinos a 1 o 2 saltos. */
export function LocalGraph({ notes, entities, noteId, actions }: { notes: NoteSummary[]; entities: EosEntity[]; noteId: number; actions: GraphActions }) {
  const [depth, setDepth] = useState(1);
  const graph = useMemo(() => {
    const g = buildGraph(notes, entities, { showTags: false, showEos: true, showGhosts: true, semantic: null, folder: "", tag: "", sinceDays: 0, local: { noteId, depth } });
    // La nota abierta, más grande para ubicarla.
    if (g.hasNode(`n:${noteId}`)) g.mergeNodeAttributes(`n:${noteId}`, { size: 11 });
    return g;
  }, [notes, entities, noteId, depth]);
  const others = graph.order - 1;
  return (
    <section className="card card--default flex flex-col gap-1 p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold uppercase tracking-wide text-muted">Grafo local</h2>
        <Segmented aria-label="Saltos" options={[{ id: 1, label: "1" }, { id: 2, label: "2" }]} value={depth} onChange={setDepth} />
      </div>
      {others <= 0 ? (
        <p className="text-xs text-muted">Sin conexiones todavía.</p>
      ) : (
        <GraphView graph={graph} local highlight={null} onNode={(_k, a) => handleNode(a, actions)} className="h-56 overflow-hidden rounded-lg border border-border" />
      )}
    </section>
  );
}

