"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  Career,
  PublicUser,
  ScorecardMetric,
  ScorecardOwner,
  ScorecardTarget,
} from "@/lib/domain/types";
import type { CareerHistory } from "@/lib/domain/careers";
import {
  CAREER_LEVELS,
  careerLabel,
  money,
  num,
  pct,
  totalsFor,
  type CareerRow,
} from "@/lib/domain/careers-shared";
import { formatWeekLabel, shiftWeek } from "@/lib/utils/dates";

// Paleta validada (dataviz): real = azul (serie 1), meta/plan = naranja (serie 2).
const C = {
  actual: "#2a78d6",
  goal: "#eb6834",
  grid: "#e1e0d9",
  axis: "#6b7280",
  text: "#171923",
};
const AXIS_PROPS = { tick: { fill: C.axis, fontSize: 12 }, axisLine: false, tickLine: false } as const;

type Scorecard = {
  owners: ScorecardOwner[];
  metrics: ScorecardMetric[];
  targets: ScorecardTarget[];
  grid: Record<string, number | null>;
};

type Fmt = (v: number | null) => string;

function ChartTooltip({
  active,
  payload,
  label,
  fmt,
}: {
  active?: boolean;
  payload?: { name: string; value: number | null; color: string }[];
  label?: string;
  fmt: Fmt;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted">{p.name}:</span>
          <span className="font-semibold tabular-nums">{fmt(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

/** Tarjeta de gráfica con alternativa en tabla (accesible y para copiar datos). */
function ChartCard({
  title,
  subtitle,
  table,
  children,
}: {
  title: string;
  subtitle?: string;
  table: { columns: string[]; rows: (string | number)[][] };
  children: ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className="eos-card flex flex-col gap-2 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
        </div>
        <button className="text-xs font-medium text-primary underline" onClick={() => setAsTable((v) => !v)}>
          {asTable ? "Ver gráfica" : "Ver tabla"}
        </button>
      </div>
      {asTable ? (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted">
                {table.columns.map((c) => (
                  <th key={c} className="py-1.5 pr-3">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  {r.map((cell, j) => (
                    <td key={j} className={`py-1.5 pr-3 ${j > 0 ? "tabular-nums" : ""}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-72">{children}</div>
      )}
    </section>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="eos-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {detail && <p className="text-xs text-muted">{detail}</p>}
    </div>
  );
}

const PRESETS = [
  { weeks: 4, label: "4 semanas" },
  { weeks: 8, label: "8 semanas" },
  { weeks: 12, label: "12 semanas" },
  { weeks: 26, label: "6 meses" },
  { weeks: 52, label: "1 año" },
];

export function AnalysisBoard({
  from,
  to,
  history,
  members,
  scorecard,
}: {
  from: string;
  to: string;
  history: CareerHistory;
  members: PublicUser[];
  scorecard: Scorecard;
}) {
  const router = useRouter();
  const [program, setProgram] = useState("");
  const [owner, setOwner] = useState("");
  const [level, setLevel] = useState("");
  const [career, setCareer] = useState("");
  const [metricId, setMetricId] = useState(scorecard.metrics[0]?.id ?? 0);
  const [scOwnerId, setScOwnerId] = useState(
    (scorecard.owners.find((o) => o.is_rollup) ?? scorecard.owners[0])?.id ?? 0
  );

  const ownerName = (id: number | null) => members.find((m) => m.id === id)?.name ?? "Sin responsable";
  const programs = [...new Set(history.careers.map((c) => c.program))].sort((a, b) => a.localeCompare(b, "es"));
  const keep = (c: Career | CareerRow) =>
    (!program || c.program === program) &&
    (!owner || String(c.owner_id) === owner) &&
    (!level || c.level === level) &&
    (!career || String(c.id) === career);

  // Los datos son pocos (carreras × semanas), así que se calcula directo en cada render.
  const weekly = history.weeks.map((w) => {
    const t = totalsFor(history.byWeek[w].filter(keep));
    return {
      week: formatWeekLabel(w),
      leads: t.hasLeads ? t.leads : null,
      leadsGoal: Math.round(t.leadsGoal * 10) / 10,
      spent: t.hasSpent ? Math.round(t.spent * 100) / 100 : null,
      budget: Math.round(t.budgetGoal * 100) / 100,
      cpl: t.hasSpent && t.leads ? Math.round((t.spent / t.leads) * 100) / 100 : null,
    };
  });
  const allRows = history.weeks.flatMap((w) => history.byWeek[w].filter(keep));
  const total = totalsFor(allRows);

  const byOwner = [...new Set(allRows.map((r) => r.owner_id))]
    .map((id) => {
      const t = totalsFor(allRows.filter((r) => r.owner_id === id));
      return { name: ownerName(id), leads: t.leads, leadsGoal: Math.round(t.leadsGoal) };
    })
    .sort((a, b) => b.leads - a.leads);

  // Top 10 programas; el resto se agrupa en "Otros" para que las etiquetas se lean.
  const programTotals = [...new Set(allRows.map((r) => r.program))]
    .map((p) => ({ name: p, leads: totalsFor(allRows.filter((r) => r.program === p)).leads }))
    .sort((a, b) => b.leads - a.leads);
  const byProgram =
    programTotals.length > 10
      ? [
          ...programTotals.slice(0, 10),
          { name: "Otros", leads: programTotals.slice(10).reduce((sum, p) => sum + p.leads, 0) },
        ]
      : programTotals;

  // Brecha por carrera en el rango (solo con meta).
  const gaps = history.careers
    .filter(keep)
    .map((c) => {
      const t = totalsFor(allRows.filter((r) => r.id === c.id));
      return { career: c, leads: t.leads, goal: t.leadsGoal, spent: t.spent };
    })
    .filter((g) => g.goal > 0)
    .sort((a, b) => a.leads / a.goal - b.leads / b.goal)
    .slice(0, 10);

  // Scorecard: tendencia de un indicador.
  const metric = scorecard.metrics.find((m) => m.id === metricId);
  const scTarget = scorecard.targets.find((t) => t.metric_id === metricId && t.owner_id === scOwnerId)?.target_value ?? null;
  const scSeries = history.weeks.map((w) => ({
    week: formatWeekLabel(w),
    value: scorecard.grid[`${metricId}:${scOwnerId}:${w}`] ?? null,
  }));

  function setRange(weeks: number) {
    router.push(`/analisis?desde=${shiftWeek(to, -(weeks - 1))}&hasta=${to}`);
  }

  const leadsTable = {
    columns: ["Semana", "Leads", "Meta"],
    rows: weekly.map((d) => [d.week, num(d.leads), num(d.leadsGoal)]),
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Filtros: una sola fila arriba de las gráficas */}
      <div className="eos-card flex flex-wrap items-center gap-2 p-3">
        <div className="flex gap-1 rounded-lg bg-background p-1">
          {PRESETS.map((p) => (
            <button
              key={p.weeks}
              onClick={() => setRange(p.weeks)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                history.weeks.length === p.weeks && history.weeks.at(-1) === to ? "bg-card shadow-sm" : "text-muted"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1 text-xs text-muted">
          Desde
          <input
            type="date"
            className="eos-input !w-auto"
            defaultValue={from}
            onChange={(e) => e.target.value && router.push(`/analisis?desde=${e.target.value}&hasta=${to}`)}
          />
        </label>
        <label className="flex items-center gap-1 text-xs text-muted">
          Hasta
          <input
            type="date"
            className="eos-input !w-auto"
            defaultValue={to}
            onChange={(e) => e.target.value && router.push(`/analisis?desde=${from}&hasta=${e.target.value}`)}
          />
        </label>
        <select className="eos-input !w-auto" value={program} onChange={(e) => { setProgram(e.target.value); setCareer(""); }} aria-label="Programa">
          <option value="">Todos los programas</option>
          {programs.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select className="eos-input !w-auto" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Responsable">
          <option value="">Todos los responsables</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <select className="eos-input !w-auto" value={level} onChange={(e) => setLevel(e.target.value)} aria-label="Nivel">
          <option value="">Todos los niveles</option>
          {CAREER_LEVELS.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
        <select className="eos-input !w-auto max-w-64" value={career} onChange={(e) => setCareer(e.target.value)} aria-label="Carrera">
          <option value="">Todas las carreras</option>
          {history.careers
            .filter((c) => !program || c.program === program)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {careerLabel(c)}
              </option>
            ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Leads del período" value={num(total.leads)} detail={`Meta ${num(Math.round(total.leadsGoal))} · ${pct(total.leads, total.leadsGoal)}`} />
        <Stat label="Consumo del período" value={money(total.spent)} detail={`Plan ${money(total.budgetGoal)} · ${pct(total.spent, total.budgetGoal)}`} />
        <Stat label="Costo por lead" value={total.leads ? money(total.spent / total.leads) : "—"} />
        <Stat
          label="Semanas en meta de leads"
          value={`${weekly.filter((w) => w.leads !== null && w.leadsGoal > 0 && w.leads >= w.leadsGoal).length} de ${weekly.length}`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Leads por semana" subtitle="Leads recibidos contra la meta de cada semana" table={leadsTable}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={weekly} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis dataKey="week" {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} allowDecimals={false} />
              <Tooltip content={<ChartTooltip fmt={num} />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: C.text }} />
              <Bar isAnimationActive={false} dataKey="leads" name="Leads" fill={C.actual} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Line dataKey="leadsGoal" name="Meta" stroke={C.goal} strokeWidth={2} dot={{ r: 4, fill: C.goal, strokeWidth: 2, stroke: "#fff" }} type="linear" isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Consumo de presupuesto por semana"
          subtitle="Importe gastado contra el presupuesto de cada semana (Q)"
          table={{ columns: ["Semana", "Consumo", "Presupuesto"], rows: weekly.map((d) => [d.week, money(d.spent), money(d.budget)]) }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={weekly} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis dataKey="week" {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} tickFormatter={(v: number) => `Q${num(v)}`} />
              <Tooltip content={<ChartTooltip fmt={money} />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: C.text }} />
              <Bar isAnimationActive={false} dataKey="spent" name="Consumo" fill={C.actual} radius={[4, 4, 0, 0]} maxBarSize={28} />
              <Line dataKey="budget" name="Presupuesto" stroke={C.goal} strokeWidth={2} dot={{ r: 4, fill: C.goal, strokeWidth: 2, stroke: "#fff" }} type="linear" isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Costo por lead"
          subtitle="Consumo de la semana entre leads recibidos (Q)"
          table={{ columns: ["Semana", "Costo por lead"], rows: weekly.map((d) => [d.week, money(d.cpl)]) }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weekly} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={C.grid} />
              <XAxis dataKey="week" {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} tickFormatter={(v: number) => `Q${num(v)}`} />
              <Tooltip content={<ChartTooltip fmt={money} />} />
              <Line dataKey="cpl" name="Costo por lead" stroke={C.actual} strokeWidth={2} dot={{ r: 4, fill: C.actual, strokeWidth: 2, stroke: "#fff" }} connectNulls type="linear" isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Leads por responsable"
          subtitle="Total del período contra la meta acumulada"
          table={{ columns: ["Responsable", "Leads", "Meta"], rows: byOwner.map((d) => [d.name, num(d.leads), num(d.leadsGoal)]) }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byOwner} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }} barGap={2}>
              <CartesianGrid horizontal={false} stroke={C.grid} />
              <XAxis type="number" {...AXIS_PROPS} allowDecimals={false} />
              <YAxis type="category" dataKey="name" {...AXIS_PROPS} width={90} />
              <Tooltip content={<ChartTooltip fmt={num} />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12, color: C.text }} />
              <Bar isAnimationActive={false} dataKey="leads" name="Leads" fill={C.actual} radius={[0, 4, 4, 0]} maxBarSize={16} />
              <Bar isAnimationActive={false} dataKey="leadsGoal" name="Meta" fill={C.goal} radius={[0, 4, 4, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Leads por programa"
          subtitle="Total del período, los 10 con más leads (la tabla trae todos)"
          table={{ columns: ["Programa", "Leads"], rows: programTotals.map((d) => [d.name, num(d.leads)]) }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={byProgram} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke={C.grid} />
              <XAxis type="number" {...AXIS_PROPS} allowDecimals={false} />
              <YAxis type="category" dataKey="name" {...AXIS_PROPS} width={90} interval={0} />
              <Tooltip content={<ChartTooltip fmt={num} />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Bar isAnimationActive={false} dataKey="leads" name="Leads" fill={C.actual} radius={[0, 4, 4, 0]} maxBarSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Scorecard: tendencia de un indicador"
          subtitle={metric ? `${metric.name}${scTarget !== null ? ` · meta ${scTarget}` : ""}` : "Sin indicadores configurados"}
          table={{ columns: ["Semana", "Valor"], rows: scSeries.map((d) => [d.week, d.value ?? "—"]) }}
        >
          {scorecard.metrics.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-muted">
              Agrega indicadores en Scorecard para verlos aquí.
            </p>
          ) : (
            <div className="flex h-full flex-col gap-2">
              <div className="flex flex-wrap gap-2">
                <select className="eos-input !w-auto max-w-72 text-xs" value={metricId} onChange={(e) => setMetricId(Number(e.target.value))} aria-label="Indicador">
                  {scorecard.metrics.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <select className="eos-input !w-auto text-xs" value={scOwnerId} onChange={(e) => setScOwnerId(Number(e.target.value))} aria-label="Dueño">
                  {scorecard.owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-h-0 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={scSeries} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={C.grid} />
                    <XAxis dataKey="week" {...AXIS_PROPS} />
                    <YAxis {...AXIS_PROPS} />
                    <Tooltip content={<ChartTooltip fmt={num} />} />
                    {scTarget !== null && (
                      <ReferenceLine y={scTarget} stroke={C.goal} strokeWidth={2} strokeDasharray="6 4" label={{ value: "Meta", fill: C.axis, fontSize: 11, position: "insideTopRight" }} />
                    )}
                    <Line dataKey="value" name={metric?.name ?? "Valor"} stroke={C.actual} strokeWidth={2} dot={{ r: 4, fill: C.actual, strokeWidth: 2, stroke: "#fff" }} connectNulls type="linear" isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      <section className="eos-card p-4">
        <h2 className="font-semibold">Carreras más lejos de su meta de leads</h2>
        <p className="mb-2 text-xs text-muted">Acumulado del período, solo carreras con meta.</p>
        {gaps.length === 0 ? (
          <p className="text-sm text-muted">Sin metas cargadas para este período (se definen en Metas de carrera).</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase text-muted">
                  <th className="py-1.5 pr-3">Carrera</th>
                  <th className="pr-3">Responsable</th>
                  <th className="pr-3 text-right">Leads</th>
                  <th className="pr-3 text-right">Meta</th>
                  <th className="pr-3 text-right">% meta</th>
                  <th className="text-right">Consumo</th>
                </tr>
              </thead>
              <tbody>
                {gaps.map((g) => (
                  <tr key={g.career.id} className="border-b border-border last:border-0">
                    <td className="py-1.5 pr-3">{careerLabel(g.career)}</td>
                    <td className="pr-3">{ownerName(g.career.owner_id)}</td>
                    <td className="pr-3 text-right tabular-nums">{num(g.leads)}</td>
                    <td className="pr-3 text-right tabular-nums">{num(Math.round(g.goal))}</td>
                    <td className="pr-3 text-right font-semibold tabular-nums">{pct(g.leads, g.goal)}</td>
                    <td className="text-right tabular-nums">{money(g.spent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
