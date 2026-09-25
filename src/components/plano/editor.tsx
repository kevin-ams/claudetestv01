"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { analyze } from "@/lib/plano/electrical";
import { loadInitialPlan, savePlan } from "@/lib/plano/storage";
import type { Plan, PlanItem, ViewSettings } from "@/lib/plano/types";
import { createItem, newId } from "@/lib/plano/util";
import { Canvas, type CanvasHandle, type Tool } from "./canvas";
import { ElectricalPanel } from "./electrical-panel";
import { EquipmentPanel } from "./equipment-panel";
import { exportJson, exportPng, exportSvg, printReport } from "./export";
import { Inspector } from "./inspector";
import { Palette } from "./palette";
import { PlansDialog } from "./plans-dialog";

interface History {
  present: Plan;
  past: Plan[];
  future: Plan[];
}

const MAX_HISTORY = 100;
const FLOOR_TYPES = new Set(["alfombra", "tarima", "zona"]);

type Tab = "propiedades" | "electrico" | "equipo";

function ToggleBtn({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: ReactNode; title: string }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${on ? "bg-slate-800 text-white" : "text-slate-600 hover:bg-slate-100"}`}
    >
      {children}
    </button>
  );
}

export default function Editor() {
  const [history, setHistory] = useState<History>(() => ({ present: loadInitialPlan(), past: [], future: [] }));
  const plan = history.present;
  const [selection, setSelection] = useState<string[]>([]);
  const [tool, setTool] = useState<Tool>("select");
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("propiedades");
  const [view, setView] = useState<ViewSettings>({
    mode: "iluminacion",
    showBeams: true,
    showLabels: true,
    showCables: false,
    showDimensions: true,
  });
  const [plansOpen, setPlansOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const canvasRef = useRef<CanvasHandle | null>(null);
  const clipboard = useRef<PlanItem[]>([]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const report = useMemo(() => analyze(plan), [plan]);

  // Autosave (debounced).
  useEffect(() => {
    const t = setTimeout(() => savePlan(plan), 400);
    return () => clearTimeout(t);
  }, [plan]);

  const message = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  /** Saves the current state as an undo step (no-op if nothing changed since the last one). */
  const checkpoint = useCallback(() => {
    setHistory((h) => {
      if (h.past[h.past.length - 1] === h.present) return h;
      return { present: h.present, past: [...h.past.slice(-MAX_HISTORY + 1), h.present], future: [] };
    });
  }, []);

  const update = useCallback((fn: (p: Plan) => Plan, opts?: { transient?: boolean }) => {
    setHistory((h) => {
      const next = { ...fn(h.present), updatedAt: Date.now() };
      if (opts?.transient) return { ...h, present: next };
      const past = h.past[h.past.length - 1] === h.present ? h.past : [...h.past.slice(-MAX_HISTORY + 1), h.present];
      return { present: next, past, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.past.length) return h;
      let past = h.past;
      let prev = past[past.length - 1];
      past = past.slice(0, -1);
      // Skip a checkpoint that equals the present (taken on focus without edits).
      if (prev === h.present && past.length) {
        prev = past[past.length - 1];
        past = past.slice(0, -1);
      }
      return { present: prev, past, future: [h.present, ...h.future] };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((h) => {
      if (!h.future.length) return h;
      return { present: h.future[0], past: [...h.past, h.present], future: h.future.slice(1) };
    });
  }, []);

  const openPlan = (p: Plan) => {
    savePlan(plan);
    setHistory({ present: p, past: [], future: [] });
    savePlan(p);
    setSelection([]);
    setPlansOpen(false);
    setTimeout(() => canvasRef.current?.fit(), 0);
  };

  // ─── Item actions ─────────────────────────────────────────────
  const addItem = useCallback(
    (type: string, x?: number, y?: number) => {
      const c = x === undefined || y === undefined ? canvasRef.current?.center() ?? { x: 1, y: 1 } : { x, y };
      const item = createItem(type, c.x, c.y, plan.items);
      update((p) => ({ ...p, items: FLOOR_TYPES.has(type) ? [item, ...p.items] : [...p.items, item] }));
      setSelection([item.id]);
      setTab("propiedades");
    },
    [plan.items, update],
  );

  const removeSelected = useCallback(() => {
    if (!selection.length) return;
    const ids = new Set(selection);
    update((p) => ({
      ...p,
      items: p.items
        .filter((i) => !ids.has(i.id))
        .map((i) => (i.powerFrom && ids.has(i.powerFrom) ? { ...i, powerFrom: undefined } : i)),
    }));
    setSelection([]);
  }, [selection, update]);

  const pasteItems = useCallback(
    (source: PlanItem[], offset = 0.3) => {
      if (!source.length) return;
      const idMap = new Map(source.map((i) => [i.id, newId()]));
      const copies = source.map((i) => ({
        ...i,
        id: idMap.get(i.id)!,
        x: +(i.x + offset).toFixed(3),
        y: +(i.y + offset).toFixed(3),
        locked: false,
        // Keep connections inside the copied group; drop the rest.
        powerFrom: i.powerFrom && idMap.has(i.powerFrom) ? idMap.get(i.powerFrom) : undefined,
      }));
      update((p) => ({ ...p, items: [...p.items, ...copies] }));
      setSelection(copies.map((c) => c.id));
    },
    [update],
  );

  const selectedItems = useCallback(() => plan.items.filter((i) => selection.includes(i.id)), [plan.items, selection]);

  const duplicate = useCallback(() => pasteItems(selectedItems()), [pasteItems, selectedItems]);

  const reorder = (toFront: boolean) => {
    const ids = new Set(selection);
    update((p) => {
      const sel = p.items.filter((i) => ids.has(i.id));
      const rest = p.items.filter((i) => !ids.has(i.id));
      return { ...p, items: toFront ? [...rest, ...sel] : [...sel, ...rest] };
    });
  };

  const rotateSelected = useCallback(
    (deg: number) => {
      const ids = new Set(selection);
      update((p) => ({
        ...p,
        items: p.items.map((i) => {
          if (!ids.has(i.id) || i.locked) return i;
          let r = (i.rotation + deg) % 360;
          if (r > 180) r -= 360;
          if (r < -180) r += 360;
          return { ...i, rotation: r };
        }),
      }));
    },
    [selection, update],
  );

  const nudge = useCallback(
    (dx: number, dy: number) => {
      const ids = new Set(selection);
      update((p) => ({
        ...p,
        items: p.items.map((i) => (ids.has(i.id) && !i.locked ? { ...i, x: +(i.x + dx).toFixed(3), y: +(i.y + dy).toFixed(3) } : i)),
      }));
    },
    [selection, update],
  );

  const align = (axis: "x" | "y") => {
    const sel = selectedItems();
    const avg = sel.reduce((s, i) => s + i[axis], 0) / sel.length;
    const ids = new Set(selection);
    update((p) => ({ ...p, items: p.items.map((i) => (ids.has(i.id) && !i.locked ? { ...i, [axis]: +avg.toFixed(3) } : i)) }));
  };

  const distribute = (axis: "x" | "y") => {
    const sel = selectedItems().sort((a, b) => a[axis] - b[axis]);
    if (sel.length < 3) return;
    const start = sel[0][axis];
    const step = (sel[sel.length - 1][axis] - start) / (sel.length - 1);
    const pos = new Map(sel.map((i, n) => [i.id, +(start + step * n).toFixed(3)]));
    update((p) => ({ ...p, items: p.items.map((i) => (pos.has(i.id) && !i.locked ? { ...i, [axis]: pos.get(i.id)! } : i)) }));
  };

  // ─── Keyboard ─────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (mod && k === "y") {
        e.preventDefault();
        redo();
      } else if (mod && k === "d") {
        e.preventDefault();
        duplicate();
      } else if (mod && k === "c") {
        clipboard.current = selectedItems();
        if (clipboard.current.length) message(`${clipboard.current.length} elemento(s) copiado(s)`);
      } else if (mod && k === "v") {
        pasteItems(clipboard.current, 0.5);
      } else if (mod && k === "a") {
        e.preventDefault();
        setSelection(plan.items.filter((i) => !i.hidden).map((i) => i.id));
      } else if (k === "delete" || k === "backspace") {
        e.preventDefault();
        removeSelected();
      } else if (k === "escape") {
        setConnectFrom(null);
        if (tool !== "select") setTool("select");
        else setSelection([]);
      } else if (k === "r" && !mod) {
        rotateSelected(e.shiftKey ? -15 : 15);
      } else if (k === "c" && !mod) {
        setTool("connect");
        setConnectFrom(null);
      } else if (k === "v" && !mod) {
        setTool("select");
        setConnectFrom(null);
      } else if (k === "h" && !mod) {
        setTool("pan");
      } else if (k === "e" && !mod) {
        setView((v) => ({ ...v, mode: v.mode === "electrico" ? "iluminacion" : "electrico" }));
      } else if (k.startsWith("arrow") && selection.length) {
        e.preventDefault();
        const step = e.shiftKey ? 0.5 : 0.05;
        const d = { arrowleft: [-step, 0], arrowright: [step, 0], arrowup: [0, -step], arrowdown: [0, step] }[k];
        if (d) nudge(d[0], d[1]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, duplicate, selectedItems, pasteItems, removeSelected, rotateSelected, nudge, message, plan.items, selection.length, tool]);

  const selectFromPanel = (ids: string[]) => {
    setSelection(ids);
    if (ids.length === 1) setTab("propiedades");
  };

  const doExport = async (kind: "png" | "svg" | "json" | "print") => {
    setExportOpen(false);
    const svg = svgRef.current;
    if (kind === "json") return exportJson(plan);
    if (!svg) return;
    const prev = selection;
    setSelection([]);
    // Let the canvas re-render without selection outlines before capturing.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    try {
      if (kind === "png") await exportPng(svg, plan);
      else if (kind === "svg") exportSvg(svg, plan);
      else if (!(await printReport(svg, plan, report))) message("Permite ventanas emergentes para imprimir el reporte.");
    } catch {
      message("No se pudo exportar la imagen.");
    }
    setSelection(prev);
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Top bar */}
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-white px-3 py-2">
        <Link href="/" className="mr-1 flex items-center gap-2 font-bold tracking-tight text-slate-900" title="Volver">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-900 text-base text-amber-300">💡</span>
          <span className="hidden 2xl:inline">Plano de iluminación</span>
        </Link>
        <input
          className="w-40 rounded-md border border-transparent px-2 py-1 text-sm font-semibold hover:border-border focus:border-border focus:outline-none xl:w-52"
          value={plan.name}
          onFocus={checkpoint}
          onChange={(e) => update((p) => ({ ...p, name: e.target.value }), { transient: true })}
          aria-label="Nombre del plano"
        />
        <button className="btn btn-secondary px-3 py-1.5" onClick={() => setPlansOpen(true)}>📁 Planos</button>

        <div className="mx-1 h-6 w-px bg-border" />
        <button className="rounded-md px-2 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-30" onClick={undo} disabled={!history.past.length} title="Deshacer (Ctrl+Z)">↶</button>
        <button className="rounded-md px-2 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-30" onClick={redo} disabled={!history.future.length} title="Rehacer (Ctrl+Shift+Z)">↷</button>

        <div className="mx-1 h-6 w-px bg-border" />
        <div className="flex rounded-lg bg-slate-100 p-0.5">
          <ToggleBtn on={tool === "select"} onClick={() => { setTool("select"); setConnectFrom(null); }} title="Seleccionar y mover (V)">↖ Mover</ToggleBtn>
          <ToggleBtn on={tool === "pan"} onClick={() => setTool("pan")} title="Desplazar vista (H o barra espaciadora)">✋</ToggleBtn>
          <ToggleBtn on={tool === "connect"} onClick={() => { setTool("connect"); setConnectFrom(null); setView((v) => ({ ...v, mode: "electrico" })); }} title="Conectar equipo a toma/regleta (C)">🔌 Conectar</ToggleBtn>
        </div>

        <div className="mx-1 h-6 w-px bg-border" />
        <div className="flex rounded-lg bg-slate-100 p-0.5">
          <ToggleBtn on={view.mode === "iluminacion"} onClick={() => setView((v) => ({ ...v, mode: "iluminacion" }))} title="Vista de iluminación">💡 Iluminación</ToggleBtn>
          <ToggleBtn on={view.mode === "electrico"} onClick={() => { setView((v) => ({ ...v, mode: "electrico" })); setTab("electrico"); }} title="Vista eléctrica (E)">⚡ Eléctrico</ToggleBtn>
        </div>

        <div className="flex flex-wrap items-center gap-0.5">
          <ToggleBtn on={view.showBeams} onClick={() => setView((v) => ({ ...v, showBeams: !v.showBeams }))} title="Mostrar haces de luz">Haces</ToggleBtn>
          <ToggleBtn on={view.showLabels} onClick={() => setView((v) => ({ ...v, showLabels: !v.showLabels }))} title="Mostrar etiquetas">Etiquetas</ToggleBtn>
          <ToggleBtn on={view.showCables} onClick={() => setView((v) => ({ ...v, showCables: !v.showCables }))} title="Mostrar cables en vista de iluminación">Cables</ToggleBtn>
          <ToggleBtn on={view.showDimensions} onClick={() => setView((v) => ({ ...v, showDimensions: !v.showDimensions }))} title="Mostrar cotas del elemento seleccionado">Cotas</ToggleBtn>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-xs text-slate-500 2xl:inline">
            {plan.items.length} elementos · <b className={report.unpowered.length ? "text-amber-600" : ""}>{Math.round(report.totalWatts)} W</b>
          </span>
          <div className="relative">
            <button className="btn btn-primary px-3 py-1.5" onClick={() => setExportOpen((o) => !o)}>Exportar ▾</button>
            {exportOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setExportOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-1 w-60 overflow-hidden rounded-lg border border-border bg-white text-sm shadow-lg">
                  <button className="block w-full px-4 py-2 text-left hover:bg-slate-50" onClick={() => doExport("print")}>🖨️ Imprimir / PDF con reportes</button>
                  <button className="block w-full px-4 py-2 text-left hover:bg-slate-50" onClick={() => doExport("png")}>🖼️ Imagen PNG</button>
                  <button className="block w-full px-4 py-2 text-left hover:bg-slate-50" onClick={() => doExport("svg")}>📐 Vector SVG</button>
                  <button className="block w-full border-t border-border px-4 py-2 text-left hover:bg-slate-50" onClick={() => doExport("json")}>💾 Archivo del plano (.json)</button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {/* Palette */}
        <aside className={`${leftOpen ? "w-56" : "w-0"} shrink-0 overflow-hidden border-r border-border bg-white transition-[width]`}>
          <div className="h-full w-56">
            <Palette onAdd={(t) => addItem(t)} />
          </div>
        </aside>

        {/* Canvas */}
        <main className="relative min-w-0 flex-1">
          <Canvas
            plan={plan}
            view={view}
            report={report}
            selection={selection}
            setSelection={setSelection}
            tool={tool}
            connectFrom={connectFrom}
            setConnectFrom={setConnectFrom}
            update={update}
            checkpoint={checkpoint}
            onAddItem={addItem}
            onMessage={message}
            svgRef={svgRef}
            handle={canvasRef}
          />
          <button
            className="absolute left-2 top-2 rounded-md bg-white/90 px-2 py-1 text-xs shadow hover:bg-white"
            onClick={() => setLeftOpen((o) => !o)}
            title={leftOpen ? "Ocultar catálogo" : "Mostrar catálogo"}
          >
            {leftOpen ? "◀" : "▶ Catálogo"}
          </button>
          <button
            className="absolute right-2 top-2 rounded-md bg-white/90 px-2 py-1 text-xs shadow hover:bg-white"
            onClick={() => setRightOpen((o) => !o)}
            title={rightOpen ? "Ocultar panel" : "Mostrar panel"}
          >
            {rightOpen ? "▶" : "◀ Panel"}
          </button>
          {toast && (
            <div className="pointer-events-none absolute bottom-14 left-1/2 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
              {toast}
            </div>
          )}
        </main>

        {/* Right panel */}
        <aside className={`${rightOpen ? "w-80" : "w-0"} shrink-0 overflow-hidden border-l border-border bg-slate-50/60 transition-[width]`}>
          <div className="flex h-full w-80 flex-col">
            <div className="flex border-b border-border bg-white">
              {(
                [
                  ["propiedades", "Propiedades"],
                  ["electrico", `Eléctrico${report.unpowered.length || report.sources.some((s) => s.overloaded) ? " ●" : ""}`],
                  ["equipo", "Equipo"],
                ] as [Tab, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`flex-1 border-b-2 px-2 py-2.5 text-xs font-semibold ${tab === id ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-800"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto">
              {tab === "propiedades" && (
                <Inspector
                  key={selection.join(",")}
                  plan={plan}
                  selection={selection}
                  report={report}
                  update={update}
                  checkpoint={checkpoint}
                  actions={{
                    duplicate,
                    remove: removeSelected,
                    front: () => reorder(true),
                    back: () => reorder(false),
                    align,
                    distribute,
                    rotate: rotateSelected,
                  }}
                />
              )}
              {tab === "electrico" && <ElectricalPanel plan={plan} report={report} update={update} checkpoint={checkpoint} select={selectFromPanel} />}
              {tab === "equipo" && <EquipmentPanel plan={plan} select={selectFromPanel} />}
            </div>
          </div>
        </aside>
      </div>

      {plansOpen && <PlansDialog current={plan} onOpen={openPlan} onClose={() => setPlansOpen(false)} />}
    </div>
  );
}
