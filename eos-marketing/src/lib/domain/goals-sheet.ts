import "server-only";
import ExcelJS from "exceljs";
import { db } from "@/lib/db";
import { listAliases, listCareers, listMonthlyGoals, saveAlias } from "./careers";
import { careerLabel, matchCareer, matchCareerByName, normalizeText } from "./careers-shared";
import { cellText, sheetExportUrl } from "./editorial-sheet";
import type { GoalHistory, GoalImportPart, GoalImportPreview, GoalImportRow } from "./goals-shared";

/**
 * Importación manual (a pedido) de metas y presupuesto por carrera desde Google Sheets.
 * Pestaña de metas: columnas "Codigo · Carrera · Meta del ciclo · Faltaban al inicio del mes · OCT · NOV · DIC · ENE 27…".
 * Pestaña de presupuesto: "Codigo · Carrera · Presupuesto del ciclo · Presupuesto al inicio del mes · OCT…".
 * El histórico (lo que ya se tenía antes del primer mes) = ciclo − lo que faltaba al inicio del mes.
 */

const MONTHS: Record<string, number> = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12 };
// "OCT", "Octubre", "ENE 27", "ene. 2027"…
const MONTH_HEADER =
  /^(ene|enero|feb|febrero|mar|marzo|abr|abril|may|mayo|jun|junio|jul|julio|ago|agosto|sep|sept|septiembre|set|setiembre|oct|octubre|nov|noviembre|dic|diciembre)\.?(?:\s+(?:de\s+)?(\d{2}|\d{4}))?$/;
const norm = (v: string) => normalizeText(v).replace(/\s+/g, " ");

function toNumber(v: ExcelJS.CellValue): number | null {
  if (typeof v === "number") return v;
  const text = cellText(v).trim();
  if (!text) return null;
  // "1.234,56" o "1234,56" o "1234.56"
  const n = Number(text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text);
  return Number.isFinite(n) ? n : null;
}

type SheetRow = { code: string; name: string; cycle: number; start: number | null; months: Record<string, number> };
type SheetTab = { months: string[]; rows: SheetRow[] };

/** Lee una pestaña si tiene la columna `cycleHeader` ("meta del ciclo" / "presupuesto del ciclo"). */
function readTab(ws: ExcelJS.Worksheet, cycleHeader: string, startHeader: string, baseYear: number): SheetTab | null {
  let headerRow = 0;
  const col: { code?: number; name?: number; cycle?: number; start?: number } = {};
  const monthCols: { col: number; month: string }[] = [];
  ws.eachRow((row, n) => {
    if (headerRow) return;
    const cells = (row.values as ExcelJS.CellValue[]).map((v) => norm(cellText(v)));
    if (!cells.some((c) => c.startsWith(cycleHeader))) return;
    headerRow = n;
    let year = baseYear;
    let prev = 0;
    cells.forEach((c, i) => {
      if (!c) return;
      if (c === "codigo" || c === "código") col.code = i;
      else if (c === "carrera") col.name = i;
      else if (c.startsWith(cycleHeader)) col.cycle = i;
      else if (c.startsWith(startHeader)) col.start = i;
      else {
        const m = c.match(MONTH_HEADER);
        if (m) {
          const mm = MONTHS[m[1].slice(0, 3)];
          if (m[2]) year = m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2]);
          else if (prev && mm < prev) year += 1; // dic → ene sin año: año siguiente
          prev = mm;
          monthCols.push({ col: i, month: `${year}-${String(mm).padStart(2, "0")}-01` });
        }
      }
    });
  });
  if (!headerRow || col.code === undefined || col.cycle === undefined || monthCols.length === 0) return null;

  const rows: SheetRow[] = [];
  ws.eachRow((row, n) => {
    if (n <= headerRow) return;
    const v = row.values as ExcelJS.CellValue[];
    const code = cellText(v[col.code!]).trim();
    const cycle = toNumber(v[col.cycle!]);
    // Filas vacías y la fila "TOTAL" (sin código) no son carreras.
    if (!code || cycle === null || norm(code) === "total") return;
    const months: Record<string, number> = {};
    for (const mc of monthCols) months[mc.month] = toNumber(v[mc.col]) ?? 0;
    rows.push({
      code,
      name: col.name !== undefined ? cellText(v[col.name]).trim() : "",
      cycle,
      start: col.start !== undefined ? toNumber(v[col.start]) : null,
      months,
    });
  });
  return { months: monthCols.map((m) => m.month), rows };
}

/** "Datos al | 2026-10-25" en el encabezado: fecha de corte (para el año de los meses sin año). */
function dataDateOf(wb: ExcelJS.Workbook): string | null {
  for (const ws of wb.worksheets) {
    let found: string | null = null;
    ws.eachRow((row) => {
      if (found) return;
      const vals = row.values as ExcelJS.CellValue[];
      vals.forEach((v, i) => {
        if (!found && norm(cellText(v)).startsWith("datos al")) {
          const next = cellText(vals[i + 1]).trim();
          if (/^\d{4}-\d{2}-\d{2}/.test(next)) found = next.slice(0, 10);
        }
      });
    });
    if (found) return found;
  }
  return null;
}

async function loadWorkbook(url: string) {
  const exportUrl = sheetExportUrl(url);
  if (!exportUrl) throw new Error("Pega el enlace de Google Sheets (compartido como público o publicado en la Web).");
  const res = await fetch(exportUrl, { redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(20000) });
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || type.includes("text/html")) {
    throw new Error("No se pudo descargar la hoja. Revisa que cualquiera con el enlace pueda verla (o que esté publicada en la Web).");
  }
  const buf = await res.arrayBuffer();
  if (buf.byteLength > 15 * 1024 * 1024) throw new Error("La hoja es demasiado grande.");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb;
}

type Parsed = { dataDate: string | null; leads: SheetTab | null; budget: SheetTab | null };

async function readGoalsSheet(url: string): Promise<Parsed> {
  const wb = await loadWorkbook(url);
  const dataDate = dataDateOf(wb);
  const baseYear = dataDate ? Number(dataDate.slice(0, 4)) : new Date().getFullYear();
  let leads: SheetTab | null = null;
  let budget: SheetTab | null = null;
  for (const ws of wb.worksheets) {
    leads ??= readTab(ws, "meta del ciclo", "faltaban", baseYear);
    budget ??= readTab(ws, "presupuesto del ciclo", "presupuesto al inicio", baseYear);
  }
  if (!leads && !budget) {
    throw new Error("No encontré las pestañas de metas o presupuesto (columnas “Meta del ciclo” / “Presupuesto del ciclo” y los meses).");
  }
  return { dataDate, leads, budget };
}

const round = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;

function part(row: SheetRow, decimals: number): GoalImportPart {
  const monthsSum = Object.values(row.months).reduce((a, b) => a + b, 0);
  // Lo que ya se tenía = ciclo − lo que faltaba al inicio del primer mes (si falta ese dato: ciclo − meses).
  const hist = round(Math.max(0, row.cycle - (row.start ?? monthsSum)), decimals);
  return { cycle: row.cycle, hist, months: row.months, total: round(hist + monthsSum, decimals) };
}

/** Vista previa: lo que se cargaría y con qué carrera de la app se cruza cada código. */
export async function previewGoalsImport(teamId: number, url: string, mapping: Record<string, number> = {}): Promise<GoalImportPreview> {
  const sheet = await readGoalsSheet(url);
  const [careers, aliases] = await Promise.all([listCareers(teamId), listAliases(teamId)]);
  const months = [...new Set([...(sheet.leads?.months ?? []), ...(sheet.budget?.months ?? [])])].sort();
  const fromMonth = months[0];
  const year = Number(fromMonth.slice(0, 4));

  const byCode = new Map<string, GoalImportRow>();
  const add = (r: SheetRow, kind: "leads" | "budget") => {
    const key = r.code.toUpperCase();
    let row = byCode.get(key);
    if (!row) {
      // Orden: asignación manual → código exacto → alias guardado → código dentro del texto → nombre exacto.
      const manual = mapping[key] && careers.some((c) => c.id === mapping[key]) ? mapping[key] : null;
      const exact = careers.find((c) => c.code && c.code.toUpperCase() === key)?.id ?? null;
      const alias = aliases[normalizeText(r.code)] ?? null;
      const token = matchCareer(r.code, careers, {});
      const byName = matchCareerByName(r.name, careers);
      const [careerId, match]: [number | null, GoalImportRow["match"]] = manual
        ? [manual, "manual"]
        : exact
          ? [exact, "code"]
          : alias
            ? [alias, "alias"]
            : token
              ? [token, "code"]
              : byName
                ? [byName, "name"]
                : [null, null];
      row = {
        code: r.code,
        name: r.name,
        careerId,
        match,
        leads: null,
        budget: null,
        warnings: [],
      };
      byCode.set(key, row);
    }
    const p = part(r, kind === "leads" ? 1 : 2);
    row[kind] = p;
    const monthsSum = Object.values(r.months).reduce((a, b) => a + b, 0);
    if (r.start !== null && Math.abs(monthsSum - r.start) > (kind === "leads" ? 5 : 1)) {
      row.warnings.push(
        kind === "leads"
          ? `Los meses suman ${round(monthsSum, 1)} y faltaban ${round(r.start, 1)}: el total no cuadra con la meta del ciclo.`
          : `Los meses suman ${round(monthsSum, 2)} y quedaban ${round(r.start, 2)} al inicio del mes: el total no cuadra con el presupuesto del ciclo.`
      );
    }
  };
  for (const r of sheet.leads?.rows ?? []) add(r, "leads");
  for (const r of sheet.budget?.rows ?? []) add(r, "budget");
  const rows = [...byCode.values()];

  // Metas ya cargadas en meses del año anteriores al primer mes: quedarían sumadas además del histórico.
  const earlierMonths = Array.from({ length: Number(fromMonth.slice(5, 7)) - 1 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}-01`);
  const existing = earlierMonths.length ? await listMonthlyGoals(teamId, earlierMonths) : [];
  const matched = new Set(rows.map((r) => r.careerId).filter((id): id is number => id !== null));
  const earlier = new Map<number, string[]>();
  for (const g of existing) {
    if (!matched.has(g.career_id) || (!Number(g.leads_goal) && !Number(g.budget_goal))) continue;
    earlier.set(g.career_id, [...(earlier.get(g.career_id) ?? []), String(g.month).slice(0, 7)]);
  }

  return {
    year,
    months,
    fromMonth,
    dataDate: sheet.dataDate,
    hasLeads: Boolean(sheet.leads),
    hasBudget: Boolean(sheet.budget),
    rows,
    earlierGoals: [...earlier].map(([careerId, ms]) => {
      const c = careers.find((x) => x.id === careerId);
      return { careerId, label: c ? careerLabel(c) : String(careerId), months: ms.sort() };
    }),
  };
}

/** Aplica la importación: metas mensuales y histórico de las carreras con match. Guarda las asignaciones manuales. */
export async function applyGoalsImport(input: {
  teamId: number;
  userId: number;
  url: string;
  mapping: Record<string, number>;
  leads: boolean;
  budget: boolean;
}): Promise<{ careers: number; skipped: string[] }> {
  const preview = await previewGoalsImport(input.teamId, input.url, input.mapping);
  for (const [code, careerId] of Object.entries(input.mapping)) {
    if (preview.rows.some((r) => r.code.toUpperCase() === code && r.careerId === careerId)) await saveAlias(input.teamId, normalizeText(code), careerId);
  }
  const skipped: string[] = [];
  let count = 0;
  const done = new Set<number>();
  for (const row of preview.rows) {
    if (!row.careerId) {
      skipped.push(row.code);
      continue;
    }
    if (done.has(row.careerId)) continue; // dos códigos asignados a la misma carrera: vale el primero
    done.add(row.careerId);
    const leads = input.leads ? row.leads : null;
    const budget = input.budget ? row.budget : null;
    if (!leads && !budget) continue;
    for (const month of preview.months) {
      const l = leads?.months[month];
      const b = budget?.months[month];
      if (l === undefined && b === undefined) continue;
      await db().sql`
        INSERT INTO career_monthly_goals (career_id, month, leads_goal, budget_goal, updated_by)
        VALUES (${row.careerId}, ${month}, ${l ?? 0}, ${b === undefined ? 0 : round(b, 2)}, ${input.userId})
        ON CONFLICT (career_id, month) DO UPDATE SET
          leads_goal = CASE WHEN ${l !== undefined} THEN EXCLUDED.leads_goal ELSE career_monthly_goals.leads_goal END,
          budget_goal = CASE WHEN ${b !== undefined} THEN EXCLUDED.budget_goal ELSE career_monthly_goals.budget_goal END,
          updated_by = ${input.userId}, updated_at = NOW()
      `;
    }
    await db().sql`
      INSERT INTO career_goal_history (career_id, year, from_month, leads, budget, cycle_leads, cycle_budget, updated_by)
      VALUES (${row.careerId}, ${preview.year}, ${preview.fromMonth}, ${leads?.hist ?? null}, ${budget?.hist ?? null},
        ${leads?.cycle ?? null}, ${budget?.cycle ?? null}, ${input.userId})
      ON CONFLICT (career_id, year) DO UPDATE SET
        from_month = EXCLUDED.from_month,
        leads = CASE WHEN ${Boolean(leads)} THEN EXCLUDED.leads ELSE career_goal_history.leads END,
        budget = CASE WHEN ${Boolean(budget)} THEN EXCLUDED.budget ELSE career_goal_history.budget END,
        cycle_leads = CASE WHEN ${Boolean(leads)} THEN EXCLUDED.cycle_leads ELSE career_goal_history.cycle_leads END,
        cycle_budget = CASE WHEN ${Boolean(budget)} THEN EXCLUDED.cycle_budget ELSE career_goal_history.cycle_budget END,
        updated_by = ${input.userId}, updated_at = NOW()
    `;
    count++;
  }
  return { careers: count, skipped };
}

// --- Histórico (lectura y edición manual) -----------------------------------------

export async function listGoalHistory(teamId: number, year: number): Promise<GoalHistory[]> {
  const rows = (await db().sql`
    SELECT h.career_id, h.year, to_char(h.from_month, 'YYYY-MM-DD') AS from_month, h.leads, h.budget, h.cycle_leads, h.cycle_budget
    FROM career_goal_history h JOIN careers c ON c.id = h.career_id
    WHERE c.team_id = ${teamId} AND h.year = ${year}
  `) as GoalHistory[];
  const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return rows.map((r) => ({ ...r, leads: n(r.leads), budget: n(r.budget), cycle_leads: n(r.cycle_leads), cycle_budget: n(r.cycle_budget) }));
}

/** Cambia a mano el histórico de leads o presupuesto (crea el registro si no existe, desde `fromMonth`). */
export async function setGoalHistory(input: { careerId: number; year: number; fromMonth: string; field: "leads" | "budget"; value: number | null; userId: number }) {
  if (input.field === "leads") {
    await db().sql`
      INSERT INTO career_goal_history (career_id, year, from_month, leads, updated_by)
      VALUES (${input.careerId}, ${input.year}, ${input.fromMonth}, ${input.value}, ${input.userId})
      ON CONFLICT (career_id, year) DO UPDATE SET leads = EXCLUDED.leads, updated_by = ${input.userId}, updated_at = NOW()
    `;
  } else {
    await db().sql`
      INSERT INTO career_goal_history (career_id, year, from_month, budget, updated_by)
      VALUES (${input.careerId}, ${input.year}, ${input.fromMonth}, ${input.value}, ${input.userId})
      ON CONFLICT (career_id, year) DO UPDATE SET budget = EXCLUDED.budget, updated_by = ${input.userId}, updated_at = NOW()
    `;
  }
}
