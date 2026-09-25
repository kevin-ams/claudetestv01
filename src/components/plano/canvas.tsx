"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent as RPointerEvent,
  type Ref,
  type RefObject,
} from "react";
import { getCatalogItem } from "@/lib/plano/catalog";
import { cableRun, createsCycle, isSource, needsPower, type ElectricalReport } from "@/lib/plano/electrical";
import type { Plan, PlanItem, ViewSettings } from "@/lib/plano/types";
import { kelvinToHex } from "@/lib/plano/util";
import { ItemSymbol, PX, SymbolDefs } from "./symbol";

export type Tool = "select" | "connect" | "pan";

export interface CanvasHandle {
  fit: () => void;
  zoomBy: (factor: number) => void;
  center: () => { x: number; y: number };
}

interface Props {
  plan: Plan;
  view: ViewSettings;
  report: ElectricalReport;
  selection: string[];
  setSelection: (ids: string[]) => void;
  tool: Tool;
  connectFrom: string | null;
  setConnectFrom: (id: string | null) => void;
  update: (fn: (p: Plan) => Plan, opts?: { transient?: boolean }) => void;
  checkpoint: () => void;
  onAddItem: (type: string, x: number, y: number) => void;
  onMessage: (msg: string) => void;
  svgRef: RefObject<SVGSVGElement | null>;
  handle: Ref<CanvasHandle>;
}

type Drag =
  | { kind: "move"; id: string; start: Pt; orig: Map<string, Pt>; moved: boolean; additive: boolean }
  | { kind: "rotate"; id: string; moved: boolean }
  | { kind: "resize"; id: string; moved: boolean }
  | { kind: "pan"; client: Pt; cam: Pt; moved: boolean; clearOnClick: boolean }
  | { kind: "marquee"; start: Pt; base: string[]; moved: boolean };

interface Pt {
  x: number;
  y: number;
}

const CIRCUIT_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#9333ea", "#ea580c", "#0891b2", "#be185d", "#4d7c0f"];
const FLOOR_TYPES = new Set(["alfombra", "tarima", "zona"]);

function snapTo(v: number, step: number) {
  return Math.round(v / step) * step;
}

function aabbHalf(it: PlanItem) {
  const r = (it.rotation * Math.PI) / 180;
  const c = Math.abs(Math.cos(r));
  const s = Math.abs(Math.sin(r));
  return {
    x: ((it.w * c + it.h * s) / 2) * PX,
    y: ((it.w * s + it.h * c) / 2) * PX,
  };
}

export function Canvas(props: Props) {
  const { plan, view, report, selection, setSelection, tool, connectFrom, setConnectFrom, update, checkpoint, svgRef } = props;
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [cam, setCam] = useState({ x: -100, y: -100, zoom: 1 });
  const [cursor, setCursor] = useState<Pt | null>(null);
  const [marquee, setMarquee] = useState<{ a: Pt; b: Pt } | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const drag = useRef<Drag | null>(null);
  const fitted = useRef(false);
  const sizeRef = useRef(size);

  const { width, depth, grid, snap } = plan.stage;
  const snapStep = snap ? grid / 5 : 0.01;

  const fit = useCallback(() => {
    const s = sizeRef.current;
    const margin = 1.6;
    const zoom = Math.min(s.w / ((width + margin * 2) * PX), s.h / ((depth + margin * 2) * PX));
    setCam({
      zoom,
      x: (width * PX) / 2 - s.w / zoom / 2,
      y: (depth * PX) / 2 - s.h / zoom / 2,
    });
  }, [width, depth]);

  const zoomAt = useCallback((factor: number, sx: number, sy: number) => {
    setCam((c) => {
      const zoom = Math.max(0.1, Math.min(8, c.zoom * factor));
      const wx = c.x + sx / c.zoom;
      const wy = c.y + sy / c.zoom;
      return { zoom, x: wx - sx / zoom, y: wy - sy / zoom };
    });
  }, []);

  useImperativeHandle(
    props.handle,
    () => ({
      fit,
      zoomBy: (f) => zoomAt(f, sizeRef.current.w / 2, sizeRef.current.h / 2),
      center: () => ({
        x: Math.max(0.3, Math.min(width - 0.3, (cam.x + size.w / cam.zoom / 2) / PX)),
        y: Math.max(0.3, Math.min(depth - 0.3, (cam.y + size.h / cam.zoom / 2) / PX)),
      }),
    }),
    [fit, zoomAt, width, depth, cam, size],
  );

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width: w, height: h } = entry.contentRect;
      sizeRef.current = { w, h };
      setSize({ w, h });
      if (!fitted.current && w > 0) {
        fitted.current = true;
        fit();
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mouseWheel = e.deltaMode !== 0 || (Math.abs(e.deltaY) >= 50 && e.deltaX === 0);
      if (e.ctrlKey || e.metaKey || mouseWheel) {
        zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left, e.clientY - rect.top);
      } else {
        // Trackpad two-finger scroll pans.
        setCam((c) => ({ ...c, x: c.x + e.deltaX / c.zoom, y: c.y + e.deltaY / c.zoom }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.code === "Space" && !["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) {
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceDown(false);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const toWorld = (clientX: number, clientY: number): Pt => {
    const rect = wrapRef.current!.getBoundingClientRect();
    return { x: cam.x + (clientX - rect.left) / cam.zoom, y: cam.y + (clientY - rect.top) / cam.zoom };
  };

  const byId = new Map(plan.items.map((i) => [i.id, i]));
  const sourceReport = new Map(report.sources.map((s) => [s.item.id, s]));
  const issueIds = new Map(report.cableIssues.map((c) => [c.item.id, c]));
  const unpoweredIds = new Set(report.unpowered.map((u) => u.id));

  const rootOf = (it: PlanItem) => {
    let cur = it;
    const seen = new Set<string>();
    while (cur.powerFrom && byId.has(cur.powerFrom) && !seen.has(cur.id)) {
      seen.add(cur.id);
      cur = byId.get(cur.powerFrom)!;
    }
    return cur.id;
  };
  const roots = report.sources.filter((s) => !s.parent).map((s) => s.item.id);
  const circuitColor = (it: PlanItem) => {
    const idx = roots.indexOf(rootOf(it));
    return CIRCUIT_COLORS[(idx < 0 ? 0 : idx) % CIRCUIT_COLORS.length];
  };

  // ─── Connect tool ─────────────────────────────────────────────
  const handleConnectClick = (it: PlanItem) => {
    if (!isSource(it) && !needsPower(it)) {
      props.onMessage("Ese elemento no usa corriente.");
      return;
    }
    if (!connectFrom) {
      setConnectFrom(it.id);
      setSelection([it.id]);
      return;
    }
    const first = byId.get(connectFrom);
    if (!first || first.id === it.id) {
      setConnectFrom(null);
      return;
    }
    let child = first;
    let target = it;
    if (!isSource(target)) {
      if (!isSource(first)) {
        props.onMessage("Conecta un equipo a una toma, regleta o extensión.");
        setConnectFrom(it.id);
        return;
      }
      child = it;
      target = first;
    }
    if (createsCycle(child, target, plan.items)) {
      props.onMessage("Esa conexión formaría un ciclo.");
      return;
    }
    checkpoint();
    update((p) => ({ ...p, items: p.items.map((i) => (i.id === child.id ? { ...i, powerFrom: target.id } : i)) }));
    props.onMessage(`${child.label} → ${target.label}`);
    setConnectFrom(null);
    setSelection([child.id]);
  };

  // ─── Pointer handling ─────────────────────────────────────────
  const onItemDown = (e: RPointerEvent, it: PlanItem) => {
    if (e.button !== 0 || spaceDown || tool === "pan") return;
    e.stopPropagation();
    if (tool === "connect") {
      handleConnectClick(it);
      return;
    }
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    let sel = selection;
    if (!selection.includes(it.id)) {
      sel = additive ? [...selection, it.id] : [it.id];
    } else if (additive) {
      sel = selection.filter((s) => s !== it.id);
      setSelection(sel);
      return;
    }
    setSelection(sel);
    const orig = new Map<string, Pt>();
    for (const id of sel) {
      const s = byId.get(id);
      if (s && !s.locked) orig.set(id, { x: s.x, y: s.y });
    }
    drag.current = { kind: "move", id: it.id, start: toWorld(e.clientX, e.clientY), orig, moved: false, additive };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onHandleDown = (e: RPointerEvent, kind: "rotate" | "resize", id: string) => {
    e.stopPropagation();
    drag.current = { kind, id, moved: false };
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onBackgroundDown = (e: RPointerEvent) => {
    if (tool === "connect" && e.button === 0 && !spaceDown) {
      setConnectFrom(null);
    }
    const panning = e.button === 1 || spaceDown || tool === "pan" || (e.button === 0 && !e.shiftKey);
    if (panning) {
      drag.current = { kind: "pan", client: { x: e.clientX, y: e.clientY }, cam: { x: cam.x, y: cam.y }, moved: false, clearOnClick: e.button === 0 && tool !== "pan" };
    } else if (e.button === 0) {
      const p = toWorld(e.clientX, e.clientY);
      drag.current = { kind: "marquee", start: p, base: selection, moved: false };
    } else return;
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: RPointerEvent) => {
    const w = toWorld(e.clientX, e.clientY);
    setCursor({ x: w.x / PX, y: w.y / PX });
    const d = drag.current;
    if (!d) return;

    if (d.kind === "pan") {
      const dx = e.clientX - d.client.x;
      const dy = e.clientY - d.client.y;
      if (!d.moved && Math.hypot(dx, dy) < 3) return;
      d.moved = true;
      setCam((c) => ({ ...c, x: d.cam.x - dx / c.zoom, y: d.cam.y - dy / c.zoom }));
      return;
    }
    if (d.kind === "marquee") {
      d.moved = true;
      setMarquee({ a: d.start, b: w });
      const x1 = Math.min(d.start.x, w.x) / PX;
      const x2 = Math.max(d.start.x, w.x) / PX;
      const y1 = Math.min(d.start.y, w.y) / PX;
      const y2 = Math.max(d.start.y, w.y) / PX;
      const inside = plan.items.filter((i) => !i.hidden && i.x >= x1 && i.x <= x2 && i.y >= y1 && i.y <= y2).map((i) => i.id);
      setSelection(Array.from(new Set([...d.base, ...inside])));
      return;
    }
    if (d.kind === "move") {
      const dxPx = w.x - d.start.x;
      const dyPx = w.y - d.start.y;
      if (!d.moved && Math.hypot(dxPx, dyPx) * cam.zoom < 3) return;
      if (d.orig.size === 0) return;
      if (!d.moved) checkpoint();
      d.moved = true;
      const primary = d.orig.get(d.id) ?? d.orig.values().next().value!;
      const nx = snapTo(primary.x + dxPx / PX, snapStep);
      const ny = snapTo(primary.y + dyPx / PX, snapStep);
      const ddx = nx - primary.x;
      const ddy = ny - primary.y;
      update(
        (p) => ({
          ...p,
          items: p.items.map((i) => {
            const o = d.orig.get(i.id);
            return o ? { ...i, x: +(o.x + ddx).toFixed(3), y: +(o.y + ddy).toFixed(3) } : i;
          }),
        }),
        { transient: true },
      );
      return;
    }
    const it = byId.get(d.id);
    if (!it) return;
    if (!d.moved) checkpoint();
    d.moved = true;
    if (d.kind === "rotate") {
      let ang = (Math.atan2(w.y - it.y * PX, w.x - it.x * PX) * 180) / Math.PI + 90;
      ang = e.shiftKey ? Math.round(ang) : snapTo(ang, 15);
      ang = ((ang % 360) + 360) % 360;
      if (ang > 180) ang -= 360;
      update((p) => ({ ...p, items: p.items.map((i) => (i.id === it.id ? { ...i, rotation: ang } : i)) }), { transient: true });
    } else {
      const r = (-it.rotation * Math.PI) / 180;
      const lx = w.x - it.x * PX;
      const ly = w.y - it.y * PX;
      const localX = lx * Math.cos(r) - ly * Math.sin(r);
      const localY = lx * Math.sin(r) + ly * Math.cos(r);
      let nw = Math.max(0.05, snapTo((Math.abs(localX) * 2) / PX, 0.05));
      let nh = Math.max(0.05, snapTo((Math.abs(localY) * 2) / PX, 0.05));
      if (e.shiftKey) {
        const k = Math.max(nw / it.w, nh / it.h);
        nw = +(it.w * k).toFixed(2);
        nh = +(it.h * k).toFixed(2);
      }
      update((p) => ({ ...p, items: p.items.map((i) => (i.id === it.id ? { ...i, w: nw, h: nh } : i)) }), { transient: true });
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setMarquee(null);
    if (!d) return;
    if (d.kind === "pan" && !d.moved && d.clearOnClick) setSelection([]);
    if (d.kind === "move" && !d.moved && !d.additive && selection.length > 1) setSelection([d.id]);
  };

  // ─── Render helpers ───────────────────────────────────────────
  const ui = 1 / cam.zoom;
  const electric = view.mode === "electrico";
  const visible = plan.items.filter((i) => !i.hidden);
  const ordered = [...visible.filter((i) => FLOOR_TYPES.has(i.type)), ...visible.filter((i) => !FLOOR_TYPES.has(i.type))];

  const gridLines: React.ReactNode[] = [];
  if (plan.stage.showGrid) {
    for (let x = 0; x <= width + 1e-6; x += grid) {
      const major = Math.abs(x - Math.round(x)) < 1e-6;
      gridLines.push(<line key={`gx${x}`} x1={x * PX} x2={x * PX} y1={0} y2={depth * PX} stroke={major ? "#cbd5e1" : "#e2e8f0"} strokeWidth={major ? 1 : 0.6} />);
    }
    for (let y = 0; y <= depth + 1e-6; y += grid) {
      const major = Math.abs(y - Math.round(y)) < 1e-6;
      gridLines.push(<line key={`gy${y}`} y1={y * PX} y2={y * PX} x1={0} x2={width * PX} stroke={major ? "#cbd5e1" : "#e2e8f0"} strokeWidth={major ? 1 : 0.6} />);
    }
  }

  const rulers: React.ReactNode[] = [];
  for (let x = 0; x <= Math.floor(width); x++) {
    rulers.push(
      <g key={`rx${x}`}>
        <line x1={x * PX} x2={x * PX} y1={-14} y2={-6} stroke="#64748b" strokeWidth={1} />
        <text x={x * PX} y={-18} fontSize={10} textAnchor="middle" fill="#64748b">{x} m</text>
      </g>,
    );
  }
  for (let y = 0; y <= Math.floor(depth); y++) {
    rulers.push(
      <g key={`ry${y}`}>
        <line y1={y * PX} y2={y * PX} x1={-14} x2={-6} stroke="#64748b" strokeWidth={1} />
        <text x={-18} y={y * PX + 3} fontSize={10} textAnchor="end" fill="#64748b">{y} m</text>
      </g>,
    );
  }

  const beams = !electric && view.showBeams
    ? visible.filter((i) => i.showBeam && i.beam && i.throw && (i.intensity ?? 100) > 0)
    : [];

  const selected = selection.map((id) => byId.get(id)).filter(Boolean) as PlanItem[];
  const connectItem = connectFrom ? byId.get(connectFrom) : undefined;

  const cursorClass =
    spaceDown || tool === "pan" ? "cursor-grab" : tool === "connect" ? "cursor-crosshair" : "cursor-default";

  return (
    <div
      ref={wrapRef}
      className={`relative h-full w-full overflow-hidden bg-[#e9ebee] select-none ${cursorClass}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("application/x-plano")) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(e) => {
        const type = e.dataTransfer.getData("application/x-plano");
        if (!type) return;
        e.preventDefault();
        const p = toWorld(e.clientX, e.clientY);
        props.onAddItem(type, snapTo(p.x / PX, snapStep), snapTo(p.y / PX, snapStep));
      }}
    >
      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        viewBox={`${cam.x} ${cam.y} ${size.w / cam.zoom} ${size.h / cam.zoom}`}
        className="block touch-none"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setCursor(null)}
      >
        <defs>
          <SymbolDefs />
          {beams.map((b) => {
            const col = b.beamColor ?? kelvinToHex(b.kelvin ?? 5600);
            return (
              <radialGradient key={b.id} id={`beam-${b.id}`} gradientUnits="userSpaceOnUse" cx={0} cy={0} r={(b.throw ?? 3) * PX}>
                <stop offset="0%" stopColor={col} stopOpacity={0.75 * ((b.intensity ?? 100) / 100)} />
                <stop offset="100%" stopColor={col} stopOpacity={0} />
              </radialGradient>
            );
          })}
        </defs>

        {/* Background catch-all for pan / marquee */}
        <rect
          x={cam.x - 10}
          y={cam.y - 10}
          width={size.w / cam.zoom + 20}
          height={size.h / cam.zoom + 20}
          fill="#e9ebee"
          data-bg="1"
          onPointerDown={onBackgroundDown}
        />

        <g pointerEvents="none">
          <rect x={4} y={6} width={width * PX} height={depth * PX} fill="#00000014" />
          <rect x={0} y={0} width={width * PX} height={depth * PX} fill={plan.stage.floorColor} stroke="#94a3b8" strokeWidth={1.5} />
          {gridLines}
          {rulers}
          <text x={(width * PX) / 2} y={-30} textAnchor="middle" fontSize={12} fontWeight={700} fill="#475569" letterSpacing={2}>FONDO</text>
          <text x={(width * PX) / 2} y={depth * PX + 26} textAnchor="middle" fontSize={12} fontWeight={700} fill="#475569" letterSpacing={2}>FRENTE · PÚBLICO / CÁMARAS</text>
          <text x={width * PX} y={-30} textAnchor="end" fontSize={11} fill="#64748b">{width} × {depth} m</text>
        </g>

        {/* Floor area captures clicks too */}
        <rect x={0} y={0} width={width * PX} height={depth * PX} fill="transparent" onPointerDown={onBackgroundDown} />

        {/* Light beams */}
        <g pointerEvents="none" style={{ mixBlendMode: "multiply" }}>
          {beams.map((b) => {
            const R = (b.throw ?? 3) * PX;
            const beam = Math.min(b.beam ?? 40, 359);
            const t = `translate(${b.x * PX},${b.y * PX}) rotate(${b.rotation})`;
            if ((b.beam ?? 0) >= 360) {
              return <circle key={b.id} transform={t} r={R} fill={`url(#beam-${b.id})`} />;
            }
            const half = ((beam / 2) * Math.PI) / 180;
            const ox = 0;
            const oy = -(b.h * PX) / 2;
            const sx = -Math.sin(half) * R;
            const sy = -Math.cos(half) * R;
            const large = beam > 180 ? 1 : 0;
            return (
              <g key={b.id} transform={`${t} translate(${ox},${oy})`}>
                <path d={`M 0 0 L ${sx} ${sy} A ${R} ${R} 0 ${large} 1 ${-sx} ${sy} Z`} fill={`url(#beam-${b.id})`} />
              </g>
            );
          })}
        </g>

        {/* Items */}
        {ordered.map((it) => {
          const inElectric = isSource(it) || needsPower(it);
          const dim = electric && !inElectric;
          const sel = selection.includes(it.id);
          return (
            <g
              key={it.id}
              transform={`translate(${it.x * PX},${it.y * PX}) rotate(${it.rotation})`}
              opacity={dim ? 0.3 : 1}
              onPointerDown={(e) => onItemDown(e, it)}
              className={tool === "select" && !spaceDown ? (it.locked ? "cursor-not-allowed" : "cursor-move") : undefined}
            >
              {/* hit area */}
              <rect x={(-it.w * PX) / 2 - 3} y={(-it.h * PX) / 2 - 3} width={it.w * PX + 6} height={it.h * PX + 6} fill="transparent" />
              {electric && unpoweredIds.has(it.id) && (
                <circle r={Math.max(it.w, it.h) * PX * 0.6 + 4} fill="#fee2e2" stroke="#dc2626" strokeWidth={1.5} strokeDasharray="4 3" />
              )}
              <ItemSymbol item={it} />
              {sel && (
                <rect
                  data-ui="1"
                  x={(-it.w * PX) / 2 - 4 * ui}
                  y={(-it.h * PX) / 2 - 4 * ui}
                  width={it.w * PX + 8 * ui}
                  height={it.h * PX + 8 * ui}
                  fill="none"
                  stroke={connectFrom === it.id ? "#f59e0b" : "#2563eb"}
                  strokeWidth={1.5 * ui}
                  strokeDasharray={`${5 * ui} ${3 * ui}`}
                  pointerEvents="none"
                />
              )}
            </g>
          );
        })}

        {/* Cables */}
        {(electric || view.showCables) && (
          <g pointerEvents="none">
            {plan.items.map((it) => {
              if (!it.powerFrom || it.hidden) return null;
              const src = byId.get(it.powerFrom);
              if (!src) return null;
              const issue = issueIds.get(it.id);
              const col = issue ? "#dc2626" : circuitColor(it);
              const mx = ((it.x + src.x) / 2) * PX;
              const my = ((it.y + src.y) / 2) * PX;
              return (
                <g key={`c-${it.id}`}>
                  <line
                    x1={src.x * PX}
                    y1={src.y * PX}
                    x2={it.x * PX}
                    y2={it.y * PX}
                    stroke={col}
                    strokeWidth={electric ? 2 : 1.2}
                    strokeDasharray={issue ? "6 4" : undefined}
                    strokeOpacity={electric ? 0.9 : 0.5}
                  />
                  <circle cx={it.x * PX} cy={it.y * PX} r={2.5} fill={col} />
                  {electric && (
                    <g transform={`translate(${mx},${my})`}>
                      <rect x={-22} y={-8} width={44} height={15} rx={7} fill="#fff" stroke={col} strokeWidth={0.8} />
                      <text y={3} textAnchor="middle" fontSize={9} fill={col} fontWeight={600}>
                        {cableRun(it, src).toFixed(1)} m
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        )}

        {/* Labels & badges */}
        <g pointerEvents="none">
          {visible.map((it) => {
            if (it.type === "texto") return null;
            const half = aabbHalf(it);
            const lines: { text: string; color: string; weight?: number }[] = [];
            if (view.showLabels) lines.push({ text: it.label, color: "#1f2937", weight: 600 });
            if (electric && needsPower(it) && view.showLabels) lines.push({ text: `${it.watts} W`, color: "#b45309" });
            if (!electric && view.showLabels && it.kelvin && getCatalogItem(it.type)?.category === "luces") {
              lines.push({ text: `${it.kelvin} K${it.channel ? ` · ch ${it.channel}` : ""}`, color: "#6b7280" });
            }
            const rep = electric ? sourceReport.get(it.id) : undefined;
            return (
              <g key={`l-${it.id}`} opacity={electric && !isSource(it) && !needsPower(it) ? 0.35 : 1}>
                {lines.map((l, i) => (
                  <text
                    key={i}
                    x={it.x * PX}
                    y={it.y * PX + half.y + 12 + i * 11}
                    textAnchor="middle"
                    fontSize={i === 0 ? 10.5 : 9}
                    fontWeight={l.weight}
                    fill={l.color}
                    stroke="#ffffffcc"
                    strokeWidth={3}
                    paintOrder="stroke"
                  >
                    {l.text}
                  </text>
                ))}
                {rep && (
                  <g transform={`translate(${it.x * PX},${it.y * PX - half.y - 12})`}>
                    <rect
                      x={-44}
                      y={-9}
                      width={88}
                      height={17}
                      rx={8}
                      fill={rep.overloaded || rep.overSockets ? "#dc2626" : rep.load > rep.capacity * 0.75 ? "#f59e0b" : "#16a34a"}
                    />
                    <text y={3} textAnchor="middle" fontSize={9.5} fill="#fff" fontWeight={700}>
                      {Math.round(rep.load)} W · {rep.socketsUsed}/{it.source!.sockets}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>

        {/* Selection handles and dimensions */}
        <g data-ui="1">
          {selected.length === 1 && !selected[0].locked && tool === "select" && (
            <Handles it={selected[0]} ui={ui} onHandleDown={onHandleDown} />
          )}
          {view.showDimensions && selected.length === 1 && (() => {
            const it = selected[0];
            const x = it.x * PX;
            const y = it.y * PX;
            const fs = 10 * ui;
            return (
              <g pointerEvents="none" stroke="#0ea5e9" strokeWidth={ui} fill="#0369a1" fontSize={fs}>
                <line x1={0} y1={y} x2={x} y2={y} strokeDasharray={`${4 * ui} ${3 * ui}`} />
                <line x1={x} y1={0} x2={x} y2={y} strokeDasharray={`${4 * ui} ${3 * ui}`} />
                <text x={x / 2} y={y - 4 * ui} textAnchor="middle" stroke="#fff" strokeWidth={3 * ui} paintOrder="stroke">{it.x.toFixed(2)} m</text>
                <text x={x + 4 * ui} y={y / 2} stroke="#fff" strokeWidth={3 * ui} paintOrder="stroke">{it.y.toFixed(2)} m</text>
              </g>
            );
          })()}
          {connectItem && cursor && (
            <line
              x1={connectItem.x * PX}
              y1={connectItem.y * PX}
              x2={cursor.x * PX}
              y2={cursor.y * PX}
              stroke="#f59e0b"
              strokeWidth={2 * ui}
              strokeDasharray={`${6 * ui} ${4 * ui}`}
              pointerEvents="none"
            />
          )}
          {marquee && (
            <rect
              x={Math.min(marquee.a.x, marquee.b.x)}
              y={Math.min(marquee.a.y, marquee.b.y)}
              width={Math.abs(marquee.b.x - marquee.a.x)}
              height={Math.abs(marquee.b.y - marquee.a.y)}
              fill="#3b82f61a"
              stroke="#3b82f6"
              strokeWidth={ui}
              pointerEvents="none"
            />
          )}
        </g>
      </svg>

      {/* Overlays */}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-white/85 px-2 py-1 font-mono text-xs text-slate-600 shadow-sm">
        {cursor ? `x ${cursor.x.toFixed(2)} m · y ${cursor.y.toFixed(2)} m` : "—"}
      </div>
      <div className="absolute bottom-3 right-3 flex items-center gap-1 rounded-lg bg-white/90 p-1 text-sm shadow">
        <button className="rounded px-2 py-0.5 hover:bg-slate-100" onClick={() => zoomAt(1 / 1.25, size.w / 2, size.h / 2)} title="Alejar">−</button>
        <button className="w-14 rounded px-1 py-0.5 font-mono text-xs hover:bg-slate-100" onClick={fit} title="Ajustar a pantalla">
          {Math.round(cam.zoom * 100)}%
        </button>
        <button className="rounded px-2 py-0.5 hover:bg-slate-100" onClick={() => zoomAt(1.25, size.w / 2, size.h / 2)} title="Acercar">+</button>
      </div>
      {tool === "connect" && (
        <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full bg-amber-500 px-4 py-1.5 text-sm font-medium text-white shadow">
          {connectItem ? `Ahora haz clic en la toma/regleta para ${connectItem.label}` : "Modo conectar: haz clic en un equipo y luego en su fuente de corriente"}
        </div>
      )}
    </div>
  );
}

function Handles({
  it,
  ui,
  onHandleDown,
}: {
  it: PlanItem;
  ui: number;
  onHandleDown: (e: RPointerEvent, kind: "rotate" | "resize", id: string) => void;
}) {
  const hw = (it.w * PX) / 2;
  const hh = (it.h * PX) / 2;
  const rotY = -hh - 24 * ui;
  return (
    <g transform={`translate(${it.x * PX},${it.y * PX}) rotate(${it.rotation})`}>
      <line x1={0} y1={-hh - 4 * ui} x2={0} y2={rotY} stroke="#2563eb" strokeWidth={ui} />
      <circle
        cx={0}
        cy={rotY}
        r={6 * ui}
        fill="#fff"
        stroke="#2563eb"
        strokeWidth={1.5 * ui}
        className="cursor-grab"
        onPointerDown={(e) => onHandleDown(e, "rotate", it.id)}
      >
        <title>Rotar (Shift = libre)</title>
      </circle>
      <rect
        x={hw - ui}
        y={hh - ui}
        width={10 * ui}
        height={10 * ui}
        fill="#2563eb"
        stroke="#fff"
        strokeWidth={ui}
        className="cursor-nwse-resize"
        onPointerDown={(e) => onHandleDown(e, "resize", it.id)}
      >
        <title>Redimensionar (Shift = proporcional)</title>
      </rect>
    </g>
  );
}
