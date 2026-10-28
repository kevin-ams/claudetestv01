"use client";

import { Card } from "@heroui/react";
import { Check, ChevronDown } from "@gravity-ui/icons";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Bar, BarChart } from "recharts";
import { AppCheckbox } from "@/components/ui/checkbox";
import {
  fmtDays,
  fmtHours,
  fmtNum,
  fmtPct,
  type DimRow,
  type FunnelStep,
  type TimelinePoint,
} from "@/lib/domain/deals-shared";

export const SERIES = Array.from({ length: 8 }, (_, i) => `var(--series-${i + 1})`);
const AXIS = { tick: { fill: "var(--muted)", fontSize: 11 }, axisLine: false, tickLine: false } as const;

export function Section({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`min-w-0 p-4 ${className}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </Card>
  );
}

export function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "red" | "green" }) {
  return (
    <Card className="flex flex-col gap-0.5 p-3">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      <span className={`text-2xl font-bold tabular-nums ${tone === "red" ? "text-red" : tone === "green" ? "text-green" : ""}`}>{value}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </Card>
  );
}

/** Fila que se puede elegir con clic o con Enter/Espacio. */
function rowProps(selected: boolean, onToggle: () => void) {
  return {
    role: "button" as const,
    tabIndex: 0,
    "aria-pressed": selected,
    onClick: onToggle,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onToggle();
      }
    },
    className: `cursor-pointer border-b border-border last:border-0 outline-none transition-colors focus-visible:bg-primary/10 ${
      selected ? "bg-primary/10" : "hover:bg-default"
    }`,
  };
}

function SelectMark({ selected }: { selected: boolean }) {
  return (
    <span
      className={`mr-2 inline-flex size-4 shrink-0 items-center justify-center rounded border align-[-3px] ${
        selected ? "border-primary bg-primary text-primary-foreground" : "border-border"
      }`}
      aria-hidden
    >
      {selected && <Check width={12} height={12} />}
    </span>
  );
}

/** Barra apilada abiertos / convertidos / perdidos, proporcional al máximo de la tabla. */
function StackBar({ row, max }: { row: DimRow; max: number }) {
  const openNotConv = Math.max(0, row.total - row.converted - row.lost);
  const parts: [string, number, string][] = [
    ["Convertidos", row.converted, "var(--green)"],
    ["En proceso", openNotConv, "var(--chart-actual)"],
    ["Perdidos", row.lost, "var(--red)"],
  ];
  return (
    <div className="flex h-2.5 gap-[2px]" style={{ width: `${Math.max(2, (row.total / max) * 100)}%` }}>
      {parts.map(([k, v, c]) => (v > 0 ? <div key={k} className="h-full rounded-[3px]" style={{ flexGrow: v, background: c }} title={`${k}: ${v}`} /> : null))}
    </div>
  );
}

export function StackLegend() {
  return (
    <div className="mb-2 flex flex-wrap gap-3 text-xs text-muted">
      {[
        ["Convertidos", "var(--green)"],
        ["En proceso", "var(--chart-actual)"],
        ["Perdidos", "var(--red)"],
      ].map(([l, c]) => (
        <span key={l} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: c }} />
          {l}
        </span>
      ))}
    </div>
  );
}

export type Column = { label: string; title?: string; render: (r: DimRow) => ReactNode; className?: string };

export const COL = {
  total: { label: "Tratos", render: (r: DimRow) => <b>{fmtNum(r.total)}</b> },
  open: { label: "Abiertos", render: (r: DimRow) => fmtNum(r.open) },
  converted: { label: "Convertidos", render: (r: DimRow) => fmtNum(r.converted) },
  rate: { label: "Conversión", title: "Convertidos / tratos", render: (r: DimRow) => fmtPct(r.conversionRate) },
  firstNote: { label: "1.ª nota", title: "Mediana del tiempo desde la creación hasta la primera nota", render: (r: DimRow) => fmtHours(r.medianHoursToFirstNote) },
  stale: { label: "Estancados", render: (r: DimRow) => <span className={r.stale ? "text-red" : ""}>{fmtNum(r.stale)}</span> },
  noNote: { label: "Sin notas", render: (r: DimRow) => <span className={r.noNote ? "text-red" : ""}>{fmtNum(r.noNote)}</span> },
  notesPerDeal: { label: "Notas/trato", render: (r: DimRow) => (r.avgNotesPerDeal === null ? "—" : r.avgNotesPerDeal.toFixed(1)) },
  daysInStage: { label: "Días en etapa", render: (r: DimRow) => fmtDays(r.avgDaysInStage) },
} satisfies Record<string, Column>;

/** Tabla de una dimensión: clic en una fila la agrega o quita del filtro. */
export function DimTable({
  rows,
  label,
  selected,
  onToggle,
  columns = [COL.total, COL.open, COL.converted, COL.rate, COL.firstNote, COL.stale],
  limit = 15,
  extra,
}: {
  rows: DimRow[];
  label: string;
  selected: string[];
  onToggle: (value: string) => void;
  columns?: Column[];
  limit?: number;
  extra?: (r: DimRow) => ReactNode;
}) {
  const [all, setAll] = useState(false);
  if (!rows.length) return <p className="text-sm text-muted">Sin tratos con estos filtros.</p>;
  const max = Math.max(1, ...rows.map((r) => r.total));
  // Las filas elegidas siempre se ven, aunque queden fuera del límite.
  const shown = all ? rows : rows.filter((r, i) => i < limit || selected.includes(r.value_key));
  return (
    <div className="overflow-x-auto">
      <table className="w-full whitespace-nowrap text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th className="py-2 pr-3 font-medium">{label}</th>
            <th className="w-1/5 min-w-20 py-2 pr-3" />
            {columns.map((c) => (
              <th key={c.label} className="py-2 pr-3 text-right font-medium last:pr-0" title={c.title}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => {
            const isSel = selected.includes(r.value_key);
            return (
              <tr key={r.value_key} {...rowProps(isSel, () => onToggle(r.value_key))}>
                <td className="max-w-64 truncate py-2 pr-3" title={r.label}>
                  <SelectMark selected={isSel} />
                  {r.label}
                  {extra?.(r)}
                </td>
                <td className="py-2 pr-3">
                  <StackBar row={r} max={max} />
                </td>
                {columns.map((c) => (
                  <td key={c.label} className={`py-2 pr-3 text-right tabular-nums last:pr-0 ${c.className ?? ""}`}>
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length > shown.length && (
        <button type="button" className="mt-2 text-xs text-primary hover:underline" onClick={() => setAll(true)}>
          Ver las {rows.length} filas
        </button>
      )}
    </div>
  );
}

/** Embudo: barras centradas por etapa (tratos que llegaron), con el paso de una etapa a la siguiente. */
export function FunnelChart({
  steps,
  selected,
  onToggle,
}: {
  steps: FunnelStep[];
  selected: string[];
  onToggle: (key: string) => void;
}) {
  if (!steps.length) return <p className="text-sm text-muted">Sin tratos con estos filtros.</p>;
  const top = Math.max(1, steps[0].reached);
  return (
    <ol className="flex flex-col gap-1.5">
      {steps.map((s, i) => {
        const isSel = selected.includes(s.key);
        const prev = i > 0 ? steps[i - 1].reached : null;
        const width = Math.max(4, (s.reached / top) * 100);
        return (
          <li key={s.key}>
            {prev !== null && (
              <p className="py-0.5 text-center text-[11px] text-muted">
                ↓ {fmtPct(prev ? s.reached / prev : null)} pasa a la siguiente etapa
              </p>
            )}
            <div
              {...rowProps(isSel, () => onToggle(s.key))}
              className={`group grid cursor-pointer grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-lg px-2 py-1 outline-none transition-colors focus-visible:bg-primary/10 sm:grid-cols-[minmax(8rem,14rem)_1fr_auto] ${
                isSel ? "bg-primary/10" : "hover:bg-default"
              }`}
            >
              <span className="truncate text-sm" title={s.name}>
                <SelectMark selected={isSel} />
                {s.name}
              </span>
              {/* En pantallas chicas la barra ocupa su propia línea, debajo del nombre. */}
              <span className="order-last col-span-2 flex justify-center sm:order-none sm:col-span-1">
                <span
                  className="flex h-7 min-w-10 items-center justify-center rounded-md px-1 text-xs font-semibold text-white tabular-nums"
                  style={{ width: `${width}%`, background: s.conversion ? "var(--green)" : "var(--chart-actual)" }}
                >
                  {fmtNum(s.reached)}
                </span>
              </span>
              <span className="text-right text-xs text-muted tabular-nums sm:w-28">
                {fmtPct(s.reached / top)} del total
                <br />
                {fmtNum(s.current)} aquí ahora
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Barras horizontales simples y clicables (p. ej. antigüedad en la etapa). */
export function BarList({
  rows,
  selected,
  onToggle,
}: {
  rows: { key: string; label: string; value: number }[];
  selected: string[];
  onToggle: (key: string) => void;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-1">
      {rows.map((r) => {
        const isSel = selected.includes(r.key);
        return (
          <li key={r.key} {...rowProps(isSel, () => onToggle(r.key))} className={`cursor-pointer rounded-md px-2 py-1 outline-none focus-visible:bg-primary/10 ${isSel ? "bg-primary/10" : "hover:bg-default"}`}>
            <div className="mb-0.5 flex justify-between text-xs">
              <span>
                <SelectMark selected={isSel} />
                {r.label}
              </span>
              <b className="tabular-nums">{fmtNum(r.value)}</b>
            </div>
            <div className="h-2 rounded bg-default">
              <div className="h-2 rounded" style={{ width: `${(r.value / max) * 100}%`, background: "var(--chart-actual)" }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="inline-block size-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted">{p.name}:</span>
          <b className="tabular-nums">{fmtNum(p.value)}</b>
        </p>
      ))}
    </div>
  );
}

/** Tratos creados en el tiempo; con varias carreras/facultades elegidas, una línea por cada una. */
export function TimelineChart({ points, series }: { points: TimelinePoint[]; series: string[] }) {
  const data = useMemo(
    // Claves internas s0, s1…: los nombres de carrera pueden traer puntos, que recharts lee como rutas.
    () => points.map((p) => ({ label: p.label, Tratos: p.total, ...Object.fromEntries(series.map((s, i) => [`s${i}`, p.series[s] ?? 0])) })),
    [points, series]
  );
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        {series.length ? (
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" {...AXIS} minTickGap={16} />
            <YAxis allowDecimals={false} {...AXIS} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
            {series.map((s, i) => (
              <Line key={s} type="linear" dataKey={`s${i}`} name={s} stroke={SERIES[i % SERIES.length]} strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 5 }} isAnimationActive={false} />
            ))}
          </LineChart>
        ) : (
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" {...AXIS} minTickGap={16} />
            <YAxis allowDecimals={false} {...AXIS} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--chart-cursor)" }} />
            <Bar dataKey="Tratos" fill="var(--chart-actual)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

/** Desplegable con casillas y búsqueda para elegir varios valores. */
export function MultiFilter({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string; count?: number; group?: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const needle = q.trim().toLowerCase();
  const visible = options.filter((o) => !needle || o.label.toLowerCase().includes(needle) || o.group?.toLowerCase().includes(needle));
  const summary = value.length === 0 ? "Todos" : value.length === 1 ? (options.find((o) => o.value === value[0])?.label ?? value[0]) : `${value.length} elegidos`;
  const toggle = (v: string, on: boolean) => onChange(on ? [...value, v] : value.filter((x) => x !== v));

  return (
    <div ref={box} className="relative flex min-w-0 flex-col gap-1 text-xs text-muted">
      {label}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-9 w-full items-center justify-between gap-2 rounded-xl border bg-card px-3 text-left text-sm shadow-xs hover:bg-default ${
          value.length ? "border-primary text-foreground" : "border-border text-foreground"
        }`}
      >
        <span className="truncate">{summary}</span>
        <ChevronDown className="shrink-0 text-muted" aria-hidden />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 flex max-h-80 w-72 flex-col gap-1 rounded-xl border border-border bg-card p-2 text-foreground shadow-lg" role="listbox" aria-multiselectable>
          {options.length > 8 && (
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar…"
              className="mb-1 h-8 rounded-lg border border-border bg-card px-2 text-sm outline-none focus:border-primary"
            />
          )}
          <div className="flex flex-col gap-0.5 overflow-y-auto">
            {visible.map((o, i) => (
              <div key={o.value}>
                {o.group && o.group !== visible[i - 1]?.group && <p className="mt-1 px-1 text-[11px] font-semibold uppercase text-muted">{o.group}</p>}
                <AppCheckbox checked={value.includes(o.value)} onChange={(e) => toggle(o.value, e.target.checked)}>
                  <span className="text-sm">
                    {o.label}
                    {o.count !== undefined && <span className="ml-1 text-xs text-muted">({o.count})</span>}
                  </span>
                </AppCheckbox>
              </div>
            ))}
            {visible.length === 0 && <p className="px-1 py-2 text-sm text-muted">Sin resultados.</p>}
          </div>
          {value.length > 0 && (
            <button type="button" className="mt-1 self-start px-1 text-xs text-primary hover:underline" onClick={() => onChange([])}>
              Quitar selección
            </button>
          )}
        </div>
      )}
    </div>
  );
}
