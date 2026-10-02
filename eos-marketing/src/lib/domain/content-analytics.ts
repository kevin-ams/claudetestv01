// Análisis de contenido: métricas del Calendario editorial y del Control de coberturas
// en un periodo (semana, mes, trimestre, año o rango). Sin acceso a la base.

import { addDays, addMonths, differenceInCalendarDays, endOfMonth, endOfQuarter, endOfYear, format, parseISO, startOfMonth, startOfQuarter, startOfYear } from "date-fns";
import { es } from "date-fns/locale";
import { addDaysISO, shiftWeek, weekStartISO } from "@/lib/utils/dates";
import {
  BUFFER_SLOTS,
  CAPAS,
  DONE_STATUS,
  HYGIENE_FLOOR,
  isActivePiece,
  type Coverage,
  type EditorialPiece,
} from "./editorial-shared";

export type PeriodKind = "semana" | "mes" | "trimestre" | "anio" | "rango";
export const PERIOD_LABEL: Record<PeriodKind, string> = {
  semana: "Semana",
  mes: "Mes",
  trimestre: "Trimestre",
  anio: "Año",
  rango: "Rango",
};

export type Period = {
  kind: PeriodKind;
  from: string; // inclusive, yyyy-MM-dd
  to: string; // inclusive
  label: string;
  /** Periodo anterior de la misma duración (para comparar). */
  prev: { from: string; to: string };
  /** Referencia para navegar (‹ ›). */
  ref: string;
};

const iso = (d: Date) => format(d, "yyyy-MM-dd");

export function resolvePeriod(kind: PeriodKind, ref: string, desde?: string, hasta?: string): Period {
  const d = parseISO(ref);
  if (kind === "semana") {
    const from = weekStartISO(d);
    const to = addDaysISO(from, 6);
    return { kind, from, to, ref: from, label: `Semana del ${format(parseISO(from), "d MMM", { locale: es })} al ${format(parseISO(to), "d MMM yyyy", { locale: es })}`, prev: { from: shiftWeek(from, -1), to: addDaysISO(from, -1) } };
  }
  if (kind === "mes") {
    const from = startOfMonth(d);
    const prev = addMonths(from, -1);
    return { kind, from: iso(from), to: iso(endOfMonth(d)), ref: iso(from), label: format(from, "MMMM yyyy", { locale: es }), prev: { from: iso(prev), to: iso(endOfMonth(prev)) } };
  }
  if (kind === "trimestre") {
    const from = startOfQuarter(d);
    const prev = addMonths(from, -3);
    const q = Math.floor(from.getMonth() / 3) + 1;
    return { kind, from: iso(from), to: iso(endOfQuarter(d)), ref: iso(from), label: `T${q} ${from.getFullYear()}`, prev: { from: iso(prev), to: iso(endOfQuarter(prev)) } };
  }
  if (kind === "anio") {
    const from = startOfYear(d);
    const prev = startOfYear(addMonths(from, -12));
    return { kind, from: iso(from), to: iso(endOfYear(d)), ref: iso(from), label: String(from.getFullYear()), prev: { from: iso(prev), to: iso(endOfYear(prev)) } };
  }
  const a = desde && /^\d{4}-\d{2}-\d{2}$/.test(desde) ? desde : iso(addDays(d, -27));
  const b = hasta && /^\d{4}-\d{2}-\d{2}$/.test(hasta) && hasta >= a ? hasta : iso(d);
  const days = differenceInCalendarDays(parseISO(b), parseISO(a)) + 1;
  return {
    kind,
    from: a,
    to: b,
    ref: b,
    label: `Del ${format(parseISO(a), "d MMM yyyy", { locale: es })} al ${format(parseISO(b), "d MMM yyyy", { locale: es })}`,
    prev: { from: addDaysISO(a, -days), to: addDaysISO(a, -1) },
  };
}

/** Mueve la referencia un periodo hacia atrás o adelante. */
export function shiftPeriod(p: Period, delta: number): string {
  const d = parseISO(p.ref);
  if (p.kind === "semana") return shiftWeek(p.ref, delta);
  if (p.kind === "mes") return iso(addMonths(d, delta));
  if (p.kind === "trimestre") return iso(addMonths(d, 3 * delta));
  if (p.kind === "anio") return iso(addMonths(d, 12 * delta));
  return p.ref;
}

/** Semanas (lunes) cuyo lunes cae en el periodo; las piezas se cuentan por su semana planificada. */
export function weeksIn(from: string, to: string): string[] {
  const out: string[] = [];
  let w = weekStartISO(parseISO(from));
  if (w < from) w = shiftWeek(w, 1);
  while (w <= to) {
    out.push(w);
    w = shiftWeek(w, 1);
  }
  return out;
}

export type Bucket = { key: string; label: string; from: string; to: string };

/** Cortes de la tendencia: por semana (hasta ~6 meses) o por mes. */
export function trendBuckets(p: Period): Bucket[] {
  // Una sola semana: se muestran las 8 semanas que terminan en ella, como contexto.
  const from = p.kind === "semana" ? shiftWeek(p.from, -7) : p.from;
  const weeks = weeksIn(from, p.to);
  if (weeks.length <= 26) {
    return weeks.map((w) => ({ key: w, label: format(parseISO(w), "d MMM", { locale: es }), from: w, to: addDaysISO(w, 6) }));
  }
  const out: Bucket[] = [];
  let m = startOfMonth(parseISO(p.from));
  while (iso(m) <= p.to) {
    out.push({ key: iso(m), label: format(m, "MMM yy", { locale: es }), from: iso(m), to: iso(endOfMonth(m)) });
    m = addMonths(m, 1);
  }
  return out;
}

// Una pieza cuenta en el periodo si el lunes de su semana planificada cae dentro.
const inWeekRange = (p: EditorialPiece, from: string, to: string) => p.week_start !== null && p.week_start >= from && p.week_start <= to;
const inDateRange = (c: Coverage, from: string, to: string) => c.date !== null && c.date >= from && c.date <= to;

export type Totals = {
  pieces: number;
  published: number;
  completion: number | null;
  byCapa: Record<string, number>;
  hygienePct: number | null;
  buffer: number;
  bufferSlots: number;
  rescheduled: number;
  cancelled: number;
  withLink: number;
  coverages: number;
  overtime: number;
  replaced: number;
};

export function totals(pieces: EditorialPiece[], coverages: Coverage[], from: string, to: string): Totals {
  const all = pieces.filter((p) => inWeekRange(p, from, to));
  const active = all.filter(isActivePiece);
  const published = active.filter((p) => p.status === DONE_STATUS);
  const byCapa: Record<string, number> = { Hero: 0, Hub: 0, Hygiene: 0 };
  for (const p of published) if (p.capa in byCapa) byCapa[p.capa]++;
  const tagged = byCapa.Hero + byCapa.Hub + byCapa.Hygiene;
  const cov = coverages.filter((c) => inDateRange(c, from, to));
  const done = cov.filter((c) => c.status === "Realizada");
  return {
    pieces: active.length,
    published: published.length,
    completion: active.length ? Math.round((published.length / active.length) * 100) : null,
    byCapa,
    hygienePct: tagged ? Math.round((byCapa.Hygiene / tagged) * 100) : null,
    buffer: active.filter((p) => p.is_buffer).length,
    bufferSlots: weeksIn(from, to).length * BUFFER_SLOTS,
    rescheduled: all.filter((p) => p.status === "Reprogramado").length,
    cancelled: all.filter((p) => p.status === "Cancelado").length,
    withLink: published.filter((p) => p.link).length,
    coverages: done.length,
    overtime: round(cov.reduce((a, c) => a + Number(c.overtime_hours), 0)),
    replaced: round(cov.reduce((a, c) => a + Number(c.replaced_hours), 0)),
  };
}

const round = (n: number) => Math.round(n * 100) / 100;

export type TrendPoint = { key: string; label: string; Hero: number; Hub: number; Hygiene: number; other: number; published: number; planned: number; coverages: number };

export function trend(pieces: EditorialPiece[], coverages: Coverage[], buckets: Bucket[]): TrendPoint[] {
  return buckets.map((b) => {
    const t = totals(pieces, coverages, b.from, b.to);
    const other = t.published - t.byCapa.Hero - t.byCapa.Hub - t.byCapa.Hygiene;
    return { key: b.key, label: b.label, Hero: t.byCapa.Hero, Hub: t.byCapa.Hub, Hygiene: t.byCapa.Hygiene, other, published: t.published, planned: t.pieces, coverages: t.coverages };
  });
}

export type Breakdown = { key: string; total: number; published: number };

/** Conteo por una dimensión (pilar, facultad, frente, estado) de las piezas activas del periodo. */
export function breakdown(pieces: EditorialPiece[], from: string, to: string, dim: (p: EditorialPiece) => string, includeInactive = false): Breakdown[] {
  const map = new Map<string, Breakdown>();
  for (const p of pieces) {
    if (!inWeekRange(p, from, to) || (!includeInactive && !isActivePiece(p))) continue;
    const key = dim(p) || "Sin dato";
    const b = map.get(key) ?? { key, total: 0, published: 0 };
    b.total++;
    if (p.status === DONE_STATUS) b.published++;
    map.set(key, b);
  }
  return [...map.values()].sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
}

export type PersonRow = {
  id: number | null;
  total: number;
  published: number;
  Hero: number;
  Hub: number;
  Hygiene: number;
  coverages: number;
  overtime: number;
  replaced: number;
};

export function byPerson(pieces: EditorialPiece[], coverages: Coverage[], from: string, to: string): PersonRow[] {
  const map = new Map<number | null, PersonRow>();
  const row = (id: number | null) => {
    let r = map.get(id);
    if (!r) {
      r = { id, total: 0, published: 0, Hero: 0, Hub: 0, Hygiene: 0, coverages: 0, overtime: 0, replaced: 0 };
      map.set(id, r);
    }
    return r;
  };
  for (const p of pieces) {
    if (!inWeekRange(p, from, to) || !isActivePiece(p)) continue;
    const r = row(p.assignee_id);
    r.total++;
    if (p.status === DONE_STATUS) {
      r.published++;
      if ((CAPAS as readonly string[]).includes(p.capa)) r[p.capa as "Hero" | "Hub" | "Hygiene"]++;
    }
  }
  for (const c of coverages) {
    if (!inDateRange(c, from, to)) continue;
    const r = row(c.assignee_id);
    if (c.status === "Realizada") r.coverages++;
    r.overtime = round(r.overtime + Number(c.overtime_hours));
    r.replaced = round(r.replaced + Number(c.replaced_hours));
  }
  return [...map.values()].sort((a, b) => b.published - a.published);
}

export { HYGIENE_FLOOR };
