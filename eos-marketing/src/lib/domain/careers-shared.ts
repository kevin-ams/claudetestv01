import { addDays, format, getDaysInMonth, parseISO } from "date-fns";
import type { Career, CareerLevel, CareerMonthlyGoal, CareerWeekly } from "./types";

export const CAREER_LEVELS: CareerLevel[] = ["Pregrado", "Postgrado", "Técnico", "Diplomado"];

/** Símbolo de moneda para el presupuesto (reporte de Meta). */
export const CURRENCY = "Q";

export type Tone = "green" | "yellow" | "red" | "none";

/** Leads: ≥100% de la meta verde, ≥80% amarillo, menos rojo. */
export function leadsTone(leads: number | null, goal: number): Tone {
  if (leads === null || goal <= 0) return "none";
  const pct = leads / goal;
  if (pct >= 1) return "green";
  if (pct >= 0.8) return "yellow";
  return "red";
}

/**
 * Presupuesto: se busca consumir lo planificado. 90–110% verde,
 * 75–90% o 110–125% amarillo, fuera de eso rojo (sub o sobre-ejecución).
 */
export function budgetTone(spent: number | null, goal: number): Tone {
  if (spent === null || goal <= 0) return "none";
  const pct = spent / goal;
  if (pct >= 0.9 && pct <= 1.1) return "green";
  if (pct >= 0.75 && pct <= 1.25) return "yellow";
  return "red";
}

export const TONE_CLASS: Record<Tone, string> = {
  green: "bg-green-bg text-green",
  yellow: "bg-yellow-bg text-yellow",
  red: "bg-red-bg text-red",
  none: "text-muted",
};

export function pct(value: number | null, goal: number): string {
  if (value === null || goal <= 0) return "—";
  return `${Math.round((value / goal) * 100)}%`;
}

export function money(value: number | null): string {
  if (value === null) return "—";
  return `${CURRENCY} ${value.toLocaleString("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function num(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString("es-GT", { maximumFractionDigits: 2 });
}

export function costPerLead(spent: number | null, leads: number | null): string {
  if (spent === null || !leads) return "—";
  return money(spent / leads);
}

export type WeeklyGoal = { leads: number; budget: number };

/** "2026-09-14" → "2026-09-01" */
export function monthKey(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/**
 * Meta de una semana a partir de las metas mensuales: cada día de la semana
 * aporta (meta del mes / días del mes). Así, una semana que cruza dos meses
 * toma la parte proporcional de cada uno.
 */
export function prorateWeeklyGoals(
  weekStart: string,
  goals: CareerMonthlyGoal[]
): Record<number, WeeklyGoal> {
  const byKey = new Map(goals.map((g) => [`${g.career_id}:${g.month}`, g]));
  const careerIds = new Set(goals.map((g) => g.career_id));
  const result: Record<number, WeeklyGoal> = {};
  const start = parseISO(weekStart);
  for (const careerId of careerIds) {
    let leads = 0;
    let budget = 0;
    for (let i = 0; i < 7; i++) {
      const day = addDays(start, i);
      const g = byKey.get(`${careerId}:${format(day, "yyyy-MM")}-01`);
      if (!g) continue;
      const days = getDaysInMonth(day);
      leads += g.leads_goal / days;
      budget += g.budget_goal / days;
    }
    result[careerId] = {
      leads: Math.round(leads * 10) / 10,
      budget: Math.round(budget * 100) / 100,
    };
  }
  return result;
}

/** Meses (yyyy-mm-01) que toca una semana. */
export function monthsOfWeek(weekStart: string): string[] {
  const start = parseISO(weekStart);
  return [...new Set([monthKey(weekStart), monthKey(format(addDays(start, 6), "yyyy-MM-dd"))])];
}

export type CareerRow = Career & {
  leads_goal: number;
  budget_goal: number;
  leads: number | null;
  leads_source: CareerWeekly["leads_source"];
  budget_spent: number | null;
  budget_source: CareerWeekly["budget_source"];
};

export function mergeWeekly(
  careers: Career[],
  weekly: CareerWeekly[],
  goals: Record<number, WeeklyGoal>
): CareerRow[] {
  const byCareer = new Map(weekly.map((w) => [w.career_id, w]));
  return careers.map((c) => {
    const w = byCareer.get(c.id);
    return {
      ...c,
      leads_goal: goals[c.id]?.leads ?? 0,
      budget_goal: goals[c.id]?.budget ?? 0,
      leads: w?.leads ?? null,
      leads_source: w?.leads_source ?? null,
      budget_spent: w?.budget_spent ?? null,
      budget_source: w?.budget_source ?? null,
    };
  });
}

export type Totals = {
  careers: number;
  leads: number;
  leadsGoal: number;
  spent: number;
  budgetGoal: number;
  leadsRed: number;
  budgetRed: number;
  hasLeads: boolean;
  hasSpent: boolean;
};

export function totalsFor(rows: CareerRow[]): Totals {
  const t: Totals = {
    careers: rows.length,
    leads: 0,
    leadsGoal: 0,
    spent: 0,
    budgetGoal: 0,
    leadsRed: 0,
    budgetRed: 0,
    hasLeads: false,
    hasSpent: false,
  };
  for (const r of rows) {
    t.leadsGoal += r.leads_goal;
    t.budgetGoal += r.budget_goal;
    if (r.leads !== null) {
      t.leads += r.leads;
      t.hasLeads = true;
    }
    if (r.budget_spent !== null) {
      t.spent += r.budget_spent;
      t.hasSpent = true;
    }
  }
  // Una carrera sin dato cuenta como 0 solo si la semana ya tiene datos cargados.
  for (const r of rows) {
    if (t.hasLeads && leadsTone(r.leads ?? 0, r.leads_goal) === "red") t.leadsRed++;
    if (t.hasSpent && budgetTone(r.budget_spent ?? 0, r.budget_goal) === "red") t.budgetRed++;
  }
  return t;
}

export function careerLabel(c: Pick<Career, "code" | "name">): string {
  return c.code ? `${c.code} · ${c.name}` : c.name;
}

// ---------------------------------------------------------------------------
// Importador CSV (reporte de Meta Ads)
// ---------------------------------------------------------------------------

/** Parser CSV simple con comillas; detecta coma, punto y coma o tabulador. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = [",", ";", "\t"].reduce((best, d) =>
    firstLine.split(d).length > firstLine.split(best).length ? d : best
  );

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** "Q 1,234.56", "1.234,56", "$1234" → número. */
export function parseAmount(raw: string): number | null {
  let s = raw.replace(/[^\d.,-]/g, "");
  if (!s || !/\d/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    const decimalSep = lastComma > lastDot ? "," : ".";
    const thousandSep = decimalSep === "," ? "." : ",";
    s = s.split(thousandSep).join("").replace(decimalSep, ".");
  } else if (lastComma > -1) {
    // Solo comas: decimal si hay exactamente 1 o 2 dígitos al final.
    s = /,\d{1,2}$/.test(s) && s.split(",").length === 2 ? s.replace(",", ".") : s.split(",").join("");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** "2026-09-21", "21/09/2026" o "9/21/2026" → "yyyy-mm-dd". */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (m) {
    let [day, month] = [Number(m[1]), Number(m[2])];
    if (month > 12 && day <= 12) [day, month] = [month, day];
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${m[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}

/** Minúsculas y sin acentos, para comparar textos. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

const COLUMN_HINTS = {
  campaign: ["nombre de la campana", "campaign name", "campana", "campaign", "conjunto de anuncios", "ad set name", "nombre del anuncio", "ad name"],
  spend: ["importe gastado", "amount spent", "gasto", "spend", "spent", "consumo", "costo", "cost"],
  date: ["inicio del informe", "reporting starts", "fecha de inicio", "fecha", "date", "dia", "day"],
  code: ["codigo de carrera", "codigo", "code", "carrera"],
} as const;

export type ColumnKind = keyof typeof COLUMN_HINTS;

/** Adivina el índice de columna para cada dato según los encabezados. */
export function guessColumns(header: string[]): Record<ColumnKind, number> {
  const h = header.map(normalizeText);
  const pick = (kind: ColumnKind, exclude: number[] = []) => {
    for (const hint of COLUMN_HINTS[kind]) {
      const idx = h.findIndex((col, i) => !exclude.includes(i) && col.includes(hint));
      if (idx !== -1) return idx;
    }
    return -1;
  };
  const campaign = pick("campaign");
  const spend = pick("spend");
  const date = pick("date");
  const code = pick("code", [campaign, spend, date]);
  return { campaign, spend, date, code };
}

/**
 * Relaciona un texto de campaña con una carrera: primero por alias
 * guardado, luego por código exacto y por último buscando el código
 * como palabra dentro del nombre (gana el código más largo).
 */
export function matchCareer(
  text: string,
  careers: Pick<Career, "id" | "code">[],
  aliases: Record<string, number>
): number | null {
  const key = normalizeText(text);
  if (!key) return null;
  if (aliases[key] !== undefined) return aliases[key];

  const tokens = new Set(key.split(/[^a-z0-9]+/).filter(Boolean));
  let best: { id: number; len: number } | null = null;
  for (const c of careers) {
    const code = normalizeText(c.code);
    if (!code) continue;
    if (code === key) return c.id;
    if (tokens.has(code) && (!best || code.length > best.len)) {
      best = { id: c.id, len: code.length };
    }
  }
  return best?.id ?? null;
}

export function aliasKey(text: string): string {
  return normalizeText(text);
}
