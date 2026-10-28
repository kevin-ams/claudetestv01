"use client";

import { Button, Card } from "@heroui/react";
import { Xmark } from "@gravity-ui/icons";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AppSelect } from "@/components/ui/select";
import { Segmented } from "@/components/ui/segmented";
import {
  AGING,
  DIMENSIONS,
  DIM_LABELS,
  RANGE_OPTIONS,
  STATUS_LABEL,
  applyFilters,
  autoUnit,
  fmtDate,
  fmtDays,
  fmtHours,
  fmtNum,
  fmtPct,
  funnel,
  groupRows,
  prepareDeals,
  rangeLabel,
  summarize,
  timeline,
  type DashDeal,
  type DashPipeline,
  type DashStage,
  type DimKey,
  type DimRow,
  type Filters,
  type TimelineUnit,
} from "@/lib/domain/deals-shared";
import { DealsTable } from "./deals-table";
import { ExportPdf, type PrintSection } from "./export-pdf";
import { BarList, COL, DimTable, FunnelChart, Kpi, MultiFilter, SERIES, Section, StackLegend, TimelineChart, type Column } from "./parts";

const ROOT_ID = "dashboard-ac";
const UNITS = [
  { id: "día", label: "Día" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mes" },
] as const satisfies readonly { id: TimelineUnit; label: string }[];

function parseFilters(raw: string | null): Filters {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(obj).filter(([k, v]) => (DIMENSIONS as readonly string[]).includes(k) && Array.isArray(v) && v.length)
    ) as Filters;
  } catch {
    return {};
  }
}

export function DealsDashboard({
  deals: rawDeals,
  pipelines,
  stages: rawStages,
  conversionKeys,
  staleDays,
  from,
  to,
  range,
  dealUrl,
  timeZone,
}: {
  deals: DashDeal[];
  pipelines: DashPipeline[];
  stages: DashStage[];
  conversionKeys: string[];
  staleDays: number;
  from: string;
  to: string;
  range: string;
  dealUrl: string | null;
  timeZone: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [loading, startTransition] = useTransition();
  const [filters, setFiltersState] = useState<Filters>(() => parseFilters(params.get("f")));
  const [unit, setUnit] = useState<TimelineUnit>(() => autoUnit(from, to));
  const [printing, setPrinting] = useState(false);

  // Los filtros se guardan en la dirección (para compartir el enlace) sin volver a pedir datos.
  function setFilters(next: Filters) {
    const clean = Object.fromEntries(Object.entries(next).filter(([, v]) => v?.length)) as Filters;
    setFiltersState(clean);
    const sp = new URLSearchParams(window.location.search);
    if (Object.keys(clean).length) sp.set("f", JSON.stringify(clean));
    else sp.delete("f");
    window.history.replaceState(null, "", `${pathname}${sp.size ? `?${sp}` : ""}`);
  }
  const toggle = (key: DimKey) => (value: string) => {
    const cur = filters[key] ?? [];
    setFilters({ ...filters, [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] });
  };
  const setDim = (key: DimKey) => (values: string[]) => setFilters({ ...filters, [key]: values });

  // El periodo sí vuelve a pedir datos al servidor; las fechas elegidas en la gráfica se quitan.
  function setRange(changes: Record<string, string | null>) {
    const sp = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(changes)) {
      if (v) sp.set(k, v);
      else sp.delete(k);
    }
    const rest = { ...filters, created: [] };
    const clean = Object.fromEntries(Object.entries(rest).filter(([, v]) => v?.length));
    if (Object.keys(clean).length) sp.set("f", JSON.stringify(clean));
    else sp.delete("f");
    setFiltersState(clean);
    startTransition(() => router.push(`${pathname}?${sp}`, { scroll: false }));
  }

  const { deals, stages } = useMemo(
    () => prepareDeals(rawDeals, { pipelines, stages: rawStages }, conversionKeys, staleDays),
    [rawDeals, pipelines, rawStages, conversionKeys, staleDays]
  );
  const stageName = useMemo(() => new Map(stages.map((s) => [s.key, s.name])), [stages]);

  const view = useMemo(() => {
    const filtered = applyFilters(deals, filters);
    const rowsFor = (key: DimKey) => groupRows(applyFilters(deals, filters, key), key);
    const compareKey: DimKey | null =
      (filters.career?.length ?? 0) >= 2 ? "career" : (filters.faculty?.length ?? 0) >= 2 ? "faculty" : null;
    const compareValues = compareKey ? (filters[compareKey] ?? []).slice(0, SERIES.length) : [];
    const agingDeals = applyFilters(deals, filters, "aging").filter((d) => d.status === "open");
    return {
      filtered,
      summary: summarize(filtered),
      faculty: rowsFor("faculty"),
      career: rowsFor("career"),
      owner: rowsFor("owner"),
      pipeline: rowsFor("pipeline"),
      utm_source: rowsFor("utm_source"),
      utm_medium: rowsFor("utm_medium"),
      utm_term: rowsFor("utm_term"),
      utm_campaign: rowsFor("utm_campaign"),
      classification: rowsFor("classification"),
      funnel: funnel(applyFilters(deals, filters, "stage"), stages),
      aging: AGING.map((b, i) => ({
        key: b.label,
        label: b.label,
        value: agingDeals.filter((d) => d.daysInStage <= b.max && (i === 0 || d.daysInStage > AGING[i - 1].max)).length,
      })),
      compareKey,
      compareValues,
      compareRows: compareKey ? groupRows(filtered, compareKey).filter((r) => compareValues.includes(r.value_key)) : [],
      // La gráfica no se filtra por sus propias fechas: las elegidas se resaltan.
      timeline: timeline(applyFilters(deals, filters, "created"), from, to, unit, compareKey, compareValues),
    };
  }, [deals, filters, stages, from, to, unit]);

  // Opciones de los filtros (con todos los tratos del periodo).
  const options = useMemo(() => {
    const count = (key: DimKey) => groupRows(deals, key);
    const careerFaculty = new Map(deals.map((d) => [d.career, d.faculty]));
    return {
      faculty: count("faculty").map((r) => ({ value: r.value_key, label: r.label, count: r.total })),
      career: count("career")
        .map((r) => ({ value: r.value_key, label: r.label, count: r.total, group: careerFaculty.get(r.value_key) }))
        .sort((a, b) => (a.group ?? "").localeCompare(b.group ?? "", "es") || a.label.localeCompare(b.label, "es")),
      pipeline: count("pipeline").map((r) => ({ value: r.value_key, label: r.label, count: r.total })),
      owner: count("owner").map((r) => ({ value: r.value_key, label: r.label, count: r.total })),
      status: (["open", "won", "lost"] as const).map((s) => ({ value: s, label: STATUS_LABEL[s] })),
    };
  }, [deals]);

  const s = view.summary;
  const active = (Object.entries(filters) as [DimKey, string[]][]).flatMap(([k, vs]) => vs.map((v) => ({ k, v })));
  const chipLabel = (k: DimKey, v: string) =>
    k === "stage"
      ? (stageName.get(v) ?? v)
      : k === "status"
        ? STATUS_LABEL[v as keyof typeof STATUS_LABEL]
        : k === "created"
          ? rangeLabel(v)
          : v;
  const careerFaculty = new Map(deals.map((d) => [d.career, d.faculty]));
  const rangeText = RANGE_OPTIONS.find((o) => o.value === range)?.label ?? "";

  const ownerColumns: Column[] = [
    COL.total,
    COL.open,
    COL.converted,
    COL.rate,
    { label: "Notas", render: (r: DimRow) => fmtNum(r.notes) },
    COL.notesPerDeal,
    COL.firstNote,
    COL.noNote,
    COL.daysInStage,
    COL.stale,
    { label: "Última actividad", render: (r: DimRow) => fmtDate(r.lastActivityAt, timeZone) },
  ];

  const printSections: PrintSection[] = [
    { id: "kpis", label: "Indicadores" },
    ...(view.compareKey ? [{ id: "compare", label: "Comparación" }] : []),
    { id: "timeline", label: "Tratos creados" },
    { id: "funnel", label: "Embudo y tiempo entre etapas" },
    { id: "aging", label: "Tiempo en la etapa actual" },
    { id: "faculty", label: "Por facultad" },
    { id: "career", label: "Por carrera" },
    { id: "owner", label: "Gestión por asesor" },
    { id: "utm", label: "UTM (source, medium, campaign, term)" },
    { id: "classification", label: "Clasificación del lead" },
    { id: "pipeline", label: "Por embudo" },
    { id: "detail", label: "Detalle de tratos (hasta 300)", defaultOn: false },
  ];

  return (
    <div
      id={ROOT_ID}
      className={`flex flex-col gap-4 transition-opacity ${loading ? "opacity-60" : ""}`}
      // Al imprimir, el tablero toma el ancho de una hoja A4 horizontal para que las gráficas quepan.
      style={printing ? { width: 1040 } : undefined}
    >
      {/* Encabezado que solo aparece en el PDF */}
      <div data-print-only className="hidden">
        <h1 className="text-xl font-bold">Dashboard AC</h1>
        <p className="text-sm text-muted">
          {rangeText} ({from} a {to}) ·{" "}
          {active.length ? active.map(({ k, v }) => `${DIM_LABELS[k]}: ${chipLabel(k, v)}`).join(" · ") : "Sin filtros"}
        </p>
      </div>

      {/* Filtros */}
      <Card className="flex flex-col gap-3 p-4" data-print-hide>
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            <label className="flex flex-col gap-1 text-xs text-muted">
              Fecha de creación
              <AppSelect value={range} onChange={(e) => setRange({ r: e.target.value, desde: null, hasta: null })} aria-label="Periodo">
                {RANGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </AppSelect>
            </label>
            {range === "custom" && (
              <div className="flex gap-2">
                <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
                  Desde
                  <input type="date" defaultValue={from} className="h-9 rounded-xl border border-border bg-card px-2 text-sm text-foreground" onChange={(e) => e.target.value && setRange({ r: "custom", desde: e.target.value })} />
                </label>
                <label className="flex flex-1 flex-col gap-1 text-xs text-muted">
                  Hasta
                  <input type="date" defaultValue={to} className="h-9 rounded-xl border border-border bg-card px-2 text-sm text-foreground" onChange={(e) => e.target.value && setRange({ r: "custom", hasta: e.target.value })} />
                </label>
              </div>
            )}
            <MultiFilter label="Facultad" options={options.faculty} value={filters.faculty ?? []} onChange={setDim("faculty")} />
            <MultiFilter label="Carrera" options={options.career} value={filters.career ?? []} onChange={setDim("career")} />
            <MultiFilter label="Embudo" options={options.pipeline} value={filters.pipeline ?? []} onChange={setDim("pipeline")} />
            <MultiFilter label="Asesor" options={options.owner} value={filters.owner ?? []} onChange={setDim("owner")} />
            <MultiFilter label="Estado" options={options.status} value={filters.status ?? []} onChange={setDim("status")} />
          </div>
          <ExportPdf rootId={ROOT_ID} sections={printSections} onPrintingChange={setPrinting} />
        </div>
        {active.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {active.map(({ k, v }) => (
              <button
                key={`${k}:${v}`}
                type="button"
                onClick={() => toggle(k)(v)}
                className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-foreground hover:bg-primary/20"
                aria-label={`Quitar filtro ${DIM_LABELS[k]}: ${chipLabel(k, v)}`}
              >
                <span className="text-muted">{DIM_LABELS[k]}:</span> {chipLabel(k, v)}
                <Xmark width={12} height={12} aria-hidden />
              </button>
            ))}
            <Button size="sm" variant="ghost" onPress={() => setFilters({})}>
              Limpiar filtros
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted">
            Haz clic en cualquier fila, barra o etapa para filtrar todo el tablero; clic de nuevo para quitarlo. Puedes elegir
            varias.
          </p>
        )}
      </Card>

      {/* Indicadores */}
      <div data-section="kpis" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
        <Kpi label="Tratos" value={fmtNum(s.total)} hint={`${fmtNum(s.open)} abiertos`} />
        <Kpi label="Convertidos" value={fmtNum(s.converted)} tone="green" hint="llegaron a inscripción" />
        <Kpi label="Conversión" value={fmtPct(s.conversionRate)} hint="convertidos / tratos" />
        <Kpi label="Ganados · Perdidos" value={`${fmtNum(s.won)} · ${fmtNum(s.lost)}`} hint="estado del trato en AC" />
        <Kpi label="Días a conversión" value={fmtDays(s.medianDaysToConversion)} hint="mediana, desde la creación" />
        <Kpi label="Resp. 1.ª nota" value={fmtHours(s.medianHoursToFirstNote)} hint="mediana" />
        <Kpi label="Días en etapa" value={fmtDays(s.avgDaysInStage)} hint="promedio, abiertos" />
        <Kpi label="Estancados" value={fmtNum(s.stale)} tone={s.stale ? "red" : undefined} hint={`≥ ${staleDays} días sin avanzar`} />
        <Kpi label="Sin notas" value={fmtNum(s.noNote)} tone={s.noNote ? "red" : undefined} hint="ninguna nota registrada" />
      </div>

      {/* Comparación */}
      {view.compareKey && (
        <Section
          id="compare"
          title={`Comparación de ${view.compareKey === "career" ? "carreras" : "facultades"}`}
          subtitle="Elegiste más de una: cada una con su color en la gráfica de tratos creados."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {view.compareValues.map((v, i) => {
              const r = view.compareRows.find((x) => x.value_key === v);
              return (
                <div key={v} className="rounded-xl border border-border p-3">
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: SERIES[i] }} />
                    <span className="truncate" title={v}>
                      {v}
                    </span>
                  </p>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <dt className="text-muted">Tratos</dt>
                    <dd className="text-right font-semibold tabular-nums">{fmtNum(r?.total ?? 0)}</dd>
                    <dt className="text-muted">Convertidos</dt>
                    <dd className="text-right tabular-nums">{fmtNum(r?.converted ?? 0)}</dd>
                    <dt className="text-muted">Conversión</dt>
                    <dd className="text-right tabular-nums">{fmtPct(r?.conversionRate ?? null)}</dd>
                    <dt className="text-muted">Días a conversión</dt>
                    <dd className="text-right tabular-nums">{fmtDays(r?.medianDaysToConversion ?? null)}</dd>
                    <dt className="text-muted">Resp. 1.ª nota</dt>
                    <dd className="text-right tabular-nums">{fmtHours(r?.medianHoursToFirstNote ?? null)}</dd>
                    <dt className="text-muted">Estancados</dt>
                    <dd className="text-right tabular-nums">{fmtNum(r?.stale ?? 0)}</dd>
                  </dl>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <Section
        id="timeline"
        title="Tratos creados"
        subtitle={`Por ${unit}. Clic en una barra para filtrar ${unit === "semana" ? "esa semana" : `ese ${unit}`}; puedes elegir varias.`}
        action={
          <span data-print-hide>
            <Segmented
              aria-label="Agrupar por"
              options={UNITS}
              value={unit}
              onChange={(u) => {
                setUnit(u);
                // Las fechas elegidas eran de la otra agrupación.
                if (filters.created?.length) setFilters({ ...filters, created: [] });
              }}
            />
          </span>
        }
      >
        <TimelineChart points={view.timeline} series={view.compareValues} selected={filters.created ?? []} onToggle={toggle("created")} />
      </Section>

      <div className="grid gap-4 lg:grid-cols-5">
        <Section
          id="funnel"
          className="lg:col-span-3"
          title="Embudo"
          subtitle="Tratos que llegaron a cada etapa y cuánto tardan en avanzar. En verde, conversión."
        >
          <FunnelChart steps={view.funnel} selected={filters.stage ?? []} onToggle={toggle("stage")} />
        </Section>
        <Section id="aging" className="lg:col-span-2" title="Tiempo en la etapa actual" subtitle="Tratos abiertos, desde que entraron a su etapa">
          <BarList rows={view.aging} selected={filters.aging ?? []} onToggle={toggle("aging")} />
          <div className="mt-4 overflow-x-auto">
            <table className="w-full whitespace-nowrap text-xs">
              <thead>
                <tr className="border-b border-border text-left text-muted">
                  <th className="py-1.5 pr-2 font-medium">Etapa</th>
                  <th className="py-1.5 pr-2 text-right font-medium" title="Mediana de los días que pasaron en la etapa los tratos que ya avanzaron">
                    Tardan en avanzar
                  </th>
                  <th className="py-1.5 pr-2 text-right font-medium">Ahora</th>
                  <th className="py-1.5 pr-2 text-right font-medium" title="Días que llevan en la etapa los tratos abiertos que están ahí ahora">
                    Llevan (mediana)
                  </th>
                  <th className="py-1.5 text-right font-medium">Estancados</th>
                </tr>
              </thead>
              <tbody>
                {view.funnel.map((st) => (
                  <tr key={st.key} className="border-b border-border last:border-0">
                    <td className="max-w-40 truncate py-1.5 pr-2" title={st.name}>
                      {st.name}
                    </td>
                    <td className="py-1.5 pr-2 text-right font-semibold tabular-nums">{fmtDays(st.stayMedian)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{fmtNum(st.current)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{fmtDays(st.medianDays)}</td>
                    <td className={`py-1.5 text-right tabular-nums ${st.stale ? "font-semibold text-red" : ""}`}>{fmtNum(st.stale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <Section id="faculty" className="xl:col-span-2" title="Por facultad" subtitle="Clic para filtrar; elige varias para compararlas">
          <StackLegend />
          <DimTable rows={view.faculty} label="Facultad" selected={filters.faculty ?? []} onToggle={toggle("faculty")} columns={[COL.total, COL.rate, COL.stale]} />
        </Section>
        <Section id="career" className="xl:col-span-3" title="Por carrera" subtitle="Clic para filtrar; elige varias para compararlas">
          <StackLegend />
          <DimTable
            rows={view.career}
            label="Carrera"
            selected={filters.career ?? []}
            onToggle={toggle("career")}
            columns={[COL.total, COL.converted, COL.rate, COL.firstNote, COL.stale]}
            limit={printing ? 1000 : 20}
            extra={(r) => <span className="ml-2 text-xs font-normal text-muted">{careerFaculty.get(r.value_key)}</span>}
          />
        </Section>
      </div>

      <Section id="owner" title="Gestión por asesor" subtitle="Carga de trabajo, conversión e interacción (notas) de cada asesor">
        <DimTable rows={view.owner} label="Asesor" selected={filters.owner ?? []} onToggle={toggle("owner")} columns={ownerColumns} limit={printing ? 1000 : 30} />
      </Section>

      <div data-section="utm" className="grid gap-4 xl:grid-cols-2">
        {(
          [
            ["utm_source", "UTM Source", "De dónde llegan los tratos"],
            ["utm_medium", "UTM Medium", undefined],
            ["utm_campaign", "UTM Campaign", undefined],
            ["utm_term", "UTM Term", "Palabras clave"],
          ] as const
        ).map(([key, title, subtitle]) => (
          <Section key={key} title={title} subtitle={subtitle}>
            <DimTable rows={view[key]} label={title.replace("UTM ", "")} selected={filters[key] ?? []} onToggle={toggle(key)} columns={[COL.total, COL.converted, COL.rate, COL.firstNote]} limit={10} />
          </Section>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section id="classification" title="Clasificación del lead (chat)">
          <DimTable rows={view.classification} label="Clasificación" selected={filters.classification ?? []} onToggle={toggle("classification")} columns={[COL.total, COL.converted, COL.rate, COL.firstNote]} />
        </Section>
        <Section id="pipeline" title="Por embudo">
          <DimTable rows={view.pipeline} label="Embudo" selected={filters.pipeline ?? []} onToggle={toggle("pipeline")} columns={[COL.total, COL.converted, COL.rate, COL.stale]} limit={10} />
        </Section>
      </div>

      <Section id="detail" title="Detalle de tratos" subtitle="Primera y última nota, tiempo en la etapa y origen de cada trato">
        <DealsTable deals={view.filtered} staleDays={staleDays} dealUrl={dealUrl} timeZone={timeZone} printing={printing} />
      </Section>
    </div>
  );
}
