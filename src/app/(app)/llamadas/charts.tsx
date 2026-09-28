"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// Paleta categórica validada (slots 1–3 pasan todas las parejas, también con daltonismo).
export const SERIES = {
  efectiva: "#2a78d6",
  no_contesto: "#eb6834",
  numero_equivocado: "#1baf7a",
  otro: "#a3a29c",
} as const;
export const SINGLE = "#2a78d6";

export type Segment = { key: string; label: string; value: number; color: string };

// ---------- Tooltip compartido ----------

type Tip = { x: number; y: number; content: ReactNode } | null;
const TipContext = createContext<(tip: Tip) => void>(() => {});

export function TooltipLayer({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<Tip>(null);
  return (
    <TipContext.Provider value={setTip}>
      {children}
      {tip && (
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 print:hidden max-w-xs rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-lg"
          style={{
            left: Math.min(tip.x + 12, window.innerWidth - 260),
            top: tip.y + 14,
          }}
        >
          {tip.content}
        </div>
      )}
    </TipContext.Provider>
  );
}

function useTip(content: () => ReactNode) {
  const setTip = useContext(TipContext);
  return {
    onMouseMove: (e: React.MouseEvent) => setTip({ x: e.clientX, y: e.clientY, content: content() }),
    onMouseLeave: () => setTip(null),
  };
}

export function TipRow({ color, label, value }: { color?: string; label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="flex items-center gap-1.5 text-muted">
        {color && <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />}
        {label}
      </span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

// ---------- Piezas ----------

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

export function ChartCard({
  title,
  subtitle,
  children,
  className = "",
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section className={`card break-inside-avoid p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="shrink-0">
          <h2 className="font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children = "Sin datos para estos filtros." }: { children?: ReactNode }) {
  return <p className="py-8 text-center text-sm text-muted">{children}</p>;
}

export const fmtPct = (v: number) => `${Math.round(v * 100)}%`;

// ---------- Barra horizontal apilada ----------

function StackedRow({
  label,
  segments,
  max,
  suffix,
}: {
  label: string;
  segments: Segment[];
  max: number;
  suffix?: ReactNode;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const tip = useTip(() => (
    <div className="space-y-1">
      <p className="font-semibold">{label}</p>
      {segments.map((s) => (
        <TipRow
          key={s.key}
          color={s.color}
          label={s.label}
          value={`${s.value} (${fmtPct(total ? s.value / total : 0)})`}
        />
      ))}
      <TipRow label="Total" value={total} />
    </div>
  ));
  return (
    <div className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 py-1.5" {...tip}>
      <span className="truncate text-sm" title={label}>
        {label}
      </span>
      <div className="flex h-5 gap-[2px]" style={{ width: `${max ? (total / max) * 100 : 0}%` }}>
        {segments
          .filter((s) => s.value > 0)
          .map((s, i, arr) => (
            <div
              key={s.key}
              className={`h-full ${i === arr.length - 1 ? "rounded-r" : ""}`}
              style={{ flexGrow: s.value / total, background: s.color }}
            />
          ))}
      </div>
      <span className="text-right text-xs tabular-nums text-muted">{suffix ?? total}</span>
    </div>
  );
}

export function StackedBars({
  rows,
}: {
  rows: { label: string; segments: Segment[]; suffix?: ReactNode }[];
}) {
  const max = Math.max(0, ...rows.map((r) => r.segments.reduce((s, x) => s + x.value, 0)));
  if (!rows.length) return <Empty />;
  return (
    <div>
      {rows.map((r) => (
        <StackedRow key={r.label} max={max} {...r} />
      ))}
    </div>
  );
}

// ---------- Barras horizontales de una serie ----------

function BarRow({
  label,
  value,
  max,
  display,
  tooltip,
  onClick,
  active,
}: {
  label: string;
  value: number;
  max: number;
  display: ReactNode;
  tooltip?: () => ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  const tip = useTip(tooltip ?? (() => <TipRow label={label} value={display} />));
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`grid w-full grid-cols-[minmax(6rem,40%)_1fr_auto] items-center gap-3 rounded py-1.5 text-left ${
        onClick ? "hover:bg-background" : ""
      } ${active ? "bg-primary/5" : ""}`}
      {...tip}
    >
      <span className="truncate text-sm" title={label}>
        {label}
      </span>
      <div className="h-4">
        <div
          className="h-full rounded-r"
          style={{ width: `${max ? Math.max((value / max) * 100, value ? 1 : 0) : 0}%`, background: SINGLE }}
        />
      </div>
      <span className="text-right text-xs font-medium tabular-nums">{display}</span>
    </Tag>
  );
}

export function BarList({
  rows,
  max,
}: {
  rows: {
    label: string;
    value: number;
    display?: ReactNode;
    tooltip?: () => ReactNode;
    onClick?: () => void;
    active?: boolean;
  }[];
  max?: number;
}) {
  if (!rows.length) return <Empty />;
  const m = max ?? Math.max(0, ...rows.map((r) => r.value));
  return (
    <div>
      {rows.map((r) => (
        <BarRow key={r.label} {...r} max={m} display={r.display ?? r.value} />
      ))}
    </div>
  );
}

// ---------- Columnas verticales (apiladas o simples) ----------

function Column({
  label,
  segments,
  max,
  tooltip,
  top,
}: {
  label: string;
  segments: Segment[];
  max: number;
  tooltip: () => ReactNode;
  top?: ReactNode;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const tip = useTip(tooltip);
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1" {...tip}>
      <div className="flex h-40 w-full flex-col items-center justify-end border-b border-border">
        <span className="mb-1 text-[11px] font-medium tabular-nums text-muted">{top ?? total}</span>
        <div
          className="flex w-full max-w-10 flex-col-reverse gap-[2px]"
          style={{ height: `${max ? (total / max) * 100 : 0}%` }}
        >
          {segments
            .filter((s) => s.value > 0)
            .map((s, i, arr) => (
              <div
                key={s.key}
                className={i === arr.length - 1 ? "rounded-t" : ""}
                style={{ flexGrow: s.value / total, background: s.color }}
              />
            ))}
        </div>
      </div>
      <span className="w-full truncate text-center text-[11px] text-muted">{label}</span>
    </div>
  );
}

export function Columns({
  columns,
  max,
}: {
  columns: { label: string; segments: Segment[]; tooltip: () => ReactNode; top?: ReactNode }[];
  max?: number;
}) {
  if (!columns.length) return <Empty />;
  const m = max ?? Math.max(0, ...columns.map((c) => c.segments.reduce((s, x) => s + x.value, 0)));
  return (
    <div className="flex items-end">
      {columns.map((c) => (
        <Column key={c.label} max={m} {...c} />
      ))}
    </div>
  );
}
