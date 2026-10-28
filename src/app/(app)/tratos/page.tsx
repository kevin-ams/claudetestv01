import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { acConfig } from "@/lib/activecampaign/client";
import { buildDashboard, guessFieldMap, resolveDeals, UNKNOWN, type DashboardFilters } from "@/lib/activecampaign/analytics";
import { DEMO_FIELD_MAP, DEMO_META, demoDeals } from "@/lib/activecampaign/demo";
import { getSyncProgress } from "@/lib/activecampaign/sync";
import type { DealStatus, FieldKey } from "@/lib/activecampaign/types";
import { FIELD_LABELS } from "@/lib/activecampaign/types";
import { DEFAULT_SETTINGS, getAcMeta, getDashboardSettings, getFieldMap, listDeals } from "@/lib/domain/deals";
import { BarList, CareerStageMatrix, DimensionTable, Section, StageTable, StatusLegend, Timeline } from "./charts";
import { DealsTable, type DealRow } from "./deals-table";
import { Filters } from "./filters";
import { fmtDays, fmtHours, fmtMoney, fmtNum, fmtPct, fmtDate, RANGE_OPTIONS } from "./format";
import { SyncPanel } from "./sync-panel";

const TIME_ZONE = process.env.DASHBOARD_TZ || "America/Mexico_City";

function first(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  return s ? s : null;
}

function todayIn(tz: string, offsetDays = 0, now = Date.now()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now + offsetDays * 86_400_000);
}

function resolveRange(range: string, from: string | null, to: string | null): { from: string | null; to: string | null } {
  const today = todayIn(TIME_ZONE);
  const [y, m] = today.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  switch (range) {
    case "7d":
      return { from: todayIn(TIME_ZONE, -6), to: today };
    case "90d":
      return { from: todayIn(TIME_ZONE, -89), to: today };
    case "mes":
      return { from: `${y}-${pad(m)}-01`, to: today };
    case "mes_ant": {
      const py = m === 1 ? y - 1 : y;
      const pm = m === 1 ? 12 : m - 1;
      const last = new Date(Date.UTC(y, m - 1, 0)).getUTCDate();
      return { from: `${py}-${pad(pm)}-01`, to: `${py}-${pad(pm)}-${pad(last)}` };
    }
    case "anio":
      return { from: `${y}-01-01`, to: today };
    case "todo":
      return { from: null, to: null };
    case "custom":
      return { from, to };
    default:
      return { from: todayIn(TIME_ZONE, -29), to: today };
  }
}

// Request time; kept outside the component body so render stays pure.
function requestTime() {
  return Date.now();
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "red" | "green" }) {
  return (
    <div className="card flex flex-col gap-1 p-4" title={hint}>
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      <span className={`text-2xl font-bold tabular-nums ${tone === "red" ? "text-red" : tone === "green" ? "text-green" : ""}`}>
        {value}
      </span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

export default async function TratosPage({ searchParams }: PageProps<"/tratos">) {
  const session = await getSession();
  if (!session) return null;

  const sp = await searchParams;
  const config = acConfig();
  const demo = !config;
  const now = requestTime();

  const selectedPipelines = (first(sp.p) ?? "").split(",").filter(Boolean);
  const range = first(sp.r) ?? "30d";
  const { from, to } = resolveRange(range, first(sp.from), first(sp.to));
  const ownerParam = first(sp.o);
  const status = first(sp.s);
  const filters: DashboardFilters = {
    pipelineIds: selectedPipelines,
    from,
    to,
    ownerId: ownerParam === null ? null : ownerParam === "none" ? "" : ownerParam,
    career: first(sp.c),
    status: status === "open" || status === "won" || status === "lost" ? (status as DealStatus) : null,
  };

  const [meta, storedMap, settings, progress, rawDeals] = demo
    ? [DEMO_META, DEMO_FIELD_MAP, DEFAULT_SETTINGS, null, demoDeals(now)]
    : await Promise.all([
        getAcMeta(),
        getFieldMap(),
        getDashboardSettings(),
        getSyncProgress(),
        listDeals(selectedPipelines),
      ]);
  const fieldMap = storedMap ?? guessFieldMap(meta);
  const resolved = resolveDeals(rawDeals, meta, fieldMap, settings.staleDays, now, TIME_ZONE);
  const d = buildDashboard(resolved, meta, filters, now);
  const k = d.kpis;
  const unmapped = (Object.keys(fieldMap) as FieldKey[]).filter((key) => !fieldMap[key]);

  const tableRows: DealRow[] = d.deals.map((deal) => ({
    id: deal.id,
    title: deal.title,
    contact: [deal.contactName, deal.contactEmail].filter(Boolean).join(" · "),
    url: config ? `${config.appUrl}/app/deals/${deal.id}` : null,
    career: deal.dims.career,
    pipeline: deal.pipelineName,
    stage: deal.stageName,
    owner: deal.ownerName,
    status: deal.status,
    createdAt: deal.createdAt,
    daysInStage: deal.daysInStage,
    stale: deal.stale,
    notesCount: deal.notesCount,
    enriched: deal.enriched,
    hoursToFirstNote: deal.hoursToFirstNote,
    firstNote: deal.firstNote?.text ?? null,
    firstNoteAt: deal.firstNote?.at ?? null,
    lastNote: deal.lastNote?.text ?? null,
    lastNoteAt: deal.lastNote?.at ?? null,
    utmSource: deal.dims.utm_source,
    utmMedium: deal.dims.utm_medium,
    utmTerm: deal.dims.utm_term,
    utmCampaign: deal.dims.utm_campaign,
    classification: deal.dims.lead_classification,
  }));

  const rangeLabel =
    range === "custom"
      ? `${from ?? "…"} a ${to ?? "…"}`
      : (RANGE_OPTIONS.find((o) => o.value === range)?.label ?? "Últimos 30 días");

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tratos · ActiveCampaign</h1>
          <p className="text-sm text-muted">
            Cuántos tratos generamos por carrera y cómo se están gestionando. {rangeLabel}, por fecha de creación.
          </p>
        </div>
        <div className="flex items-start gap-2">
          {!demo && session.role === "admin" && (
            <Link href="/tratos/config" className="btn btn-secondary">
              Configurar campos
            </Link>
          )}
          {progress && <SyncPanel initial={progress} />}
        </div>
      </div>

      {demo && (
        <div className="card mb-6 border-accent p-4 text-sm">
          <b>Modo demostración.</b> Estás viendo datos de ejemplo. Para conectar tu cuenta, agrega las variables
          de entorno <code>AC_API_URL</code> (p. ej. <code>https://tucuenta.api-us1.com</code>) y{" "}
          <code>AC_API_KEY</code> (ActiveCampaign → Configuración → Desarrollador) en Netlify y vuelve a desplegar.
        </div>
      )}
      {!demo && progress && progress.totalDeals === 0 && (
        <div className="card mb-6 p-4 text-sm">
          Todavía no hay tratos sincronizados. Pulsa <b>Sincronizar</b> para descargar los tratos de ActiveCampaign.
          La primera vez puede tardar varios minutos porque se leen las notas y la actividad de cada trato.
        </div>
      )}
      {!demo && unmapped.length > 0 && meta.fetchedAt && (
        <div className="card mb-6 p-4 text-sm">
          No se encontró un campo de ActiveCampaign para:{" "}
          <b>{unmapped.map((key) => FIELD_LABELS[key]).join(", ")}</b>.{" "}
          {session.role === "admin" && (
            <Link href="/tratos/config" className="text-primary underline">
              Asígnalos aquí
            </Link>
          )}
        </div>
      )}

      <Filters
        pipelines={meta.pipelines}
        selectedPipelines={selectedPipelines}
        owners={d.options.owners}
        careers={d.options.careers}
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Kpi label="Tratos creados" value={fmtNum(k.total)} />
        <Kpi label="Abiertos" value={fmtNum(k.open)} hint={fmtMoney(k.openValue)} />
        <Kpi label="Ganados" value={fmtNum(k.won)} tone="green" hint={fmtMoney(k.wonValue)} />
        <Kpi label="Perdidos" value={fmtNum(k.lost)} />
        <Kpi label="Conversión" value={fmtPct(k.winRate)} hint="ganados / cerrados" />
        <Kpi
          label="Resp. a 1.ª nota"
          value={fmtHours(k.medianHoursToFirstNote)}
          hint="mediana desde la creación"
        />
        <Kpi label="Días en etapa" value={fmtDays(k.avgDaysInStage)} hint="promedio, abiertos" />
        <Kpi
          label="Estancados"
          value={fmtNum(k.stale)}
          tone={k.stale ? "red" : undefined}
          hint={`≥ ${settings.staleDays} d sin avanzar · ${fmtNum(k.noNote)} sin notas`}
        />
      </div>

      {k.enrichedShare < 1 && (
        <p className="mb-4 text-xs text-muted">
          {fmtPct(1 - k.enrichedShare)} de los tratos aún no tienen notas/actividad/campos sincronizados; las
          métricas de notas, UTM y tiempo en etapa se completarán al terminar la sincronización.
        </p>
      )}

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Section title="Tratos creados" subtitle={`Por ${d.timelineUnit}`} className="lg:col-span-2">
          <Timeline data={d.timeline} unit={d.timelineUnit} />
        </Section>
        <Section title="Antigüedad en la etapa actual" subtitle="Tratos abiertos">
          <BarList rows={d.aging.map((a) => ({ label: a.label, value: a.count }))} />
        </Section>
      </div>

      <Section
        title="Tratos por carrera"
        subtitle="Volumen, avance y calidad de seguimiento por carrera"
        className="mb-6"
      >
        <StatusLegend />
        <DimensionTable rows={d.careers} dimensionLabel="Carrera" limit={20} />
      </Section>

      <Section
        title="Embudo: tratos abiertos por etapa"
        subtitle="Tiempo que llevan en la etapa desde que entraron"
        className="mb-6"
      >
        <StageTable stages={d.stages} staleDays={settings.staleDays} />
      </Section>

      <Section title="Carrera × etapa" subtitle="Tratos abiertos en cada etapa, por carrera" className="mb-6">
        <CareerStageMatrix matrix={d.careerStage} />
      </Section>

      <Section title="Gestión por asesor" subtitle="Carga, conversión e interacción (notas) de cada asesor" className="mb-6">
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="py-2 pr-3 font-medium">Asesor</th>
                <th className="py-2 pr-3 text-right font-medium">Tratos</th>
                <th className="py-2 pr-3 text-right font-medium">Abiertos</th>
                <th className="py-2 pr-3 text-right font-medium">Ganados</th>
                <th className="py-2 pr-3 text-right font-medium">Conversión</th>
                <th className="py-2 pr-3 text-right font-medium">Notas</th>
                <th className="py-2 pr-3 text-right font-medium">Notas / trato</th>
                <th className="py-2 pr-3 text-right font-medium">Resp. 1.ª nota</th>
                <th className="py-2 pr-3 text-right font-medium">Sin notas</th>
                <th className="py-2 pr-3 text-right font-medium">Días en etapa</th>
                <th className="py-2 pr-3 text-right font-medium">Estancados</th>
                <th className="py-2 text-right font-medium">Última actividad</th>
              </tr>
            </thead>
            <tbody>
              {d.owners.map((o) => (
                <tr key={o.ownerId ?? "none"} className="border-b border-border last:border-0">
                  <td className="py-2 pr-3 font-medium">{o.label}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmtNum(o.total)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmtNum(o.open)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmtNum(o.won)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmtPct(o.winRate)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmtNum(o.notes)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {o.avgNotesPerDeal === null ? "—" : o.avgNotesPerDeal.toFixed(1)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmtHours(o.avgHoursToFirstNote)}</td>
                  <td className={`py-2 pr-3 text-right tabular-nums ${o.noNote ? "text-red" : ""}`}>{fmtNum(o.noNote)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{fmtDays(o.avgDaysInStage)}</td>
                  <td className={`py-2 pr-3 text-right tabular-nums ${o.stale ? "text-red" : ""}`}>{fmtNum(o.stale)}</td>
                  <td className="whitespace-nowrap py-2 text-right">{fmtDate(o.lastActivityAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <div className="mb-6 grid gap-6 xl:grid-cols-2">
        <Section title="UTM Source" subtitle="De dónde llegan los tratos">
          <DimensionTable rows={d.dimensions.utm_source} dimensionLabel="Source" />
        </Section>
        <Section title="UTM Medium">
          <DimensionTable rows={d.dimensions.utm_medium} dimensionLabel="Medium" />
        </Section>
        <Section title="UTM Campaign">
          <DimensionTable rows={d.dimensions.utm_campaign} dimensionLabel="Campaign" />
        </Section>
        <Section title="UTM Term" subtitle="Palabras clave (búsqueda pagada)">
          <DimensionTable
            rows={d.dimensions.utm_term.filter((r) => r.label !== UNKNOWN)}
            dimensionLabel="Term"
          />
        </Section>
      </div>

      <Section title="Clasificación del lead (chat)" className="mb-6">
        <DimensionTable rows={d.dimensions.lead_classification} dimensionLabel="Clasificación" />
      </Section>

      <Section title="Detalle de tratos" subtitle="Primera y última nota, tiempo en etapa y origen de cada trato">
        <DealsTable rows={tableRows} staleDays={settings.staleDays} />
      </Section>
    </div>
  );
}
