"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  EMPTY_FILTERS,
  INTEREST_LABEL,
  OUTCOME_LABEL,
  PRIOR_LABEL,
  agentStats,
  applyFilters,
  dailySeries,
  followUps,
  groupBy,
  hourlySeries,
  isCalled,
  leadAgeSeries,
  programStats,
  rates,
  recommendations,
  themeCounts,
  type Filters,
  type Rates,
  type Recommendation,
} from "@/lib/calls/analytics";
import type { CallOutcome, CallRecord, InterestLevel, PriorContact } from "@/lib/calls/types";
import {
  BarList,
  ChartCard,
  Columns,
  Empty,
  Legend,
  SERIES,
  StackedBars,
  TipRow,
  TooltipLayer,
  fmtPct,
  type Segment,
} from "./charts";
import { MultiSelect, type Option } from "./filters";
import { UploadButton } from "./upload-button";

const OUTCOME_KEYS = ["efectiva", "no_contesto", "numero_equivocado", "otro"] as const;

function outcomeSegments(r: Pick<Rates, "effective" | "noAnswer" | "wrongNumber" | "calls">): Segment[] {
  const other = r.calls - r.effective - r.noAnswer - r.wrongNumber;
  const values = [r.effective, r.noAnswer, r.wrongNumber, other];
  return OUTCOME_KEYS.map((key, i) => ({
    key,
    label: OUTCOME_LABEL[key],
    value: values[i],
    color: SERIES[key],
  })).filter((s) => s.key !== "otro" || s.value > 0);
}

const OUTCOME_LEGEND = OUTCOME_KEYS.slice(0, 3).map((k) => ({
  label: OUTCOME_LABEL[k],
  color: SERIES[k],
}));

function isoDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDay(iso: string | null, withYear = false) {
  if (!iso) return "Sin fecha";
  const [y, m, d] = iso.split("-");
  return withYear ? `${d}/${m}/${y}` : `${d}/${m}`;
}

function countOptions<T extends string>(
  records: CallRecord[],
  key: (r: CallRecord) => T | T[] | null,
  label: (v: T) => string = (v) => v
): Option<T>[] {
  const counts = new Map<T, number>();
  for (const r of records) {
    const k = key(r);
    for (const v of Array.isArray(k) ? k : k === null ? [] : [k]) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, label: label(value), count }));
}

// ---------- KPI ----------

function Kpi({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="card flex flex-col gap-1 p-4">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      <span className="text-2xl font-bold tabular-nums">{value}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

const TONE: Record<Recommendation["tone"], { icon: string; label: string; cls: string }> = {
  action: { icon: "➜", label: "Acción", cls: "border-l-primary" },
  warning: { icon: "⚠", label: "Atención", cls: "border-l-accent" },
  insight: { icon: "◆", label: "Hallazgo", cls: "border-l-green" },
};

// ---------- CSV ----------

function downloadCsv(records: CallRecord[]) {
  const header = [
    "Hoja", "Carrera", "Nombre", "Teléfono", "Fecha lead", "Asesor", "Día", "Hora",
    "Estado", "Ya lo llamaron", "Interés", "Observaciones",
  ];
  const rows = records.map((r) => [
    r.sheet, r.program, r.name, r.phone, r.leadDate ?? "", r.agent ?? "",
    r.callDate ? fmtDay(r.callDate, true) : "", r.callTime ?? "",
    OUTCOME_LABEL[r.outcome], r.priorContact ? PRIOR_LABEL[r.priorContact] : "",
    r.interests.map((i) => INTEREST_LABEL[i]).join(", "), r.notes,
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `llamadas-${isoDay(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function waLink(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits.length === 8 ? "502" + digits : digits}`;
}

// ---------- Dashboard ----------

export function CallsDashboard({
  records,
  fileName,
  uploadedAt,
  uploadedBy,
  warnings,
}: {
  records: CallRecord[];
  fileName: string;
  uploadedAt: string;
  uploadedBy: string | null;
  warnings: string[];
}) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(0);
  };

  const allCalls = useMemo(() => records.filter(isCalled), [records]);
  const { universe, calls } = useMemo(() => applyFilters(records, filters), [records, filters]);

  const options = useMemo(
    () => ({
      agents: countOptions(allCalls, (r) => r.agent ?? "(Sin asesor)"),
      faculties: countOptions(records, (r) => r.faculty),
      levels: countOptions(records, (r) => r.level),
      programs: countOptions(
        records.filter(
          (r) =>
            (!filters.faculties.length || filters.faculties.includes(r.faculty)) &&
            (!filters.levels.length || filters.levels.includes(r.level))
        ),
        (r) => r.program
      ),
      outcomes: countOptions<CallOutcome>(allCalls, (r) => r.outcome, (v) => OUTCOME_LABEL[v]),
      interests: countOptions<InterestLevel | "sin_dato">(
        allCalls,
        (r) => (r.interests.length ? r.interests : "sin_dato"),
        (v) => (v === "sin_dato" ? "Sin dato" : INTEREST_LABEL[v])
      ),
      prior: countOptions<PriorContact | "sin_dato">(
        allCalls,
        (r) => r.priorContact ?? "sin_dato",
        (v) => PRIOR_LABEL[v]
      ),
      dates: [...new Set(allCalls.map((r) => r.callDate).filter(Boolean) as string[])].sort(),
    }),
    [records, allCalls, filters.faculties, filters.levels]
  );
  const undatedCount = allCalls.filter((r) => !r.callDate).length;

  const total = useMemo(() => rates(calls), [calls]);
  const pendingInUniverse = universe.filter((r) => !isCalled(r)).length;
  const agents = useMemo(() => agentStats(calls), [calls]);
  const daily = useMemo(() => dailySeries(calls), [calls]);
  const hourly = useMemo(() => hourlySeries(calls), [calls]);
  const ages = useMemo(() => leadAgeSeries(calls), [calls]);
  const programs = useMemo(() => programStats(universe, calls), [universe, calls]);
  const themes = useMemo(() => themeCounts(calls), [calls]);
  const follow = useMemo(() => followUps(calls), [calls]);
  const recs = useMemo(() => recommendations(universe, calls), [universe, calls]);

  const interestRows = (
    [
      ["interesado", total.interested],
      ["solo_info", total.infoOnly],
      ["inscrito", total.enrolled],
      ["no_interesa", total.notInterested],
    ] as const
  ).map(([key, value]) => ({
    label: INTEREST_LABEL[key],
    value,
    display: `${value} · ${fmtPct(total.effective ? value / total.effective : 0)}`,
    active: filters.interests.includes(key),
    onClick: () =>
      set(
        "interests",
        filters.interests.includes(key)
          ? filters.interests.filter((i) => i !== key)
          : [...filters.interests, key]
      ),
  }));

  const priorGroups = groupBy(
    calls.filter((r) => r.outcome === "efectiva"),
    (r) => r.priorContact ?? "sin_dato"
  );
  const effectiveCount = calls.filter((r) => r.outcome === "efectiva").length;
  const priorRows = (["no", "si", "no_recuerda", "sin_dato"] as const)
    .filter((k) => priorGroups.has(k))
    .map((k) => {
      const list = priorGroups.get(k)!;
      const interested = list.filter((r) => r.interests.includes("interesado")).length;
      return {
        label: PRIOR_LABEL[k],
        value: list.length,
        display: `${list.length} · ${fmtPct(list.length / effectiveCount)}`,
        tooltip: () => (
          <div className="space-y-1">
            <p className="font-semibold">{PRIOR_LABEL[k]}</p>
            <TipRow label="Llamadas efectivas" value={list.length} />
            <TipRow label="Interesados" value={`${interested} (${fmtPct(interested / list.length)})`} />
          </div>
        ),
        active: filters.prior.includes(k),
        onClick: () =>
          set("prior", filters.prior.includes(k) ? filters.prior.filter((p) => p !== k) : [...filters.prior, k]),
      };
    });

  const rateTooltip = (title: string, r: Rates) =>
    function rateTip() {
      return (
    <div className="space-y-1">
      <p className="font-semibold">{title}</p>
      <TipRow label="Llamadas" value={r.calls} />
      <TipRow color={SERIES.efectiva} label="Efectivas" value={`${r.effective} (${fmtPct(r.contactRate)})`} />
      <TipRow color={SERIES.no_contesto} label="No contestó" value={r.noAnswer} />
      <TipRow label="Interesados" value={r.interested} />
    </div>
      );
    };

  const today = isoDay(new Date());
  const lastCallDay = options.dates[options.dates.length - 1] ?? today;
  const daysAgo = (base: string, n: number) => {
    const d = new Date(`${base}T12:00:00`);
    d.setDate(d.getDate() - n);
    return isoDay(d);
  };
  const presets = [
    { label: "Hoy", from: today, to: today },
    { label: "Último día con llamadas", from: lastCallDay, to: lastCallDay },
    { label: "Últimos 7 días", from: daysAgo(today, 6), to: today },
    { label: "Este mes", from: today.slice(0, 8) + "01", to: today },
    { label: "Todo", from: "", to: "" },
  ];

  const activeFilterCount =
    Number(Boolean(filters.from || filters.to)) +
    Number(!filters.includeUndated) +
    Number(Boolean(filters.search)) +
    (["agents", "faculties", "levels", "programs", "outcomes", "interests", "prior"] as const).filter(
      (k) => filters[k].length > 0
    ).length;

  const PAGE = 25;
  const detail = [...calls].sort(
    (a, b) =>
      (b.callDate ?? "").localeCompare(a.callDate ?? "") ||
      (b.callTime ?? "").localeCompare(a.callTime ?? "")
  );

  return (
    <TooltipLayer>
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Encabezado */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Campaña de llamadas en frío</h1>
            <p className="text-sm text-muted">
              Archivo <span className="font-medium">{fileName}</span> · subido{" "}
              <span suppressHydrationWarning>
                {new Date(uploadedAt).toLocaleString("es-GT", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
              {uploadedBy && <> por {uploadedBy}</>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => downloadCsv(detail)}>
              Exportar CSV
            </button>
            <UploadButton />
          </div>
        </div>

        {/* Filtros */}
        <section className="card space-y-4 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                Desde
              </span>
              <input
                type="date"
                className="input !w-auto"
                value={filters.from}
                max={filters.to || undefined}
                onChange={(e) => set("from", e.target.value)}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                Hasta
              </span>
              <input
                type="date"
                className="input !w-auto"
                value={filters.to}
                min={filters.from || undefined}
                onChange={(e) => set("to", e.target.value)}
              />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => {
                const active = filters.from === p.from && filters.to === p.to;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setFilters((f) => ({ ...f, from: p.from, to: p.to }));
                      setPage(0);
                    }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card hover:bg-background"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            {undatedCount > 0 && (
              <label className="flex items-center gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.includeUndated}
                  onChange={(e) => set("includeUndated", e.target.checked)}
                />
                Incluir llamadas sin fecha ({undatedCount})
              </label>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
            <MultiSelect label="Asesor" options={options.agents} selected={filters.agents} onChange={(v) => set("agents", v)} />
            <MultiSelect label="Facultad" options={options.faculties} selected={filters.faculties} onChange={(v) => set("faculties", v)} />
            <MultiSelect label="Nivel" options={options.levels} selected={filters.levels} onChange={(v) => set("levels", v)} />
            <MultiSelect label="Carrera" options={options.programs} selected={filters.programs} onChange={(v) => set("programs", v)} />
            <MultiSelect label="Resultado" options={options.outcomes} selected={filters.outcomes} onChange={(v) => set("outcomes", v)} />
            <MultiSelect label="Interés" options={options.interests} selected={filters.interests} onChange={(v) => set("interests", v)} />
            <MultiSelect label="¿Ya lo llamaron?" options={options.prior} selected={filters.prior} onChange={(v) => set("prior", v)} />
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                Buscar
              </span>
              <input
                type="search"
                className="input"
                placeholder="Nombre, teléfono, nota…"
                value={filters.search}
                onChange={(e) => set("search", e.target.value)}
              />
            </label>
          </div>
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-3 text-xs text-muted">
              <span>
                {activeFilterCount} filtro{activeFilterCount === 1 ? "" : "s"} activo
                {activeFilterCount === 1 ? "" : "s"} · {calls.length} llamadas de {allCalls.length}
              </span>
              <button
                type="button"
                className="font-semibold text-primary hover:underline"
                onClick={() => {
                  setFilters(EMPTY_FILTERS);
                  setPage(0);
                }}
              >
                Limpiar filtros
              </button>
            </div>
          )}
        </section>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Kpi
            label="Leads en la selección"
            value={universe.length}
            hint={`${pendingInUniverse} pendientes de llamar`}
          />
          <Kpi
            label="Llamadas realizadas"
            value={total.calls}
            hint={`${fmtPct(universe.length ? total.calls / universe.length : 0)} de los leads de la selección`}
          />
          <Kpi
            label="Tasa de contacto"
            value={fmtPct(total.contactRate)}
            hint={`${total.effective} llamadas efectivas`}
          />
          <Kpi
            label="Interés al contactar"
            value={fmtPct(total.interestRate)}
            hint={`${total.interested} interesados de ${total.effective}`}
          />
          <Kpi
            label="Efectividad total"
            value={fmtPct(total.yieldRate)}
            hint="Interesados ÷ llamadas"
          />
          <Kpi
            label="Nadie los había llamado"
            value={total.neverContacted}
            hint={`${fmtPct(effectiveCount ? total.neverContacted / effectiveCount : 0)} de los contactados`}
          />
        </div>

        {/* Recomendaciones */}
        <section>
          <h2 className="mb-3 font-semibold">Recomendaciones</h2>
          {recs.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {recs.map((r) => (
                <div key={r.title} className={`card border-l-4 p-4 ${TONE[r.tone].cls}`}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    <span aria-hidden>{TONE[r.tone].icon}</span> {TONE[r.tone].label}
                  </p>
                  <p className="mt-1 font-medium">{r.title}</p>
                  <p className="mt-1 text-sm text-muted">{r.detail}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="card">
              <Empty>No hay suficientes datos en esta selección para recomendar.</Empty>
            </div>
          )}
        </section>

        {/* Asesores */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Resultado por asesor" subtitle="Llamadas según su resultado" action={<Legend items={OUTCOME_LEGEND} />}>
            <StackedBars
              rows={agents.map((a) => ({
                label: a.agent,
                segments: outcomeSegments(a),
                suffix: `${a.calls} · ${fmtPct(a.contactRate)}`,
              }))}
            />
          </ChartCard>

          <ChartCard title="Productividad por asesor">
            {agents.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
                      <th className="py-2 pr-3">Asesor</th>
                      <th className="px-2 text-right">Llamadas</th>
                      <th className="px-2 text-right">Días</th>
                      <th className="px-2 text-right" title="Llamadas por hora, entre la primera y la última llamada del día">
                        Llam./hora
                      </th>
                      <th className="px-2 text-right">Contacto</th>
                      <th className="px-2 text-right">Interés</th>
                      <th className="pl-2 text-right">Interesados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((a) => (
                      <tr key={a.agent} className="border-b border-border last:border-0">
                        <td className="py-2 pr-3 font-medium">{a.agent}</td>
                        <td className="px-2 text-right tabular-nums">{a.calls}</td>
                        <td className="px-2 text-right tabular-nums">{a.days || "–"}</td>
                        <td className="px-2 text-right tabular-nums">
                          {a.callsPerHour ? a.callsPerHour.toFixed(1) : "–"}
                        </td>
                        <td className="px-2 text-right tabular-nums">{fmtPct(a.contactRate)}</td>
                        <td className="px-2 text-right tabular-nums">{fmtPct(a.interestRate)}</td>
                        <td className="pl-2 text-right font-semibold tabular-nums">{a.interested}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-muted">
                  Contacto = efectivas ÷ llamadas. Interés = interesados ÷ efectivas. Llam./hora solo
                  cuenta días con fecha y 3+ llamadas con hora.
                </p>
              </div>
            ) : (
              <Empty />
            )}
          </ChartCard>
        </div>

        {/* Tiempo */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Llamadas por día"
            subtitle={undatedCount && filters.includeUndated ? `No incluye ${calls.filter((c) => !c.callDate).length} llamadas sin fecha` : undefined}
            action={<Legend items={OUTCOME_LEGEND} />}
          >
            <Columns
              columns={daily.map((d) => ({
                label: fmtDay(d.day),
                segments: outcomeSegments(d),
                tooltip: rateTooltip(fmtDay(d.day, true), d),
              }))}
            />
          </ChartCard>

          <ChartCard title="Tasa de contacto por hora" subtitle="% de llamadas efectivas según la hora; n = llamadas">
            <Columns
              max={1}
              columns={hourly.map((h) => ({
                label: `${h.hour}:00 · n=${h.calls}`,
                top: fmtPct(h.contactRate),
                segments: [{ key: "rate", label: "Contacto", value: h.contactRate, color: SERIES.efectiva }],
                tooltip: rateTooltip(`${h.hour}:00 – ${h.hour}:59`, h),
              }))}
            />
          </ChartCard>
        </div>

        {/* Interés */}
        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard title="Nivel de interés" subtitle="Sobre llamadas efectivas · clic para filtrar">
            <BarList rows={interestRows} />
          </ChartCard>
          <ChartCard title="¿Ya lo había llamado un asesor?" subtitle="Llamadas efectivas · clic para filtrar">
            <BarList rows={priorRows} />
          </ChartCard>
          <ChartCard title="Contacto según antigüedad del lead" subtitle="Días entre que entró el lead y la llamada">
            <BarList
              max={1}
              rows={ages
                .filter((a) => a.calls > 0)
                .map((a) => ({
                  label: a.label,
                  value: a.contactRate,
                  display: `${fmtPct(a.contactRate)} · n=${a.calls}`,
                  tooltip: rateTooltip(a.label, a),
                }))}
            />
          </ChartCard>
        </div>

        {/* Carreras y temas */}
        <div className="grid gap-4 lg:grid-cols-3">
          <ChartCard title="Por carrera" subtitle="Cobertura, contacto e interés" className="lg:col-span-2">
            {programs.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
                      <th className="py-2 pr-3">Carrera</th>
                      <th className="px-2 text-right">Leads</th>
                      <th className="px-2">Cobertura</th>
                      <th className="px-2 text-right">Llamadas</th>
                      <th className="px-2 text-right">Contacto</th>
                      <th className="px-2 text-right">Interesados</th>
                      <th className="pl-2 text-right">Efectividad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {programs.map((p) => (
                      <tr
                        key={p.program}
                        className="cursor-pointer border-b border-border last:border-0 hover:bg-background"
                        onClick={() => set("programs", filters.programs.includes(p.program) ? [] : [p.program])}
                        title="Clic para filtrar por esta carrera"
                      >
                        <td className="py-2 pr-3">
                          <span className="font-medium">{p.program}</span>
                          <span className="block text-xs text-muted">
                            {p.faculty} · {p.level}
                          </span>
                        </td>
                        <td className="px-2 text-right tabular-nums">{p.leads}</td>
                        <td className="px-2">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-20 overflow-hidden rounded-full bg-border">
                              <div className="h-full rounded-full" style={{ width: fmtPct(p.coverage), background: SERIES.efectiva }} />
                            </div>
                            <span className="text-xs tabular-nums text-muted">{fmtPct(p.coverage)}</span>
                          </div>
                        </td>
                        <td className="px-2 text-right tabular-nums">{p.calls}</td>
                        <td className="px-2 text-right tabular-nums">{p.calls ? fmtPct(p.contactRate) : "–"}</td>
                        <td className="px-2 text-right font-semibold tabular-nums">{p.interested}</td>
                        <td className="pl-2 text-right tabular-nums">{p.calls ? fmtPct(p.yieldRate) : "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty />
            )}
          </ChartCard>

          <ChartCard title="Temas en observaciones" subtitle="Detectados por palabras clave">
            <BarList
              rows={themes.map((t) => ({
                label: t.label,
                value: t.count,
                tooltip: () => (
                  <div className="space-y-1">
                    <p className="font-semibold">{t.label}</p>
                    {t.records.slice(0, 3).map((r) => (
                      <p key={r.id} className="text-muted">“{r.notes}”</p>
                    ))}
                  </div>
                ),
              }))}
            />
          </ChartCard>
        </div>

        {/* Seguimiento */}
        <ChartCard
          title="Seguimiento prioritario"
          subtitle="Interesados y quienes piden información; primero los que nadie había llamado"
        >
          {follow.length ? (
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
                    <th className="py-2 pr-3">Prioridad</th>
                    <th className="px-2">Lead</th>
                    <th className="px-2">Carrera</th>
                    <th className="px-2">Asesor / día</th>
                    <th className="pl-2">Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {follow.map(({ record: r, score }) => {
                    const wa = waLink(r.phone);
                    return (
                      <tr key={r.id} className="border-b border-border align-top last:border-0">
                        <td className="py-2 pr-3">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                              score >= 4 ? "bg-red-bg text-red" : score >= 2 ? "bg-primary/10 text-primary" : "bg-background text-muted"
                            }`}
                          >
                            {score >= 4 ? "Alta" : score >= 2 ? "Media" : "Normal"}
                          </span>
                          <span className="mt-1 block text-xs text-muted">
                            {r.priorContact ? PRIOR_LABEL[r.priorContact] : "Sin dato previo"}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <span className="font-medium">{r.name || "(Sin nombre)"}</span>
                          <span className="block text-xs">
                            <a className="text-primary hover:underline" href={`tel:${r.phone}`}>
                              {r.phone}
                            </a>
                            {wa && (
                              <>
                                {" · "}
                                <a className="text-primary hover:underline" href={wa} target="_blank" rel="noreferrer">
                                  WhatsApp
                                </a>
                              </>
                            )}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          {r.program}
                          <span className="block text-xs text-muted">
                            {r.interests.map((i) => INTEREST_LABEL[i]).join(", ")}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-xs">
                          {r.agent ?? "–"}
                          <span className="block text-muted">{fmtDay(r.callDate, true)}</span>
                        </td>
                        <td className="py-2 pl-2 text-xs text-muted">{r.notes || "–"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty />
          )}
        </ChartCard>

        {/* Detalle */}
        <ChartCard title="Detalle de llamadas" subtitle={`${detail.length} llamadas en la selección`}>
          {detail.length ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
                      <th className="py-2 pr-3">Día</th>
                      <th className="px-2">Hora</th>
                      <th className="px-2">Asesor</th>
                      <th className="px-2">Lead</th>
                      <th className="px-2">Carrera</th>
                      <th className="px-2">Resultado</th>
                      <th className="px-2">Interés</th>
                      <th className="pl-2">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.slice(page * PAGE, (page + 1) * PAGE).map((r) => (
                      <tr key={r.id} className="border-b border-border align-top last:border-0">
                        <td className="whitespace-nowrap py-2 pr-3 tabular-nums">{fmtDay(r.callDate, true)}</td>
                        <td className="px-2 py-2 tabular-nums">{r.callTime ?? "–"}</td>
                        <td className="px-2 py-2">{r.agent ?? "–"}</td>
                        <td className="px-2 py-2">
                          {r.name}
                          <span className="block text-xs text-muted">{r.phone}</span>
                        </td>
                        <td className="px-2 py-2">{r.program}</td>
                        <td className="px-2 py-2">
                          <span className="flex items-center gap-1.5 whitespace-nowrap">
                            <span
                              className="inline-block h-2 w-2 rounded-full"
                              style={{ background: SERIES[r.outcome as keyof typeof SERIES] ?? SERIES.otro }}
                            />
                            {r.outcome === "otro" ? r.outcomeRaw : OUTCOME_LABEL[r.outcome]}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-xs">
                          {r.interests.map((i) => INTEREST_LABEL[i]).join(", ") || "–"}
                        </td>
                        <td className="py-2 pl-2 text-xs text-muted">{r.notes || "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {detail.length > PAGE && (
                <div className="mt-3 flex items-center justify-end gap-2 text-sm">
                  <button type="button" className="btn btn-secondary !px-3 !py-1" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                    ←
                  </button>
                  <span className="tabular-nums text-muted">
                    {page + 1} / {Math.ceil(detail.length / PAGE)}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary !px-3 !py-1"
                    disabled={(page + 1) * PAGE >= detail.length}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    →
                  </button>
                </div>
              )}
            </>
          ) : (
            <Empty />
          )}
        </ChartCard>

        {warnings.length > 0 && (
          <details className="card p-4 text-sm">
            <summary className="cursor-pointer font-medium">
              {warnings.length} advertencias de calidad de datos
            </summary>
            <ul className="mt-2 list-disc pl-5 text-muted">
              {warnings.slice(0, 50).map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </TooltipLayer>
  );
}
