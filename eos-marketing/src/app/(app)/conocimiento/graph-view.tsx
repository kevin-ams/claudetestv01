"use client";

import type Graph from "graphology";
import { useEffect, useRef, useState } from "react";
import type Sigma from "sigma";
import { foldText } from "@/lib/domain/vault-shared";
import type { EdgeAttrs, NodeAttrs } from "./graph-model";

const POS_KEY = "vault-graph-pos-v1";

function loadPositions(): Record<string, [number, number]> {
  try {
    return JSON.parse(localStorage.getItem(POS_KEY) ?? "{}");
  } catch {
    return {};
  }
}
function savePositions(g: Graph<NodeAttrs, EdgeAttrs>) {
  try {
    const old = loadPositions();
    g.forEachNode((k, a) => (old[k] = [Math.round(a.x * 100) / 100, Math.round(a.y * 100) / 100]));
    localStorage.setItem(POS_KEY, JSON.stringify(old));
  } catch {}
}

export type GraphHandle = { center: () => void };

/**
 * Dibuja el grafo con sigma.js (WebGL). Posiciones: caché del navegador (grafo global) o ForceAtlas2
 * en un Web Worker; el grafo local se acomoda al instante.
 */
export function GraphView({
  graph,
  local = false,
  highlight,
  onNode,
  handle,
  className = "",
}: {
  graph: Graph<NodeAttrs, EdgeAttrs>;
  local?: boolean;
  /** Nodos a resaltar (búsqueda, huérfanas); null = ninguno. */
  highlight: Set<string> | null;
  onNode: (key: string, attrs: NodeAttrs) => void;
  handle?: (h: GraphHandle | null) => void;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma<NodeAttrs, EdgeAttrs> | null>(null);
  const state = useRef<{ hovered: string | null; neighbors: Set<string>; highlight: Set<string> | null; dragged: string | null; moved: boolean }>({
    hovered: null,
    neighbors: new Set(),
    highlight: null,
    dragged: null,
    moved: false,
  });
  const onNodeRef = useRef(onNode);
  useEffect(() => {
    onNodeRef.current = onNode;
  });
  const [tip, setTip] = useState<{ x: number; y: number; w: number; a: NodeAttrs } | null>(null);
  const [layingOut, setLayingOut] = useState(false);

  useEffect(() => {
    if (!box.current) return;
    let alive = true;
    let layout: { stop: () => void; kill: () => void } | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      const [{ default: SigmaClass }, fa2Mod] = await Promise.all([import("sigma"), import("graphology-layout-forceatlas2")]);
      const forceAtlas2 = fa2Mod.default;
      if (!alive || !box.current) return;
      const g = graph;
      const n = g.order;

      // Posiciones iniciales: caché (grafo global) o al azar en un círculo.
      const cached = local ? {} : loadPositions();
      let missing = 0;
      g.forEachNode((k) => {
        const p = cached[k];
        if (p) g.mergeNodeAttributes(k, { x: p[0], y: p[1] });
        else {
          missing++;
          const ang = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 10 * Math.sqrt(n || 1);
          g.mergeNodeAttributes(k, { x: Math.cos(ang) * r, y: Math.sin(ang) * r });
        }
      });
      // Gravedad fuerte: las partes sueltas quedan cerca del centro en lugar de alejarse.
      const settings = { ...forceAtlas2.inferSettings(g), gravity: n > 500 ? 1 : 3, strongGravityMode: true, scalingRatio: n > 500 ? 10 : 6 };
      if (local || n < 60) {
        if (missing) forceAtlas2.assign(g, { iterations: local ? 200 : 300, settings });
      } else if (missing > 0) {
        const { default: FA2Layout } = await import("graphology-layout-forceatlas2/worker");
        if (!alive) return;
        const fa2 = new FA2Layout(g, { settings: { ...settings, barnesHutOptimize: n > 300 } });
        layout = fa2;
        setLayingOut(true);
        fa2.start();
        // Unos segundos de acomodo (más si faltan muchas posiciones) y se guarda en caché.
        timer = setTimeout(() => {
          fa2.stop();
          setLayingOut(false);
          savePositions(g);
        }, Math.min(5000, 1200 + (missing / n) * 3000));
      }

      const dark = document.documentElement.classList.contains("dark") || document.documentElement.dataset.theme === "dark";
      const sigma = new SigmaClass<NodeAttrs, EdgeAttrs>(g, box.current, {
        renderEdgeLabels: false,
        labelColor: { color: dark ? "#e5e7eb" : "#1f2937" },
        labelFont: getComputedStyle(document.body).fontFamily || "system-ui, sans-serif",
        labelSize: 12,
        labelRenderedSizeThreshold: n > 2000 ? 14 : n > 300 ? 9 : local ? 0 : 4,
        hideEdgesOnMove: n > 2000,
        zIndex: true,
        nodeReducer: (key, a) => {
          const st = state.current;
          const res: Partial<NodeAttrs> & { highlighted?: boolean; hidden?: boolean; zIndex?: number; forceLabel?: boolean } = { ...a };
          if (st.hovered) {
            if (key === st.hovered || st.neighbors.has(key)) {
              res.zIndex = 2;
              res.forceLabel = true;
            } else {
              res.color = dark ? "#374151" : "#e5e7eb";
              res.label = "";
            }
          } else if (st.highlight) {
            if (st.highlight.has(key)) {
              res.highlighted = true;
              res.forceLabel = true;
              res.zIndex = 2;
            } else {
              res.color = dark ? "#374151" : "#e5e7eb";
              res.label = "";
            }
          }
          return res;
        },
        edgeReducer: (key, a) => {
          const st = state.current;
          const res: Partial<EdgeAttrs> & { hidden?: boolean } = { ...a };
          if (st.hovered) {
            const [s, t] = g.extremities(key);
            if (s !== st.hovered && t !== st.hovered) res.hidden = true;
            else res.size = (a.size ?? 1) + 0.8;
          } else if (st.highlight) {
            const [s, t] = g.extremities(key);
            if (!st.highlight.has(s) && !st.highlight.has(t)) res.color = dark ? "#1f2937" : "#f1f5f9";
          }
          return res;
        },
      });
      sigmaRef.current = sigma;
      // Solo en desarrollo: acceso para las pruebas automáticas.
      // eslint-disable-next-line no-restricted-properties -- NODE_ENV lo sustituye Next al compilar (no es secreto)
      if (process.env.NODE_ENV !== "production") (window as unknown as Record<string, unknown>)[local ? "__vaultLocalGraph" : "__vaultGraph"] = sigma;
      handle?.({ center: () => sigma.getCamera().animatedReset({ duration: 400 }) });

      sigma.on("enterNode", ({ node, event }) => {
        state.current.hovered = node;
        state.current.neighbors = new Set(g.neighbors(node));
        setTip({ x: event.x, y: event.y, w: box.current?.clientWidth ?? 300, a: g.getNodeAttributes(node) });
        sigma.refresh({ skipIndexation: true });
        box.current!.style.cursor = "pointer";
      });
      sigma.on("leaveNode", () => {
        state.current.hovered = null;
        state.current.neighbors = new Set();
        setTip(null);
        sigma.refresh({ skipIndexation: true });
        box.current!.style.cursor = "";
      });
      // Arrastrar nodos (el lienzo no se mueve mientras tanto).
      sigma.on("downNode", ({ node }) => {
        state.current.dragged = node;
        state.current.moved = false;
        if (!sigma.getCustomBBox()) sigma.setCustomBBox(sigma.getBBox());
      });
      const captor = sigma.getMouseCaptor();
      captor.on("mousemovebody", (e) => {
        const d = state.current.dragged;
        if (!d) return;
        state.current.moved = true;
        const pos = sigma.viewportToGraph(e);
        g.mergeNodeAttributes(d, { x: pos.x, y: pos.y });
        e.preventSigmaDefault();
        e.original.preventDefault();
        e.original.stopPropagation();
      });
      captor.on("mouseup", () => {
        if (state.current.dragged && state.current.moved && !local) savePositions(g);
        state.current.dragged = null;
      });
      sigma.on("clickNode", ({ node }) => {
        if (state.current.moved) return;
        onNodeRef.current(node, g.getNodeAttributes(node));
      });
    })();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      layout?.kill();
      sigmaRef.current?.kill();
      sigmaRef.current = null;
      handle?.(null);
    };
    // Se reconstruye cuando cambia el grafo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, local]);

  // Resaltado (búsqueda / huérfanas) sin reconstruir.
  useEffect(() => {
    state.current.highlight = highlight;
    sigmaRef.current?.refresh({ skipIndexation: true });
  }, [highlight]);

  return (
    <div className={`relative ${className}`}>
      <div ref={box} className="absolute inset-0" aria-label="Grafo de notas" role="img" />
      {layingOut && <span className="absolute left-2 top-2 rounded-full bg-card px-2 py-0.5 text-[11px] text-muted shadow-sm">Acomodando el grafo…</span>}
      {tip && (
        <div
          className="pointer-events-none absolute z-10 max-w-64 rounded-lg border border-border bg-card px-2 py-1.5 text-xs shadow-lg"
          style={{ left: Math.max(0, Math.min(tip.x + 12, tip.w - 200)), top: tip.y + 12 }}
        >
          <p className="font-semibold">{tip.a.kind === "ghost" ? `${tip.a.label} (por crear)` : tip.a.label}</p>
          {tip.a.path && <p className="text-muted">{tip.a.path}</p>}
          {tip.a.tags && tip.a.tags.length > 0 && <p className="text-muted">{tip.a.tags.map((t) => `#${t}`).join(" ")}</p>}
          {tip.a.kind === "ghost" && <p className="text-muted">Clic para crear la nota</p>}
        </div>
      )}
    </div>
  );
}

/** Nodos cuyo nombre coincide con la búsqueda (sin acentos). */
export function matchNodes(g: Graph<NodeAttrs, EdgeAttrs>, q: string): Set<string> | null {
  const k = foldText(q.trim());
  if (!k) return null;
  const out = new Set<string>();
  g.forEachNode((key, a) => {
    if (foldText(a.label).includes(k)) out.add(key);
  });
  return out;
}
