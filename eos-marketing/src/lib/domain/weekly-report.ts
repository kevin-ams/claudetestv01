import "server-only";
import { db } from "@/lib/db";
import { escapeHtml } from "@/lib/email";
import { addDaysISO, currentQuarter, formatShortDate, formatWeekRange, shiftWeek } from "@/lib/utils/dates";
import { parseISO } from "date-fns";
import { listCoverages, listKeyDates, listPieces } from "./editorial";
import { listCareers, listWeekly, weeklyGoals } from "./careers";
import { budgetTone, careerLabel, costPerLead, leadsTone, mergeWeekly, money, num, pct, totalsFor, type Tone } from "./careers-shared";
import { meetingRecap } from "./meeting-recap";
import { listMilestonesForRocks, listRocks } from "./rocks";
import { listEntries, listMetrics, listOwners, listTargets } from "./scorecard";
import { buildScorecardGrid, formatValue, getCell, statusFor, targetFor } from "./scorecard-shared";
import { getTeam } from "./teams";
import { listTeamMembers } from "./users";
import { REPORT_SECTIONS, type ReportSection } from "./weekly-report-shared";

// --- Piezas HTML para correo (tablas y estilos en línea) ------------------------

const FONT = "font-family:Arial,Helvetica,sans-serif;";
const TONE_COLOR: Record<Tone, { fg: string; bg: string }> = {
  green: { fg: "#166534", bg: "#dcfce7" },
  yellow: { fg: "#854d0e", bg: "#fef9c3" },
  red: { fg: "#991b1b", bg: "#fee2e2" },
  none: { fg: "#4b5563", bg: "#f3f4f6" },
};

const e = (v: unknown) => escapeHtml(String(v ?? ""));

function badge(text: string, tone: Tone) {
  const c = TONE_COLOR[tone];
  return `<span style="${FONT}display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;line-height:16px;color:${c.fg};background-color:${c.bg};white-space:nowrap">${e(text)}</span>`;
}

/** Celdas ya escapadas (pueden traer HTML de `badge`). */
function table(headers: string[], rows: string[][], align: ("left" | "right")[] = []) {
  if (rows.length === 0) return "";
  const th = headers
    .map((h, i) => `<th align="${align[i] ?? "left"}" style="${FONT}font-size:12px;line-height:16px;color:#6b7280;font-weight:bold;padding:6px 8px;border-bottom:1px solid #e5e7eb">${e(h)}</th>`)
    .join("");
  const body = rows
    .map(
      (r) =>
        `<tr>${r
          .map((c, i) => `<td align="${align[i] ?? "left"}" valign="top" style="${FONT}font-size:13px;line-height:18px;color:#1f2937;padding:6px 8px;border-bottom:1px solid #f3f4f6">${c}</td>`)
          .join("")}</tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:8px"><tr>${th}</tr>${body}</table>`;
}

function stats(items: [string, string][]) {
  const cells = items
    .map(
      ([label, value]) =>
        `<td valign="top" style="padding:8px 10px;background-color:#f9fafb;border-radius:8px"><div style="${FONT}font-size:11px;line-height:14px;color:#6b7280;text-transform:uppercase">${e(label)}</div><div style="${FONT}font-size:18px;line-height:24px;color:#111827;font-weight:bold">${value}</div></td><td width="8"></td>`
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px"><tr>${cells}</tr></table>`;
}

const note = (text: string) => `<p style="${FONT}margin:8px 0 0;font-size:13px;line-height:20px;color:#6b7280">${text}</p>`;
const sub = (text: string) => `<h3 style="${FONT}margin:16px 0 0;font-size:14px;line-height:20px;color:#374151">${e(text)}</h3>`;

function section(title: string, body: string) {
  return `<tr><td style="padding-top:24px"><h2 style="${FONT}margin:0;padding-bottom:6px;border-bottom:2px solid #e5e7eb;font-size:17px;line-height:24px;color:#111827">${e(title)}</h2>${body}</td></tr>`;
}

// --- Datos de cada sección -----------------------------------------------------

type Ctx = { teamId: number; week: string; end: string; nameOf: (id: number | null) => string };

async function calendarioSection(c: Ctx) {
  const [pieces, dates] = await Promise.all([listPieces(c.teamId, c.week, c.week), listKeyDates(c.teamId, c.week, c.end)]);
  const main = pieces.filter((p) => !p.is_buffer);
  const buffer = pieces.filter((p) => p.is_buffer);
  const byStatus = new Map<string, number>();
  for (const p of main) byStatus.set(p.status || "Sin estado", (byStatus.get(p.status || "Sin estado") ?? 0) + 1);
  const tone = (s: string): Tone => (/publicad|realizad|listo|aprobad/i.test(s) ? "green" : /cancel|reprogram/i.test(s) ? "red" : "none");
  const row = (p: (typeof pieces)[number]) => [
    p.pub_date ? e(formatShortDate(p.pub_date)) : "—",
    `${e(p.title)}${p.carrera ? `<br><span style="color:#6b7280;font-size:12px">${e(p.carrera)}</span>` : ""}`,
    e(p.pilar || "—"),
    e(c.nameOf(p.assignee_id)),
    badge(p.status || "Sin estado", tone(p.status)),
  ];
  if (pieces.length === 0 && dates.length === 0) return note("No hay piezas ni fechas clave registradas para esta semana.");
  return [
    stats([["Piezas", String(main.length)], ...[...byStatus].slice(0, 4).map(([s, n]) => [s, String(n)] as [string, string])]),
    table(["Fecha", "Pieza", "Pilar", "Responsable", "Estado"], main.map(row)),
    buffer.length ? sub(`Piezas de respaldo (${buffer.length})`) + table(["Fecha", "Pieza", "Pilar", "Responsable", "Estado"], buffer.map(row)) : "",
    dates.length
      ? sub("Fechas clave") + table(["Fecha", "Fecha clave", "Facultad / carrera"], dates.map((d) => [e(formatShortDate(d.date)), e(d.title), e([d.facultad, d.carrera].filter(Boolean).join(" · ") || "—")]))
      : "",
  ].join("");
}

async function coberturasSection(c: Ctx) {
  const list = (await listCoverages(c.teamId, c.week, c.end)).reverse();
  if (list.length === 0) return note("No hay coberturas registradas para esta semana.");
  const done = list.filter((x) => /realizad/i.test(x.status));
  const hours = list.reduce((a, x) => a + (x.real_hours ?? 0), 0);
  const overtime = list.reduce((a, x) => a + (x.overtime_hours ?? 0), 0);
  const tone = (s: string): Tone => (/realizad/i.test(s) ? "green" : /cancel/i.test(s) ? "red" : "none");
  return (
    stats([
      ["Coberturas", String(list.length)],
      ["Realizadas", String(done.length)],
      ["Horas reales", num(hours)],
      ["Horas extra", num(overtime)],
    ]) +
    table(
      ["Fecha", "Cobertura", "Facultad", "Responsable", "Estado", "Horas"],
      list.map((x) => [
        x.date ? `${e(formatShortDate(x.date))}${x.start_time ? `<br><span style="color:#6b7280;font-size:12px">${e(x.start_time.slice(0, 5))}${x.end_time ? `–${e(x.end_time.slice(0, 5))}` : ""}</span>` : ""}` : "—",
        `${e(x.title)}${x.tipo ? `<br><span style="color:#6b7280;font-size:12px">${e(x.tipo)}</span>` : ""}`,
        e(x.facultad || "—"),
        e(c.nameOf(x.assignee_id)),
        badge(x.status || "Sin estado", tone(x.status)),
        x.real_hours !== null ? num(x.real_hours) : "—",
      ]),
      ["left", "left", "left", "left", "left", "right"]
    )
  );
}

async function scorecardSection(c: Ctx) {
  const [metrics, owners, targets, entries] = await Promise.all([
    listMetrics(c.teamId),
    listOwners(c.teamId),
    listTargets(c.teamId),
    listEntries(c.teamId, [c.week]),
  ]);
  if (metrics.length === 0) return note("El equipo no tiene indicadores en el Scorecard.");
  const grid = buildScorecardGrid(metrics, owners, targets, entries, [c.week]);
  const rows: { cells: string[]; status: string }[] = [];
  for (const m of metrics) {
    for (const o of owners) {
      const v = getCell(grid, m.id, o.id, c.week);
      const t = targetFor(targets, m.id, o.id);
      if (v === null && t === null) continue;
      const s = statusFor(v, t, m.direction);
      rows.push({
        status: s,
        cells: [
          e(m.name),
          e(o.name),
          formatValue(v, m.format),
          t === null ? "—" : `${m.direction === "lower_better" ? "≤ " : "≥ "}${e(formatValue(t, m.format))}`,
          s === "green" ? badge("En meta", "green") : s === "red" ? badge("Fuera de meta", "red") : badge("Sin dato", "none"),
        ],
      });
    }
  }
  if (rows.length === 0) return note("No hay datos ni metas del Scorecard para esta semana.");
  const off = rows.filter((r) => r.status === "red").length;
  const ok = rows.filter((r) => r.status === "green").length;
  const empty = rows.filter((r) => r.status === "empty").length;
  return (
    stats([
      ["En meta", String(ok)],
      ["Fuera de meta", String(off)],
      ["Sin dato", String(empty)],
    ]) + table(["Indicador", "Responsable", "Valor", "Meta", "Estado"], rows.map((r) => r.cells), ["left", "left", "right", "right", "left"])
  );
}

async function l10Section(c: Ctx) {
  const rows = (await db().sql`
    SELECT id FROM meetings
    WHERE team_id = ${c.teamId}
      AND COALESCE(started_at, created_at) >= ${c.week}::date
      AND COALESCE(started_at, created_at) < ${addDaysISO(c.week, 7)}::date
    ORDER BY (status = 'completed') DESC, COALESCE(started_at, created_at) DESC
    LIMIT 1
  `) as { id: number }[];
  if (!rows[0]) return note("No hubo reunión L10 registrada esta semana.");
  const r = await meetingRecap(rows[0].id, c.teamId);
  if (!r) return note("No hubo reunión L10 registrada esta semana.");
  const date = (r.meeting.started_at ?? r.meeting.created_at).slice(0, 10);
  const present = r.attendance.filter((a) => a.present).length;
  const list = (items: string[]) =>
    items.length ? `<ul style="${FONT}margin:6px 0 0;padding-left:18px;font-size:13px;line-height:20px;color:#1f2937">${items.map((i) => `<li>${i}</li>`).join("")}</ul>` : note("Ninguno.");
  return [
    note(
      `Reunión #${r.meeting.id} · ${e(formatShortDate(date))}${r.leaderName ? ` · dirigió ${e(r.leaderName)}` : ""}${r.meeting.status === "completed" ? "" : " · <b>sin concluir</b>"}`
    ),
    stats([
      ["Calificación", r.average !== null ? `${r.average.toFixed(1)}/10` : "—"],
      ["Asistencia", r.attendance.length ? `${present}/${r.attendance.length}` : "—"],
      ["Duración", r.durationMinutes !== null ? `${r.durationMinutes} min` : "—"],
      ["Issues resueltos", String(r.issues.solved.length)],
    ]),
    sub(`To-Dos nuevos (${r.todos.created.length})`),
    list(r.todos.created.map((t) => `${e(t.title)} <span style="color:#6b7280">· ${e(r.ownerName(t.owner_id))}${t.due_date ? ` · vence ${e(formatShortDate(t.due_date.slice(0, 10)))}` : ""}</span>`)),
    sub(`To-Dos completados (${r.todos.completed.length} de ${r.todos.pending.length} pendientes)`),
    list(r.todos.completed.map((t) => `${e(t.title)} <span style="color:#6b7280">· ${e(r.ownerName(t.owner_id))}</span>`)),
    sub(`Issues resueltos (${r.issues.solved.length})`),
    list(r.issues.solved.map((i) => `${e(i.title)} <span style="color:#6b7280">· ${e(r.ownerName(i.owner_id))}</span>`)),
    r.headlines.length ? sub(`Titulares (${r.headlines.length})`) + list(r.headlines.map((h) => e(h.content))) : "",
    r.scorecard.offTrack.length
      ? sub(`Indicadores fuera de meta revisados (${r.scorecard.offTrack.length})`) +
        list(r.scorecard.offTrack.map((o) => `${e(o.metric)} <span style="color:#6b7280">· ${e(o.owner)} · ${e(o.value)} (meta ${e(o.target)})</span>`))
      : "",
    note(`Issues abiertos al cierre: <b>${r.issues.stillOpen}</b>.`),
  ].join("");
}

async function eventosSection(c: Ctx) {
  const rows = (await db().sql`
    SELECT e.title, e.detail, to_char(e.event_date, 'YYYY-MM-DD') AS event_date,
      to_char(e.week_from, 'YYYY-MM-DD') AS week_from, ft.name AS from_team, u.name AS author
    FROM l10_events e
    LEFT JOIN teams ft ON ft.id = e.from_team_id
    LEFT JOIN users u ON u.id = e.created_by
    WHERE e.team_id = ${c.teamId}
      AND (e.event_date >= ${c.week}::date OR (e.event_date IS NULL AND e.meeting_id IS NULL))
    ORDER BY e.event_date ASC NULLS LAST, e.id ASC
    LIMIT 40
  `) as { title: string; detail: string; event_date: string | null; week_from: string | null; from_team: string | null; author: string | null }[];
  if (rows.length === 0) return note("No hay eventos próximos.");
  return table(
    ["Fecha", "Evento", "De"],
    rows.map((r) => [
      r.event_date ? e(formatShortDate(r.event_date)) : "Sin fecha",
      `<b>${e(r.title)}</b>${r.detail ? `<br><span style="color:#4b5563;font-size:12px">${e(r.detail.length > 280 ? `${r.detail.slice(0, 280)}…` : r.detail)}</span>` : ""}`,
      e(r.from_team ?? r.author ?? "—"),
    ])
  );
}

async function indicadoresSection(c: Ctx) {
  const [careers, weekly, goals] = await Promise.all([listCareers(c.teamId), listWeekly(c.teamId, c.week), weeklyGoals(c.teamId, c.week)]);
  if (careers.length === 0) return note("El equipo no tiene carreras registradas.");
  const rows = mergeWeekly(careers, weekly, goals);
  const t = totalsFor(rows);
  const groups = [...new Set(rows.map((r) => r.owner_id ?? 0))]
    .map((id) => ({ id, name: c.nameOf(id || null), rows: rows.filter((r) => (r.owner_id ?? 0) === id) }))
    .sort((a, b) => Number(a.id === 0) - Number(b.id === 0) || a.name.localeCompare(b.name, "es"));
  const below = rows
    .filter((r) => t.hasLeads && r.leads_goal > 0 && leadsTone(r.leads ?? 0, r.leads_goal) === "red")
    .sort((a, b) => (a.leads ?? 0) / a.leads_goal - (b.leads ?? 0) / b.leads_goal)
    .slice(0, 15);
  return [
    stats([
      ["Leads", `${t.hasLeads ? num(t.leads) : "—"} <span style="font-size:12px;color:#6b7280;font-weight:normal">/ ${num(t.leadsGoal)}</span>`],
      ["Cumplimiento", pct(t.hasLeads ? t.leads : null, t.leadsGoal)],
      ["Consumo", `${t.hasSpent ? money(t.spent) : "—"} <span style="font-size:12px;color:#6b7280;font-weight:normal">/ ${money(t.budgetGoal)}</span>`],
      ["Costo por lead", costPerLead(t.hasSpent ? t.spent : null, t.hasLeads ? t.leads : null)],
    ]),
    sub("Por persona"),
    table(
      ["Responsable", "Carreras", "Leads / meta", "Consumo / presupuesto", "Bajo meta"],
      groups.map((g) => {
        const gt = totalsFor(g.rows);
        return [
          e(g.name),
          String(g.rows.length),
          `${t.hasLeads ? num(gt.leads) : "—"} / ${num(gt.leadsGoal)} ${badge(pct(t.hasLeads ? gt.leads : null, gt.leadsGoal), t.hasLeads ? leadsTone(gt.leads, gt.leadsGoal) : "none")}`,
          `${t.hasSpent ? money(gt.spent) : "—"} / ${money(gt.budgetGoal)} ${badge(pct(t.hasSpent ? gt.spent : null, gt.budgetGoal), t.hasSpent ? budgetTone(gt.spent, gt.budgetGoal) : "none")}`,
          gt.leadsRed ? badge(String(gt.leadsRed), "red") : "0",
        ];
      }),
      ["left", "right", "right", "right", "right"]
    ),
    below.length
      ? sub(`Carreras más lejos de su meta de leads${t.leadsRed > below.length ? ` (${below.length} de ${t.leadsRed})` : ""}`) +
        table(
          ["Carrera", "Responsable", "Leads / meta", "Consumo"],
          below.map((r) => [
            e(careerLabel(r)),
            e(c.nameOf(r.owner_id)),
            `${num(r.leads ?? 0)} / ${num(r.leads_goal)} ${badge(pct(r.leads ?? 0, r.leads_goal), "red")}`,
            money(r.budget_spent),
          ]),
          ["left", "left", "right", "right"]
        )
      : "",
    t.hasLeads ? "" : note("Todavía no hay leads cargados para esta semana."),
  ].join("");
}

const ROCK_STATUS: Record<string, [string, Tone]> = {
  done: ["Completado", "green"],
  on_track: ["En camino", "green"],
  off_track: ["En riesgo", "red"],
};

async function rocksSection(c: Ctx) {
  const { quarter, year } = currentQuarter(parseISO(c.week));
  const rocks = await listRocks(c.teamId, quarter, year);
  if (rocks.length === 0) return note(`No hay Rocks registrados para Q${quarter} ${year}.`);
  const milestones = await listMilestonesForRocks(rocks.map((r) => r.id));
  const counts = { done: 0, on_track: 0, off_track: 0 };
  for (const r of rocks) counts[r.status]++;
  return (
    note(`Trimestre Q${quarter} ${year}, al cierre de la semana (${e(formatShortDate(c.end))}).`) +
    stats([
      ["Rocks", String(rocks.length)],
      ["Completados", String(counts.done)],
      ["En camino", String(counts.on_track)],
      ["En riesgo", String(counts.off_track)],
    ]) +
    table(
      ["Rock", "Responsable", "Hitos", "Estado"],
      rocks.map((r) => {
        const ms = milestones.filter((m) => m.rock_id === r.id);
        const done = ms.filter((m) => m.done).length;
        const late = ms.filter((m) => !m.done && m.due_date && m.due_date.slice(0, 10) <= c.end).length;
        const [label, tone] = ROCK_STATUS[r.status] ?? ["—", "none"];
        return [
          `${e(r.title)}${r.is_company_rock ? ` <span style="color:#6b7280;font-size:12px">(empresa)</span>` : ""}${r.due_date ? `<br><span style="color:#6b7280;font-size:12px">Vence ${e(formatShortDate(r.due_date.slice(0, 10)))}</span>` : ""}`,
          e(c.nameOf(r.owner_id)),
          ms.length ? `${done}/${ms.length}${late ? `<br>${badge(`${late} atrasado${late === 1 ? "" : "s"}`, "red")}` : ""}` : "—",
          badge(label, tone),
        ];
      }),
      ["left", "left", "right", "left"]
    )
  );
}

const BUILDERS: Record<ReportSection, (c: Ctx) => Promise<string>> = {
  calendario: calendarioSection,
  coberturas: coberturasSection,
  scorecard: scorecardSection,
  l10: l10Section,
  eventos: eventosSection,
  indicadores: indicadoresSection,
  rocks: rocksSection,
};

/** HTML (para correo y vista previa) del reporte de la semana con las secciones elegidas. */
export async function buildWeeklyReport(input: {
  teamId: number;
  week: string;
  sections: ReportSection[];
  author: string;
  appUrl: string;
  message?: string;
}): Promise<{ html: string; subject: string; teamName: string }> {
  const week = shiftWeek(input.week, 0);
  const [team, members] = await Promise.all([getTeam(input.teamId), listTeamMembers(input.teamId)]);
  const ctx: Ctx = {
    teamId: input.teamId,
    week,
    end: addDaysISO(week, 6),
    nameOf: (id) => members.find((m) => m.id === id)?.name ?? "Sin responsable",
  };
  const parts = await Promise.all(
    REPORT_SECTIONS.filter((s) => input.sections.includes(s.key)).map(async (s) => {
      try {
        return section(s.label, await BUILDERS[s.key](ctx));
      } catch (err) {
        console.error("[reporte semanal]", s.key, err);
        return section(s.label, note("No se pudo armar esta sección."));
      }
    })
  );
  const teamName = team?.name ?? "Equipo";
  const range = formatWeekRange(week);
  const color = /^#[0-9a-f]{6}$/i.test(team?.theme_color ?? "") ? team!.theme_color : "#234c6a";
  const message = input.message?.trim()
    ? `<p style="${FONT}margin:12px 0 0;padding:10px 12px;background-color:#f9fafb;border-left:3px solid ${color};font-size:14px;line-height:21px;color:#374151;white-space:pre-line">${e(input.message.trim())}</p>`
    : "";
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Reporte semanal</title></head>
<body style="margin:0;padding:0;background-color:#f3f4f6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f4f6" style="background-color:#f3f4f6"><tr><td align="center" style="padding:24px 8px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:720px;background-color:#ffffff;border-radius:12px">
<tr><td bgcolor="${color}" style="background-color:${color};border-top-left-radius:12px;border-top-right-radius:12px;padding:18px 24px;${FONT}font-size:14px;line-height:20px;color:#ffffff;font-weight:bold">EOS Nivel 10 · ${e(teamName)}</td></tr>
<tr><td style="padding:24px">
<h1 style="${FONT}margin:0;font-size:22px;line-height:28px;color:#111827">Reporte semanal</h1>
<p style="${FONT}margin:4px 0 0;font-size:15px;line-height:22px;color:#374151">Semana del <b>${e(range)}</b> · enviado por ${e(input.author)}</p>
${message}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${parts.join("") || section("Sin secciones", note("No se eligió ninguna sección."))}</table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px"><tr><td bgcolor="${color}" style="background-color:${color};border-radius:8px"><a href="${e(`${input.appUrl}/reportes-semanales?semana=${week}`)}" style="display:inline-block;padding:11px 20px;${FONT}font-size:14px;line-height:20px;color:#ffffff;text-decoration:none;font-weight:bold">Abrir EOS Nivel 10</a></td></tr></table>
</td></tr>
<tr><td style="padding:14px 24px 18px;border-top:1px solid #e5e7eb;${FONT}font-size:12px;line-height:18px;color:#9ca3af">Reporte generado con EOS Nivel 10 (Reportes semanales).</td></tr>
</table></td></tr></table></body></html>`;
  return { html, subject: `Reporte semanal · ${teamName} · ${range}`, teamName };
}

export async function setWeeklyReportPrefs(teamId: number, recipients: string, sections: ReportSection[]) {
  await db().sql`
    UPDATE teams SET weekly_report_recipients = ${recipients}, weekly_report_sections = ${sections.join(",")} WHERE id = ${teamId}
  `;
}
