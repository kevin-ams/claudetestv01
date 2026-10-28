// Pure aggregation over synced deals. No I/O, so it is shared by the page and the demo mode.
import type { AcMeta, DealRecord, DealStatus, FieldKey, FieldMap } from "./types";

const DAY = 86_400_000;
const HOUR = 3_600_000;
export const UNKNOWN = "(sin dato)";

export type DashboardFilters = {
  pipelineIds: string[];
  from: string | null; // yyyy-mm-dd, inclusive, by deal creation date
  to: string | null;
  ownerId: string | null;
  career: string | null;
  status: DealStatus | null;
};

export type ResolvedDeal = DealRecord & {
  pipelineName: string;
  stageName: string;
  stageOrder: number;
  ownerName: string;
  createdDay: string; // yyyy-mm-dd in the dashboard time zone
  daysInStage: number;
  daysOpen: number;
  hoursToFirstNote: number | null;
  daysSinceActivity: number | null;
  stale: boolean;
  dims: Record<FieldKey, string>;
};

export type DimensionRow = {
  label: string;
  total: number;
  open: number;
  won: number;
  lost: number;
  winRate: number | null; // won / (won + lost)
  value: number;
  avgHoursToFirstNote: number | null;
  noNote: number;
  stale: number;
};

export type StageRow = {
  stageId: string;
  pipelineName: string;
  name: string;
  open: number;
  value: number;
  avgDays: number | null;
  medianDays: number | null;
  maxDays: number | null;
  stale: number;
  noNote: number;
};

export type OwnerRow = DimensionRow & {
  ownerId: string | null;
  notes: number;
  avgNotesPerDeal: number | null;
  lastActivityAt: string | null;
  avgDaysInStage: number | null;
};

export type Dashboard = {
  deals: ResolvedDeal[];
  kpis: {
    total: number;
    open: number;
    won: number;
    lost: number;
    winRate: number | null;
    openValue: number;
    wonValue: number;
    avgDaysInStage: number | null;
    stale: number;
    noNote: number;
    medianHoursToFirstNote: number | null;
    avgDaysToClose: number | null;
    enrichedShare: number;
  };
  timeline: { bucket: string; label: string; count: number; won: number }[];
  timelineUnit: "día" | "semana" | "mes";
  stages: StageRow[];
  aging: { label: string; count: number }[];
  careers: DimensionRow[];
  careerStage: { careers: string[]; stages: { id: string; name: string }[]; cells: Record<string, number> };
  owners: OwnerRow[];
  dimensions: Record<Exclude<FieldKey, "career">, DimensionRow[]>;
  options: { careers: string[]; owners: { id: string; name: string }[] };
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function avg(values: number[]): number | null {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function fieldValue(deal: DealRecord, map: FieldMap, key: FieldKey): string {
  const ref = map[key];
  if (!ref) return UNKNOWN;
  const raw = ref.source === "deal" ? deal.dealFields[ref.id] : deal.contactFields[ref.id];
  const v = raw?.trim();
  return v ? v : UNKNOWN;
}

export function resolveDeals(
  deals: DealRecord[],
  meta: AcMeta,
  map: FieldMap,
  staleDays: number,
  now: number,
  timeZone: string
): ResolvedDeal[] {
  const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const pipelines = new Map(meta.pipelines.map((p) => [p.id, p.title]));
  const stages = new Map(meta.stages.map((s) => [s.id, s]));
  const users = new Map(meta.users.map((u) => [u.id, u.name]));

  return deals.map((d) => {
    const stage = stages.get(d.stageId);
    const end = d.status === "open" ? now : Date.parse(d.closedAt ?? d.updatedAt ?? "") || now;
    const enteredAt = Date.parse(d.stageEnteredAt ?? d.createdAt);
    const daysInStage = Math.max(0, (end - enteredAt) / DAY);
    const created = Date.parse(d.createdAt);
    const hoursToFirstNote = d.firstNote ? Math.max(0, (Date.parse(d.firstNote.at) - created) / HOUR) : null;
    const daysSinceActivity = d.lastActivityAt ? (now - Date.parse(d.lastActivityAt)) / DAY : null;
    return {
      ...d,
      pipelineName: pipelines.get(d.pipelineId) ?? `Embudo ${d.pipelineId}`,
      stageName: stage?.title ?? `Etapa ${d.stageId}`,
      stageOrder: stage?.order ?? 999,
      ownerName: (d.ownerId && users.get(d.ownerId)) || "Sin asesor",
      createdDay: dayFmt.format(created),
      daysInStage,
      daysOpen: Math.max(0, (end - created) / DAY),
      hoursToFirstNote,
      daysSinceActivity,
      stale: d.status === "open" && daysInStage >= staleDays,
      dims: {
        career: fieldValue(d, map, "career"),
        utm_source: fieldValue(d, map, "utm_source"),
        utm_medium: fieldValue(d, map, "utm_medium"),
        utm_term: fieldValue(d, map, "utm_term"),
        utm_campaign: fieldValue(d, map, "utm_campaign"),
        lead_classification: fieldValue(d, map, "lead_classification"),
      },
    };
  });
}

function dimensionRow(label: string, deals: ResolvedDeal[]): DimensionRow {
  const won = deals.filter((d) => d.status === "won").length;
  const lost = deals.filter((d) => d.status === "lost").length;
  return {
    label,
    total: deals.length,
    open: deals.filter((d) => d.status === "open").length,
    won,
    lost,
    winRate: won + lost > 0 ? won / (won + lost) : null,
    value: deals.reduce((s, d) => s + d.value, 0),
    avgHoursToFirstNote: avg(deals.flatMap((d) => (d.hoursToFirstNote === null ? [] : [d.hoursToFirstNote]))),
    noNote: deals.filter((d) => d.enriched && d.notesCount === 0).length,
    stale: deals.filter((d) => d.stale).length,
  };
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = out.get(k);
    if (list) list.push(item);
    else out.set(k, [item]);
  }
  return out;
}

function dimensionRows(deals: ResolvedDeal[], key: (d: ResolvedDeal) => string): DimensionRow[] {
  return [...groupBy(deals, key)]
    .map(([label, list]) => dimensionRow(label, list))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
}

function isoDay(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

function buildTimeline(deals: ResolvedDeal[], from: string | null, to: string | null, now: number) {
  const created = deals.map((d) => Date.parse(d.createdDay));
  const start = from ? Date.parse(from) : created.length ? Math.min(...created) : now;
  const end = to ? Date.parse(to) : now;
  const spanDays = Math.max(1, (end - start) / DAY);
  const unit: Dashboard["timelineUnit"] = spanDays <= 45 ? "día" : spanDays <= 270 ? "semana" : "mes";

  const bucketOf = (ms: number) => {
    const d = new Date(ms);
    if (unit === "día") return isoDay(ms);
    if (unit === "mes") return isoDay(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
    return isoDay(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow));
  };

  const buckets: string[] = [];
  for (let ms = Date.parse(bucketOf(start)); ms <= end; ) {
    const key = bucketOf(ms);
    if (buckets.at(-1) !== key) buckets.push(key);
    const d = new Date(ms);
    ms =
      unit === "día"
        ? ms + DAY
        : unit === "semana"
          ? ms + 7 * DAY
          : Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    if (buckets.length > 400) break;
  }

  const counts = groupBy(deals, (d) => bucketOf(Date.parse(d.createdDay)));
  const fmt = new Intl.DateTimeFormat("es-MX", {
    day: unit === "mes" ? undefined : "numeric",
    month: "short",
    year: unit === "mes" ? "2-digit" : undefined,
    timeZone: "UTC",
  });
  return {
    unit,
    points: buckets.map((b) => ({
      bucket: b,
      label: fmt.format(new Date(b)),
      count: counts.get(b)?.length ?? 0,
      won: counts.get(b)?.filter((d) => d.status === "won").length ?? 0,
    })),
  };
}

const AGING = [
  { label: "0–3 días", max: 3 },
  { label: "4–7 días", max: 7 },
  { label: "8–14 días", max: 14 },
  { label: "15–30 días", max: 30 },
  { label: "31–60 días", max: 60 },
  { label: "Más de 60 días", max: Infinity },
];

export function buildDashboard(
  all: ResolvedDeal[],
  meta: AcMeta,
  filters: DashboardFilters,
  now: number
): Dashboard {
  const inPipelines = all.filter(
    (d) => filters.pipelineIds.length === 0 || filters.pipelineIds.includes(d.pipelineId)
  );
  const inRange = inPipelines.filter((d) => {
    const day = d.createdDay;
    return (!filters.from || day >= filters.from) && (!filters.to || day <= filters.to);
  });
  // Options are computed before owner/career/status filters so the selects stay usable.
  const options = {
    careers: [...new Set(inRange.map((d) => d.dims.career))].sort(),
    owners: [...new Map(inRange.map((d) => [d.ownerId ?? "", d.ownerName])).entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
  const deals = inRange.filter(
    (d) =>
      (filters.ownerId === null || (d.ownerId ?? "") === filters.ownerId) &&
      (filters.career === null || d.dims.career === filters.career) &&
      (filters.status === null || d.status === filters.status)
  );

  const open = deals.filter((d) => d.status === "open");
  const won = deals.filter((d) => d.status === "won");
  const lost = deals.filter((d) => d.status === "lost");

  // Stages of the selected pipelines, in pipeline order, plus any stage referenced by a deal.
  const pipelineIds = filters.pipelineIds.length
    ? filters.pipelineIds
    : [...new Set(deals.map((d) => d.pipelineId))];
  const pipelineName = new Map(meta.pipelines.map((p) => [p.id, p.title]));
  const stageList = meta.stages
    .filter((s) => pipelineIds.includes(s.pipelineId))
    .sort((a, b) => pipelineIds.indexOf(a.pipelineId) - pipelineIds.indexOf(b.pipelineId) || a.order - b.order);
  const openByStage = groupBy(open, (d) => d.stageId);
  for (const id of openByStage.keys()) {
    if (!stageList.some((s) => s.id === id)) {
      const d = openByStage.get(id)![0];
      stageList.push({ id, title: d.stageName, pipelineId: d.pipelineId, order: 999 });
    }
  }
  const multiPipeline = new Set(stageList.map((s) => s.pipelineId)).size > 1;
  const stages: StageRow[] = stageList.map((s) => {
    const list = openByStage.get(s.id) ?? [];
    const days = list.map((d) => d.daysInStage);
    return {
      stageId: s.id,
      pipelineName: multiPipeline ? (pipelineName.get(s.pipelineId) ?? "") : "",
      name: s.title,
      open: list.length,
      value: list.reduce((sum, d) => sum + d.value, 0),
      avgDays: avg(days),
      medianDays: median(days),
      maxDays: days.length ? Math.max(...days) : null,
      stale: list.filter((d) => d.stale).length,
      noNote: list.filter((d) => d.enriched && d.notesCount === 0).length,
    };
  });

  const aging = AGING.map((b, i) => ({
    label: b.label,
    count: open.filter((d) => d.daysInStage <= b.max && (i === 0 || d.daysInStage > AGING[i - 1].max)).length,
  }));

  const careers = dimensionRows(deals, (d) => d.dims.career);
  const careerStage = {
    careers: careers.map((c) => c.label),
    stages: stages.map((s) => ({ id: s.stageId, name: s.name })),
    cells: Object.fromEntries(
      [...groupBy(open, (d) => `${d.dims.career}::${d.stageId}`)].map(([k, v]) => [k, v.length])
    ),
  };

  const owners: OwnerRow[] = [...groupBy(deals, (d) => d.ownerId ?? "")]
    .map(([ownerId, list]) => {
      const notes = list.reduce((s, d) => s + d.notesCount, 0);
      const enriched = list.filter((d) => d.enriched);
      const lastActivityAt = list.reduce<string | null>(
        (m, d) => (d.lastActivityAt && (!m || d.lastActivityAt > m) ? d.lastActivityAt : m),
        null
      );
      const openList = list.filter((d) => d.status === "open");
      return {
        ...dimensionRow(list[0].ownerName, list),
        ownerId: ownerId || null,
        notes,
        avgNotesPerDeal: enriched.length ? notes / enriched.length : null,
        lastActivityAt,
        avgDaysInStage: avg(openList.map((d) => d.daysInStage)),
      };
    })
    .sort((a, b) => b.total - a.total);

  const timeline = buildTimeline(deals, filters.from, filters.to, now);
  const closedDays = [...won, ...lost].map((d) => d.daysOpen);

  return {
    deals: deals.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    kpis: {
      total: deals.length,
      open: open.length,
      won: won.length,
      lost: lost.length,
      winRate: won.length + lost.length ? won.length / (won.length + lost.length) : null,
      openValue: open.reduce((s, d) => s + d.value, 0),
      wonValue: won.reduce((s, d) => s + d.value, 0),
      avgDaysInStage: avg(open.map((d) => d.daysInStage)),
      stale: open.filter((d) => d.stale).length,
      noNote: deals.filter((d) => d.enriched && d.notesCount === 0).length,
      medianHoursToFirstNote: median(deals.flatMap((d) => (d.hoursToFirstNote === null ? [] : [d.hoursToFirstNote]))),
      avgDaysToClose: avg(closedDays),
      enrichedShare: deals.length ? deals.filter((d) => d.enriched).length / deals.length : 1,
    },
    timeline: timeline.points,
    timelineUnit: timeline.unit,
    stages,
    aging,
    careers,
    careerStage,
    owners,
    dimensions: {
      utm_source: dimensionRows(deals, (d) => d.dims.utm_source),
      utm_medium: dimensionRows(deals, (d) => d.dims.utm_medium),
      utm_term: dimensionRows(deals, (d) => d.dims.utm_term),
      utm_campaign: dimensionRows(deals, (d) => d.dims.utm_campaign),
      lead_classification: dimensionRows(deals, (d) => d.dims.lead_classification),
    },
    options,
  };
}

// Picks a default field for each dashboard dimension by matching AC field labels / perstags.
export function guessFieldMap(meta: AcMeta): FieldMap {
  const patterns: Record<FieldKey, RegExp> = {
    career: /carrera|career|programa|licenciatura|curso/i,
    utm_source: /utm.?source/i,
    utm_medium: /utm.?medium/i,
    utm_term: /utm.?term/i,
    utm_campaign: /utm.?campaign/i,
    lead_classification: /clasifica|classification|calificaci|lead.?(type|tipo|score)|chat/i,
  };
  const find = (re: RegExp) => {
    const deal = meta.dealFields.find((f) => re.test(f.label) || re.test(f.key));
    if (deal) return { source: "deal" as const, id: deal.id };
    const contact = meta.contactFields.find((f) => re.test(f.label) || re.test(f.key));
    return contact ? { source: "contact" as const, id: contact.id } : null;
  };
  return Object.fromEntries(
    (Object.keys(patterns) as FieldKey[]).map((k) => [k, find(patterns[k])])
  ) as FieldMap;
}
