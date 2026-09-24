import "server-only";
import { listEntries, listMetrics, listOwners, listTargets } from "@/lib/domain/scorecard";
import { buildScorecardGrid, getCell, statusFor, targetFor, averageForOwner } from "@/lib/domain/scorecard-shared";
import { careerHistory, listMonthlyGoals } from "@/lib/domain/careers";
import { budgetTone, leadsTone, totalsFor, type Tone } from "@/lib/domain/careers-shared";
import { listTeamMembers } from "@/lib/domain/users";
import { FILL, newWorkbook, styleTable } from "./excel";

const toneFill = (tone: Tone) => (tone === "none" ? undefined : FILL[tone]);
const round2 = (n: number) => Math.round(n * 100) / 100;
const ratio = (value: number | null, goal: number) => (value === null || goal <= 0 ? null : value / goal);

/** Scorecard: una fila por indicador y dueño, una columna por semana. */
export async function scorecardWorkbook(teamId: number, weeks: string[]) {
  const [owners, metrics, targets, entries] = await Promise.all([
    listOwners(teamId),
    listMetrics(teamId),
    listTargets(teamId),
    listEntries(teamId, weeks),
  ]);
  const grid = buildScorecardGrid(metrics, owners, targets, entries, weeks);

  const wb = newWorkbook();
  const sheet = wb.addWorksheet("Scorecard");
  styleTable(sheet, [
    { header: "Indicador", key: "metric", width: 40 },
    { header: "Predice", key: "predicts", width: 30 },
    { header: "Dueño", key: "owner", width: 16 },
    { header: "Dirección", key: "direction", width: 14 },
    { header: "Formato", key: "format", width: 12 },
    { header: "Meta", key: "target", width: 10 },
    ...weeks.map((w) => ({ header: w, key: `w_${w}`, width: 12 })),
    { header: "Promedio", key: "avg", width: 12 },
  ]);
  for (const m of metrics) {
    for (const o of owners) {
      const target = targetFor(targets, m.id, o.id);
      const row = sheet.addRow({
        metric: m.name,
        predicts: m.predicts,
        owner: o.is_rollup ? `${o.name} (rollup)` : o.name,
        direction: m.direction === "higher_better" ? "Mayor mejor" : "Menor mejor",
        format: m.format === "percentage" ? "Porcentaje" : m.format === "currency" ? "Moneda" : "Cantidad",
        target,
        avg: averageForOwner(grid, m, o.id, weeks),
        ...Object.fromEntries(weeks.map((w) => [`w_${w}`, getCell(grid, m.id, o.id, w)])),
      });
      weeks.forEach((w, i) => {
        const status = statusFor(getCell(grid, m.id, o.id, w), target, m.direction);
        if (status !== "empty") row.getCell(7 + i).fill = FILL[status];
      });
    }
  }
  if (metrics.length === 0) sheet.addRow({ metric: "Sin indicadores configurados" });
  return wb;
}

/** Indicadores de carrera: detalle semanal, resumen por responsable y metas mensuales. */
export async function careerWorkbook(teamId: number, from: string, to: string) {
  const [history, members] = await Promise.all([careerHistory(teamId, from, to), listTeamMembers(teamId)]);
  const ownerName = (id: number | null) => members.find((m) => m.id === id)?.name ?? "Sin responsable";
  const wb = newWorkbook();

  const detail = wb.addWorksheet("Semanal");
  styleTable(detail, [
    { header: "Semana (lunes)", key: "week", width: 14 },
    { header: "Programa", key: "program", width: 14 },
    { header: "Código", key: "code", width: 10 },
    { header: "Carrera", key: "name", width: 50 },
    { header: "Nivel", key: "level", width: 12 },
    { header: "Responsable", key: "owner", width: 16 },
    { header: "Leads", key: "leads", width: 10 },
    { header: "Meta leads", key: "leadsGoal", width: 11 },
    { header: "% meta leads", key: "leadsPct", width: 12 },
    { header: "Consumo", key: "spent", width: 12 },
    { header: "Presupuesto", key: "budget", width: 12 },
    { header: "% presupuesto", key: "budgetPct", width: 13 },
    { header: "Costo por lead", key: "cpl", width: 13 },
    { header: "Origen leads", key: "leadsSource", width: 14 },
    { header: "Origen consumo", key: "budgetSource", width: 14 },
  ]);
  for (const w of history.weeks) {
    for (const r of history.byWeek[w]) {
      const row = detail.addRow({
        week: w,
        program: r.program,
        code: r.code,
        name: r.name,
        level: r.level,
        owner: ownerName(r.owner_id),
        leads: r.leads,
        leadsGoal: r.leads_goal,
        leadsPct: ratio(r.leads, r.leads_goal),
        spent: r.budget_spent,
        budget: r.budget_goal,
        budgetPct: ratio(r.budget_spent, r.budget_goal),
        cpl: r.budget_spent !== null && r.leads ? r.budget_spent / r.leads : null,
        leadsSource: r.leads_source === "activecampaign" ? "ActiveCampaign" : r.leads_source === "manual" ? "Manual" : "",
        budgetSource: r.budget_source === "csv" ? "CSV Meta" : r.budget_source === "manual" ? "Manual" : "",
      });
      const lf = toneFill(leadsTone(r.leads, r.leads_goal));
      if (lf) row.getCell("leadsPct").fill = lf;
      const bf = toneFill(budgetTone(r.budget_spent, r.budget_goal));
      if (bf) row.getCell("budgetPct").fill = bf;
    }
  }
  for (const key of ["leadsPct", "budgetPct"]) detail.getColumn(key).numFmt = "0%";
  for (const key of ["spent", "budget", "cpl"]) detail.getColumn(key).numFmt = '"Q" #,##0.00';
  detail.getColumn("leadsGoal").numFmt = "0.0";

  // Resumen del rango por responsable.
  const summary = wb.addWorksheet("Resumen por responsable");
  styleTable(summary, [
    { header: "Responsable", key: "owner", width: 18 },
    { header: "Carreras", key: "careers", width: 10 },
    { header: "Leads", key: "leads", width: 10 },
    { header: "Meta leads", key: "leadsGoal", width: 11 },
    { header: "% meta", key: "leadsPct", width: 10 },
    { header: "Consumo", key: "spent", width: 13 },
    { header: "Presupuesto", key: "budget", width: 13 },
    { header: "% presupuesto", key: "budgetPct", width: 13 },
    { header: "Costo por lead", key: "cpl", width: 13 },
  ]);
  const all = history.weeks.flatMap((w) => history.byWeek[w]);
  const ownerIds = [...new Set(history.careers.map((c) => c.owner_id))];
  for (const id of ownerIds) {
    const rows = all.filter((r) => r.owner_id === id);
    const t = totalsFor(rows);
    summary.addRow({
      owner: ownerName(id),
      careers: history.careers.filter((c) => c.owner_id === id).length,
      leads: t.leads,
      leadsGoal: round2(t.leadsGoal),
      leadsPct: ratio(t.leads, t.leadsGoal),
      spent: round2(t.spent),
      budget: round2(t.budgetGoal),
      budgetPct: ratio(t.spent, t.budgetGoal),
      cpl: t.leads ? round2(t.spent / t.leads) : null,
    });
  }
  for (const key of ["leadsPct", "budgetPct"]) summary.getColumn(key).numFmt = "0%";
  for (const key of ["spent", "budget", "cpl"]) summary.getColumn(key).numFmt = '"Q" #,##0.00';
  summary.getColumn("leadsGoal").numFmt = "0.0";

  // Metas mensuales de los meses que toca el rango.
  const months = [...new Set(history.weeks.map((w) => `${w.slice(0, 7)}-01`))];
  const goals = await listMonthlyGoals(teamId, months);
  const goalSheet = wb.addWorksheet("Metas mensuales");
  styleTable(goalSheet, [
    { header: "Programa", key: "program", width: 14 },
    { header: "Código", key: "code", width: 10 },
    { header: "Carrera", key: "name", width: 50 },
    { header: "Responsable", key: "owner", width: 16 },
    ...months.flatMap((m) => [
      { header: `Leads ${m.slice(0, 7)}`, key: `l_${m}`, width: 13 },
      { header: `Presupuesto ${m.slice(0, 7)}`, key: `b_${m}`, width: 16 },
    ]),
  ]);
  for (const c of history.careers) {
    goalSheet.addRow({
      program: c.program,
      code: c.code,
      name: c.name,
      owner: ownerName(c.owner_id),
      ...Object.fromEntries(
        months.flatMap((m) => {
          const g = goals.find((x) => x.career_id === c.id && x.month === m);
          return [
            [`l_${m}`, g?.leads_goal ?? 0],
            [`b_${m}`, g?.budget_goal ?? 0],
          ];
        })
      ),
    });
  }
  return wb;
}
