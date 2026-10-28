// Dashboard de tratos: tipos y cálculos sin acceso a datos (se usan en el servidor y en el navegador).

export type DealStatus = "open" | "won" | "lost";

export type AcField = { id: string; label: string; key: string };
export type DashPipeline = { id: string; title: string };
export type DashStage = { id: string; title: string; key: string; pipelineId: string; order: number };

export type DashMeta = {
  pipelines: DashPipeline[];
  stages: DashStage[];
  users: { id: string; name: string }[];
  dealFields: AcField[];
  contactFields: AcField[];
  careerFieldId: string | null;
  fetchedAt: string | null;
};

export type DealNote = { text: string; at: string; userId: string | null };

/** Trato tal como se guarda en ac_deals.data. */
export type DealRecord = {
  id: string;
  title: string;
  value: number;
  status: DealStatus;
  pipelineId: string;
  stageId: string;
  ownerId: string | null;
  contactId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  createdAt: string;
  updatedAt: string | null;
  careerValue: string; // "Nombre de la Carrera" del trato
  dealFields: Record<string, string>;
  // Lo siguiente sale de leer el detalle de cada trato.
  stageEnteredAt: string | null;
  closedAt: string | null;
  lastActivityAt: string | null;
  notesCount: number;
  firstNote: DealNote | null;
  lastNote: DealNote | null;
  contactFields: Record<string, string>;
  enriched: boolean;
};

export const FIELD_KEYS = ["faculty", "utm_source", "utm_medium", "utm_term", "utm_campaign", "lead_classification"] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];
export const FIELD_LABELS: Record<FieldKey, string> = {
  faculty: "Facultad (si existe el campo en ActiveCampaign)",
  utm_source: "UTM Source",
  utm_medium: "UTM Medium",
  utm_term: "UTM Term",
  utm_campaign: "UTM Campaign",
  lead_classification: "Clasificación del lead (chat)",
};
export type FieldRef = { source: "deal" | "contact"; id: string } | null;
export type FieldMap = Record<FieldKey, FieldRef>;

export type DashSettings = {
  /** Días en la misma etapa para considerar un trato estancado. */
  staleDays: number;
  /** Etapas (por nombre normalizado) que cuentan como conversión. null = las que dicen "inscri". */
  conversionStageKeys: string[] | null;
  /** null = elegir los campos automáticamente por nombre. */
  fieldMap: FieldMap | null;
  /** Facultad asignada a mano a valores de "Nombre de la Carrera" sin carrera vinculada. */
  facultyByCareer: Record<string, string>;
  /** Primera sincronización: tratos creados en los últimos N meses. */
  historyMonths: number;
};

export const DEFAULT_SETTINGS: DashSettings = {
  staleDays: 7,
  conversionStageKeys: null,
  fieldMap: null,
  facultyByCareer: {},
  historyMonths: 6,
};

export type SyncPhase = "idle" | "meta" | "deals" | "enrich" | "done";
export type SyncState = {
  phase: SyncPhase;
  runId: string | null;
  full: boolean;
  since: string | null;
  offset: number;
  startedAt: string | null;
  lastSyncedAt: string | null;
  error: string | null;
};
export type SyncProgress = {
  phase: SyncPhase;
  totalDeals: number;
  pendingEnrich: number;
  lastSyncedAt: string | null;
  error: string | null;
};

export const UNKNOWN = "(sin dato)";
export const NO_CAREER = "(sin carrera)";
export const NO_FACULTY = "(sin facultad)";

/** Sin tildes, mayúsculas ni espacios de más: para comparar nombres de etapas y carreras. */
export function normKey(v: string): string {
  return v.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ");
}

export const isConversionStageDefault = (title: string) => /inscri/.test(normKey(title));

/** Trato ya resuelto (carrera, facultad, asesor…) que se manda al navegador. */
export type DashDeal = {
  id: string;
  title: string;
  contact: string;
  status: DealStatus;
  value: number;
  pipelineId: string;
  stageId: string;
  owner: string;
  career: string;
  faculty: string;
  linked: boolean; // la carrera coincide con una carrera de la app
  createdAt: string;
  createdDay: string; // AAAA-MM-DD en la zona horaria del equipo
  daysInStage: number;
  daysOpen: number;
  hoursToFirstNote: number | null;
  notesCount: number;
  enriched: boolean;
  firstNote: string | null;
  firstNoteAt: string | null;
  lastNote: string | null;
  lastNoteAt: string | null;
  lastActivityAt: string | null;
  utmSource: string;
  utmMedium: string;
  utmTerm: string;
  utmCampaign: string;
  classification: string;
};

// ---------------------------------------------------------------------------------------------
// Cálculos del dashboard

export const DIMENSIONS = [
  "faculty",
  "career",
  "pipeline",
  "stage",
  "owner",
  "status",
  "utm_source",
  "utm_medium",
  "utm_term",
  "utm_campaign",
  "classification",
  "aging",
] as const;
export type DimKey = (typeof DIMENSIONS)[number];
export type Filters = Partial<Record<DimKey, string[]>>;

export const DIM_LABELS: Record<DimKey, string> = {
  faculty: "Facultad",
  career: "Carrera",
  pipeline: "Embudo",
  stage: "Etapa",
  owner: "Asesor",
  status: "Estado",
  utm_source: "UTM Source",
  utm_medium: "UTM Medium",
  utm_term: "UTM Term",
  utm_campaign: "UTM Campaign",
  classification: "Clasificación",
  aging: "Tiempo en etapa",
};

export const STATUS_LABEL: Record<DealStatus, string> = { open: "Abierto", won: "Ganado", lost: "Perdido" };

export const AGING = [
  { label: "0–3 días", max: 3 },
  { label: "4–7 días", max: 7 },
  { label: "8–14 días", max: 14 },
  { label: "15–30 días", max: 30 },
  { label: "31–60 días", max: 60 },
  { label: "Más de 60 días", max: Infinity },
];

function agingLabel(days: number): string {
  return (AGING.find((b) => days <= b.max) ?? AGING[AGING.length - 1]).label;
}

/** Trato con los datos derivados que dependen de la configuración (etapa, conversión…). */
export type Deal = DashDeal & {
  stageKey: string;
  stageName: string;
  stageOrder: number;
  pipelineName: string;
  converted: boolean;
  stale: boolean;
  reached: string[]; // etapas (por nombre) por las que ya pasó, según el orden del embudo
};

export type StageInfo = { key: string; name: string; order: number; conversion: boolean };

export function prepareDeals(
  deals: DashDeal[],
  meta: Pick<DashMeta, "pipelines" | "stages">,
  conversionKeys: string[],
  staleDays: number
): { deals: Deal[]; stages: StageInfo[] } {
  const conv = new Set(conversionKeys);
  const stageById = new Map(meta.stages.map((s) => [s.id, s]));
  const pipelineName = new Map(meta.pipelines.map((p) => [p.id, p.title]));
  const byPipeline = new Map<string, DashStage[]>();
  for (const s of meta.stages) {
    const list = byPipeline.get(s.pipelineId) ?? [];
    list.push(s);
    byPipeline.set(s.pipelineId, list);
  }
  const minConv = new Map<string, number>();
  for (const [p, list] of byPipeline) {
    const orders = list.filter((s) => conv.has(s.key)).map((s) => s.order);
    if (orders.length) minConv.set(p, Math.min(...orders));
  }

  const out = deals.map((d): Deal => {
    const stage = stageById.get(d.stageId);
    const order = stage?.order ?? 0;
    const firstConv = minConv.get(d.pipelineId);
    const reached = (byPipeline.get(d.pipelineId) ?? []).filter((s) => s.order <= order).map((s) => s.key);
    return {
      ...d,
      stageKey: stage?.key ?? `etapa-${d.stageId}`,
      stageName: stage?.title ?? `Etapa ${d.stageId}`,
      stageOrder: order,
      pipelineName: pipelineName.get(d.pipelineId) ?? `Embudo ${d.pipelineId}`,
      converted: d.status === "won" || (d.status !== "lost" && firstConv !== undefined && order >= firstConv),
      stale: d.status === "open" && d.daysInStage >= staleDays,
      reached: reached.length ? reached : [stage?.key ?? `etapa-${d.stageId}`],
    };
  });

  // Etapas por nombre (los embudos de cada carrera suelen repetir los mismos nombres),
  // ordenadas por su posición promedio.
  const acc = new Map<string, { name: string; sum: number; n: number }>();
  for (const s of meta.stages) {
    const a = acc.get(s.key) ?? { name: s.title, sum: 0, n: 0 };
    a.sum += s.order;
    a.n++;
    acc.set(s.key, a);
  }
  const stages = [...acc.entries()]
    .map(([key, a]) => ({ key, name: a.name, order: a.sum / a.n, conversion: conv.has(key) }))
    .sort((a, b) => a.order - b.order);
  return { deals: out, stages };
}

export function dimValue(d: Deal, key: DimKey): string {
  switch (key) {
    case "faculty":
      return d.faculty;
    case "career":
      return d.career;
    case "pipeline":
      return d.pipelineName;
    case "stage":
      return d.stageKey;
    case "owner":
      return d.owner;
    case "status":
      return d.status;
    case "utm_source":
      return d.utmSource;
    case "utm_medium":
      return d.utmMedium;
    case "utm_term":
      return d.utmTerm;
    case "utm_campaign":
      return d.utmCampaign;
    case "classification":
      return d.classification;
    case "aging":
      return d.status === "open" ? agingLabel(d.daysInStage) : "";
  }
}

/** Aplica los filtros; `except` deja fuera uno (para que su propia tabla siga mostrando todas las opciones). */
export function applyFilters(deals: Deal[], filters: Filters, except?: DimKey): Deal[] {
  const active = (Object.entries(filters) as [DimKey, string[]][]).filter(([k, v]) => k !== except && v?.length);
  if (active.length === 0) return deals;
  const sets = active.map(([k, v]) => [k, new Set(v)] as const);
  return deals.filter((d) => sets.every(([k, set]) => set.has(dimValue(d, k))));
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const avg = (xs: number[]) => (xs.length ? sum(xs) / xs.length : null);
export function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export type Summary = {
  total: number;
  open: number;
  won: number;
  lost: number;
  converted: number;
  conversionRate: number | null;
  value: number;
  medianHoursToFirstNote: number | null;
  noNote: number;
  stale: number;
  avgDaysInStage: number | null;
  notes: number;
  avgNotesPerDeal: number | null;
  lastActivityAt: string | null;
};

export function summarize(deals: Deal[]): Summary {
  const open = deals.filter((d) => d.status === "open");
  const enriched = deals.filter((d) => d.enriched);
  const notes = sum(deals.map((d) => d.notesCount));
  const converted = deals.filter((d) => d.converted).length;
  return {
    total: deals.length,
    open: open.length,
    won: deals.filter((d) => d.status === "won").length,
    lost: deals.filter((d) => d.status === "lost").length,
    converted,
    conversionRate: deals.length ? converted / deals.length : null,
    value: sum(deals.map((d) => d.value)),
    medianHoursToFirstNote: median(deals.flatMap((d) => (d.hoursToFirstNote === null ? [] : [d.hoursToFirstNote]))),
    noNote: enriched.filter((d) => d.notesCount === 0).length,
    stale: open.filter((d) => d.stale).length,
    avgDaysInStage: avg(open.map((d) => d.daysInStage)),
    notes,
    avgNotesPerDeal: enriched.length ? notes / enriched.length : null,
    lastActivityAt: deals.reduce<string | null>((m, d) => (d.lastActivityAt && (!m || d.lastActivityAt > m) ? d.lastActivityAt : m), null),
  };
}

export type DimRow = Summary & { value_key: string; label: string };

export function groupRows(deals: Deal[], key: DimKey, label: (v: string) => string = (v) => v): DimRow[] {
  const groups = new Map<string, Deal[]>();
  for (const d of deals) {
    const v = dimValue(d, key);
    if (key === "aging" && !v) continue;
    const list = groups.get(v);
    if (list) list.push(d);
    else groups.set(v, [d]);
  }
  return [...groups.entries()]
    .map(([v, list]) => ({ ...summarize(list), value_key: v, label: label(v) }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "es"));
}

export type FunnelStep = StageInfo & { reached: number; current: number; stale: number; avgDays: number | null; medianDays: number | null };

/** Embudo: cuántos tratos llegaron a cada etapa (están en ella o más adelante) y cuántos están ahí ahora. */
export function funnel(deals: Deal[], stages: StageInfo[]): FunnelStep[] {
  const inScope = new Set(deals.flatMap((d) => d.reached));
  return stages
    .filter((s) => inScope.has(s.key))
    .map((s) => {
      const here = deals.filter((d) => d.stageKey === s.key && d.status === "open");
      const days = here.map((d) => d.daysInStage);
      return {
        ...s,
        reached: deals.filter((d) => d.reached.includes(s.key)).length,
        current: here.length,
        stale: here.filter((d) => d.stale).length,
        avgDays: avg(days),
        medianDays: median(days),
      };
    });
}

export type TimelineUnit = "día" | "semana" | "mes";
export type TimelinePoint = { bucket: string; label: string; total: number; series: Record<string, number> };

const DAY = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function timeline(
  deals: Deal[],
  from: string,
  to: string,
  seriesKey: DimKey | null,
  seriesValues: string[]
): { unit: TimelineUnit; points: TimelinePoint[] } {
  const start = Date.parse(from);
  const end = Date.parse(to);
  const span = Math.max(1, (end - start) / DAY);
  const unit: TimelineUnit = span <= 45 ? "día" : span <= 270 ? "semana" : "mes";
  const bucketOf = (ms: number) => {
    const d = new Date(ms);
    if (unit === "día") return isoDay(ms);
    if (unit === "mes") return isoDay(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    const dow = (d.getUTCDay() + 6) % 7;
    return isoDay(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow));
  };
  const buckets: string[] = [];
  for (let ms = Date.parse(bucketOf(start)); ms <= end && buckets.length < 400; ) {
    const k = bucketOf(ms);
    if (buckets.at(-1) !== k) buckets.push(k);
    const d = new Date(ms);
    ms = unit === "día" ? ms + DAY : unit === "semana" ? ms + 7 * DAY : Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  }
  const fmt = new Intl.DateTimeFormat("es", {
    day: unit === "mes" ? undefined : "numeric",
    month: "short",
    year: unit === "mes" ? "2-digit" : undefined,
    timeZone: "UTC",
  });
  const points = new Map(buckets.map((b) => [b, { bucket: b, label: fmt.format(new Date(b)), total: 0, series: {} as Record<string, number> }]));
  for (const d of deals) {
    const p = points.get(bucketOf(Date.parse(d.createdDay)));
    if (!p) continue;
    p.total++;
    if (seriesKey) {
      const v = dimValue(d, seriesKey);
      if (seriesValues.includes(v)) p.series[v] = (p.series[v] ?? 0) + 1;
    }
  }
  return { unit, points: [...points.values()] };
}

// ---------------------------------------------------------------------------------------------
// Formatos

const NUM = new Intl.NumberFormat("es");
export const fmtNum = (n: number) => NUM.format(n);
export const fmtPct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);
export const fmtMoney = (n: number) => `$${NUM.format(Math.round(n))}`;
export function fmtDays(n: number | null): string {
  if (n === null) return "—";
  if (n < 1) return "< 1 d";
  return `${n < 10 ? n.toFixed(1) : Math.round(n)} d`;
}
export function fmtHours(n: number | null): string {
  if (n === null) return "—";
  if (n < 1) return `${Math.round(n * 60)} min`;
  if (n < 48) return `${n < 10 ? n.toFixed(1) : Math.round(n)} h`;
  return `${Math.round(n / 24)} d`;
}
const dateFormats = new Map<string, Intl.DateTimeFormat>();
/** Fecha corta en la zona horaria del equipo (igual en el servidor y en el navegador). */
export function fmtDate(iso: string | null, timeZone: string): string {
  if (!iso) return "—";
  let f = dateFormats.get(timeZone);
  if (!f) dateFormats.set(timeZone, (f = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "2-digit", timeZone })));
  return f.format(new Date(iso));
}

export const RANGE_OPTIONS = [
  { value: "7d", label: "Últimos 7 días" },
  { value: "30d", label: "Últimos 30 días" },
  { value: "90d", label: "Últimos 90 días" },
  { value: "mes", label: "Este mes" },
  { value: "mes_ant", label: "Mes anterior" },
  { value: "anio", label: "Este año" },
  { value: "custom", label: "Personalizado" },
] as const;
