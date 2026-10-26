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
import { REPORT_KINDS, REPORT_SECTIONS, serializeSections, type ReportKind, type ReportSection } from "./weekly-report-shared";

// --- Piezas HTML para correo (tablas y estilos en línea) ------------------------

const FONT = "font-family:Arial,Helvetica,sans-serif;";
const TONE_COLOR: Record<Tone, { fg: string; bg: string }> = {
  green: { fg: "#166534", bg: "#dcfce7" },
  yellow: { fg: "#854d0e", bg: "#fef9c3" },
  red: { fg: "#991b1b", bg: "#fee2e2" },
  none: { fg: "#4b5563", bg: "#f3f4f6" },
};

const e = (v: unknown) => escapeHtml(String(v ?? ""));

// Estilo corto de celda: el correo debe pesar menos de ~100 KB para que Gmail no lo recorte.
// La tipografía de las celdas va en el <style> del documento y en la tabla.
const TD = "padding:6px 8px;border-bottom:1px solid #eee";

/** Nombre con su enlace (solo http/https). */
function linked(text: string, url: string | null | undefined) {
  const href = String(url ?? "").trim();
  return /^https?:\/\//i.test(href) ? `<a href="${e(href)}" target="_blank" rel="noopener" style="color:#1d4ed8;text-decoration:underline">${e(text)}</a>` : e(text);
}

function badge(text: string, tone: Tone) {
  const c = TONE_COLOR[tone];
  return `<span style="font:12px/16px Arial,sans-serif;padding:2px 7px;border-radius:9px;color:${c.fg};background:${c.bg};white-space:nowrap">${e(text)}</span>`;
}

/** Celdas ya escapadas (pueden traer HTML de `badge`). */
function table(headers: string[], rows: string[][], align: ("left" | "right")[] = []) {
  if (rows.length === 0) return "";
  const th = headers
    .map(
      (h, i) =>
        `<th${align[i] === "right" ? ' align="right"' : ' align="left"'} style="font:bold 12px/16px Arial,sans-serif;color:#6b7280;padding:6px 8px;border-bottom:1px solid #e5e7eb">${e(h)}</th>`,
    )
    .join("");
  const body = rows
    .map(
      (r) =>
        `<tr>${r
          .map(
            (c, i) =>
              `<td${align[i] === "right" ? ' align="right"' : ""} valign="top" style="${TD}">${c}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:8px;font:13px/18px Arial,sans-serif;color:#1f2937"><tr>${th}</tr>${body}</table>`;
}

function stats(items: [string, string][]) {
  const cells = items
    .map(
      ([label, value]) =>
        `<td valign="top" style="padding:8px 10px;background-color:#f9fafb;border-radius:8px"><div style="${FONT}font-size:11px;line-height:14px;color:#6b7280;text-transform:uppercase">${e(label)}</div><div style="${FONT}font-size:18px;line-height:24px;color:#111827;font-weight:bold">${value}</div></td><td width="8"></td>`,
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

type Ctx = {
  teamId: number;
  kind: ReportKind;
  week: string;
  end: string;
  nameOf: (id: number | null) => string;
};

const closing = (c: Ctx) => c.kind === "cierre";

/** "▲ 3" / "▼ 2" / "=" con color según si mejora (en dirección de la meta). */
function change(cur: number | null, prev: number | null, opts: { higherBetter?: boolean; fmt?: (n: number) => string } = {}) {
  if (cur === null || prev === null) return `<span style="color:#9ca3af">—</span>`;
  const d = Math.round((cur - prev) * 100) / 100;
  if (d === 0) return `<span style="color:#6b7280">=</span>`;
  const good = (opts.higherBetter ?? true) ? d > 0 : d < 0;
  const text = opts.fmt ? opts.fmt(Math.abs(d)) : num(Math.abs(d));
  return `<span style="color:${good ? "#166534" : "#991b1b"};white-space:nowrap">${d > 0 ? "▲" : "▼"} ${e(text)}</span>`;
}

const share = (part: number, total: number) => (total ? `${Math.round((part / total) * 100)}%` : "—");

async function calendarioSection(c: Ctx) {
  const [pieces, dates] = await Promise.all([listPieces(c.teamId, c.week, c.week), listKeyDates(c.teamId, c.week, c.end)]);
  const main = pieces.filter((p) => !p.is_buffer);
  const buffer = pieces.filter((p) => p.is_buffer);
  const byStatus = new Map<string, number>();
  for (const p of main) byStatus.set(p.status || "Sin estado", (byStatus.get(p.status || "Sin estado") ?? 0) + 1);
  const tone = (s: string): Tone => (/publicad|realizad|listo|aprobad/i.test(s) ? "green" : /cancel|reprogram/i.test(s) ? "red" : "none");
  const row = (p: (typeof pieces)[number]) => [
    p.pub_date ? e(formatShortDate(p.pub_date)) : "—",
    `${linked(p.title, p.link)}${p.carrera ? `<br><span style="color:#6b7280;font-size:12px">${e(p.carrera)}</span>` : ""}${
      p.note?.trim() ? `<br><span style="color:#4b5563;font-size:12px;font-style:italic">Nota: ${e(p.note.trim())}</span>` : ""
    }`,
    e(p.pilar || "—"),
    e(c.nameOf(p.assignee_id)),
    badge(p.status || "Sin estado", tone(p.status)),
  ];
  if (pieces.length === 0 && dates.length === 0) return note("No hay piezas ni fechas clave registradas para esta semana.");
  if (closing(c)) {
    const published = main.filter((p) => /publicad/i.test(p.status));
    const dropped = main.filter((p) => /cancel|reprogram/i.test(p.status));
    const pending = main.filter((p) => !published.includes(p) && !dropped.includes(p));
    const head = ["Fecha", "Pieza", "Pilar", "Responsable", "Estado"];
    return [
      stats([
        ["Planificadas", String(main.length)],
        ["Publicadas", `${published.length} <span style="font-size:12px;color:#6b7280;font-weight:normal">(${share(published.length, main.length)})</span>`],
        ["Pendientes", String(pending.length)],
        ["Reprogramadas / canceladas", String(dropped.length)],
      ]),
      pending.length ? sub(`Pendientes al cierre (${pending.length})`) + table(head, pending.map(row)) : note("No quedaron piezas pendientes."),
      dropped.length ? sub(`Reprogramadas o canceladas (${dropped.length})`) + table(head, dropped.map(row)) : "",
      published.length ? sub(`Publicadas (${published.length})`) + table(head, published.map(row)) : "",
    ].join("");
  }
  return [
    stats([["Piezas", String(main.length)], ...[...byStatus].slice(0, 4).map(([s, n]) => [s, String(n)] as [string, string])]),
    table(["Fecha", "Pieza", "Pilar", "Responsable", "Estado"], main.map(row)),
    buffer.length ? sub(`Piezas de respaldo (${buffer.length})`) + table(["Fecha", "Pieza", "Pilar", "Responsable", "Estado"], buffer.map(row)) : "",
    dates.length
      ? sub("Fechas clave") +
        table(
          ["Fecha", "Fecha clave", "Facultad / carrera"],
          dates.map((d) => [e(formatShortDate(d.date)), `${e(d.title)}${d.note?.trim() ? `<br><span style="color:#4b5563;font-size:12px;font-style:italic">Nota: ${e(d.note.trim())}</span>` : ""}`, e([d.facultad, d.carrera].filter(Boolean).join(" · ") || "—")]),
        )
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
  const estimated = list.reduce((a, x) => a + (Number.parseFloat(String(x.est_hours ?? "").replace(",", ".")) || 0), 0);
  return (
    stats(
      closing(c)
        ? [
            ["Programadas", String(list.length)],
            ["Realizadas", `${done.length} <span style="font-size:12px;color:#6b7280;font-weight:normal">(${share(done.length, list.length)})</span>`],
            ["Horas reales / estimadas", `${num(hours)} / ${num(estimated)}`],
            ["Horas extra", num(overtime)],
          ]
        : [
            ["Coberturas", String(list.length)],
            ["Realizadas", String(done.length)],
            ["Horas reales", num(hours)],
            ["Horas extra", num(overtime)],
          ],
    ) +
    table(
      ["Fecha", "Cobertura", "Facultad", "Responsable", "Estado", "Horas"],
      list.map((x) => [
        x.date
          ? `${e(formatShortDate(x.date))}${x.start_time ? `<br><span style="color:#6b7280;font-size:12px">${e(x.start_time.slice(0, 5))}${x.end_time ? `–${e(x.end_time.slice(0, 5))}` : ""}</span>` : ""}`
          : "—",
        `${e(x.title)}${x.tipo ? `<br><span style="color:#6b7280;font-size:12px">${e(x.tipo)}</span>` : ""}`,
        e(x.facultad || "—"),
        e(c.nameOf(x.assignee_id)),
        badge(x.status || "Sin estado", tone(x.status)),
        x.real_hours !== null ? num(x.real_hours) : "—",
      ]),
      ["left", "left", "left", "left", "left", "right"],
    )
  );
}

async function scorecardSection(c: Ctx) {
  // Planificación: resultados de la semana anterior. Fin de semana: esta semana contra la anterior.
  const prev = shiftWeek(c.week, -1);
  const week = closing(c) ? c.week : prev;
  const [metrics, owners, targets, entries] = await Promise.all([
    listMetrics(c.teamId),
    listOwners(c.teamId),
    listTargets(c.teamId),
    listEntries(c.teamId, closing(c) ? [prev, c.week] : [prev]),
  ]);
  if (metrics.length === 0) return note("El equipo no tiene indicadores en el Scorecard.");
  const grid = buildScorecardGrid(metrics, owners, targets, entries, closing(c) ? [prev, c.week] : [prev]);
  const rows: { cells: string[]; status: string }[] = [];
  for (const m of metrics) {
    for (const o of owners) {
      const v = getCell(grid, m.id, o.id, week);
      const before = closing(c) ? getCell(grid, m.id, o.id, prev) : null;
      const t = targetFor(targets, m.id, o.id);
      if (v === null && t === null && before === null) continue;
      const s = statusFor(v, t, m.direction);
      rows.push({
        status: s,
        cells: [
          e(m.name),
          e(o.name),
          formatValue(v, m.format),
          ...(closing(c)
            ? [
                formatValue(before, m.format),
                change(v, before, {
                  higherBetter: m.direction === "higher_better",
                  fmt: (n) => (m.format === "percentage" ? `${num(n)} pts` : formatValue(n, m.format)),
                }),
              ]
            : []),
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
  const head = closing(c)
    ? ["Indicador", "Responsable", "Esta semana", "Semana anterior", "Cambio", "Meta", "Estado"]
    : ["Indicador", "Responsable", "Valor", "Meta", "Estado"];
  const align: ("left" | "right")[] = closing(c) ? ["left", "left", "right", "right", "right", "right", "left"] : ["left", "left", "right", "right", "left"];
  return (
    (closing(c) ? "" : note(`Resultados de la semana anterior (<b>${e(formatWeekRange(prev))}</b>).`)) +
    stats([
      ["En meta", String(ok)],
      ["Fuera de meta", String(off)],
      ["Sin dato", String(empty)],
    ]) +
    table(
      head,
      rows.map((r) => r.cells),
      align,
    )
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
    items.length
      ? `<ul style="${FONT}margin:6px 0 0;padding-left:18px;font-size:13px;line-height:20px;color:#1f2937">${items.map((i) => `<li>${i}</li>`).join("")}</ul>`
      : note("Ninguno.");
  return [
    note(
      `Reunión #${r.meeting.id} · ${e(formatShortDate(date))}${r.leaderName ? ` · dirigió ${e(r.leaderName)}` : ""}${r.meeting.status === "completed" ? "" : " · <b>sin concluir</b>"}`,
    ),
    stats([
      ["Calificación", r.average !== null ? `${r.average.toFixed(1)}/10` : "—"],
      ["Asistencia", r.attendance.length ? `${present}/${r.attendance.length}` : "—"],
      ["Duración", r.durationMinutes !== null ? `${r.durationMinutes} min` : "—"],
      ["Issues resueltos", String(r.issues.solved.length)],
    ]),
    ...(closing(c) && r.todos.created.length
      ? [
          sub(
            `Avance de los To-Dos de la reunión: ${r.todos.created.filter((t) => t.status === "done").length} de ${r.todos.created.length} completados (${share(
              r.todos.created.filter((t) => t.status === "done").length,
              r.todos.created.length,
            )})`,
          ),
          list(
            r.todos.created.map(
              (t) =>
                `${t.status === "done" ? badge("Hecho", "green") : badge("Pendiente", "yellow")} ${e(t.title)} <span style="color:#6b7280">· ${e(r.ownerName(t.owner_id))}</span>`,
            ),
          ),
        ]
      : []),
    sub(`To-Dos nuevos (${r.todos.created.length})`),
    list(
      r.todos.created.map(
        (t) =>
          `${e(t.title)} <span style="color:#6b7280">· ${e(r.ownerName(t.owner_id))}${t.due_date ? ` · vence ${e(formatShortDate(t.due_date.slice(0, 10)))}` : ""}</span>`,
      ),
    ),
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
      AND (e.event_date >= ${closing(c) ? addDaysISO(c.week, 7) : c.week}::date OR (e.event_date IS NULL AND e.meeting_id IS NULL))
    ORDER BY e.event_date ASC NULLS LAST, e.id ASC
    LIMIT 40
  `) as {
    title: string;
    detail: string;
    event_date: string | null;
    week_from: string | null;
    from_team: string | null;
    author: string | null;
  }[];
  if (rows.length === 0) return note("No hay eventos próximos.");
  return table(
    ["Fecha", "Evento", "De"],
    rows.map((r) => [
      r.event_date ? e(formatShortDate(r.event_date)) : "Sin fecha",
      `<b>${e(r.title)}</b>${r.detail ? `<br><span style="color:#4b5563;font-size:12px">${e(r.detail.length > 280 ? `${r.detail.slice(0, 280)}…` : r.detail)}</span>` : ""}`,
      e(r.from_team ?? r.author ?? "—"),
    ]),
  );
}

async function indicadoresSection(c: Ctx) {
  const prevWeek = shiftWeek(c.week, -1);
  // Planificación: la semana en curso aún no tiene datos; se muestran los resultados de la anterior (como el Scorecard).
  const dataWeek = closing(c) ? c.week : prevWeek;
  const [careers, weekly, goals, prevWeekly, prevGoals] = await Promise.all([
    listCareers(c.teamId),
    listWeekly(c.teamId, dataWeek),
    weeklyGoals(c.teamId, dataWeek),
    closing(c) ? listWeekly(c.teamId, prevWeek) : Promise.resolve([]),
    closing(c) ? weeklyGoals(c.teamId, prevWeek) : Promise.resolve({}),
  ]);
  if (careers.length === 0) return note("El equipo no tiene carreras registradas.");
  const rows = mergeWeekly(careers, weekly, goals);
  const prevRows = mergeWeekly(careers, prevWeekly, prevGoals);
  const t = totalsFor(rows);
  const pt = totalsFor(prevRows);
  const groups = [...new Set(rows.map((r) => r.owner_id ?? 0))]
    .map((id) => ({
      id,
      name: c.nameOf(id || null),
      rows: rows.filter((r) => (r.owner_id ?? 0) === id),
    }))
    .sort((a, b) => Number(a.id === 0) - Number(b.id === 0) || a.name.localeCompare(b.name, "es"));
  const below = rows
    .filter((r) => t.hasLeads && r.leads_goal > 0 && leadsTone(r.leads ?? 0, r.leads_goal) === "red")
    .sort((a, b) => (a.leads ?? 0) / a.leads_goal - (b.leads ?? 0) / b.leads_goal)
    .slice(0, 15);
  const leadsNow = t.hasLeads ? t.leads : null;
  const leadsPrev = pt.hasLeads ? pt.leads : null;
  const byPerson = closing(c)
    ? table(
        ["Responsable", "Leads", "Anterior", "Cambio", "% meta", "Consumo", "Anterior"],
        groups.map((g) => {
          const gt = totalsFor(g.rows);
          const gp = totalsFor(prevRows.filter((r) => (r.owner_id ?? 0) === g.id));
          return [
            e(g.name),
            t.hasLeads ? num(gt.leads) : "—",
            pt.hasLeads ? num(gp.leads) : "—",
            change(t.hasLeads ? gt.leads : null, pt.hasLeads ? gp.leads : null),
            badge(pct(t.hasLeads ? gt.leads : null, gt.leadsGoal), t.hasLeads ? leadsTone(gt.leads, gt.leadsGoal) : "none"),
            t.hasSpent ? money(gt.spent) : "—",
            pt.hasSpent ? money(gp.spent) : "—",
          ];
        }),
        ["left", "right", "right", "right", "right", "right", "right"],
      )
    : table(
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
        ["left", "right", "right", "right", "right"],
      );
  return [
    stats(
      closing(c)
        ? [
            ["Leads", `${leadsNow !== null ? num(leadsNow) : "—"} <span style="font-size:12px;font-weight:normal">${change(leadsNow, leadsPrev)}</span>`],
            ["Cumplimiento", pct(leadsNow, t.leadsGoal)],
            [
              "Consumo",
              `${t.hasSpent ? money(t.spent) : "—"} <span style="font-size:12px;color:#6b7280;font-weight:normal">antes ${pt.hasSpent ? money(pt.spent) : "—"}</span>`,
            ],
            [
              "Costo por lead",
              `${costPerLead(t.hasSpent ? t.spent : null, leadsNow)} <span style="font-size:12px;color:#6b7280;font-weight:normal">antes ${costPerLead(pt.hasSpent ? pt.spent : null, leadsPrev)}</span>`,
            ],
          ]
        : [
            ["Leads", `${t.hasLeads ? num(t.leads) : "—"} <span style="font-size:12px;color:#6b7280;font-weight:normal">/ ${num(t.leadsGoal)}</span>`],
            ["Cumplimiento", pct(t.hasLeads ? t.leads : null, t.leadsGoal)],
            ["Consumo", `${t.hasSpent ? money(t.spent) : "—"} <span style="font-size:12px;color:#6b7280;font-weight:normal">/ ${money(t.budgetGoal)}</span>`],
            ["Costo por lead", costPerLead(t.hasSpent ? t.spent : null, t.hasLeads ? t.leads : null)],
          ],
    ),
    closing(c)
      ? note(`Comparado con la semana anterior (${e(formatWeekRange(prevWeek))}).`)
      : note(`Resultados de la semana anterior (<b>${e(formatWeekRange(prevWeek))}</b>).`),
    sub("Por persona"),
    byPerson,
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
          ["left", "left", "right", "right"],
        )
      : "",
    t.hasLeads ? "" : note(`Todavía no hay leads cargados para la semana del ${e(formatWeekRange(dataWeek))}.`),
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
  const dueThisWeek = milestones.filter((m) => m.due_date && m.due_date.slice(0, 10) >= c.week && m.due_date.slice(0, 10) <= c.end);
  const weekMilestones =
    closing(c) && dueThisWeek.length
      ? sub(`Hitos que vencían esta semana: ${dueThisWeek.filter((m) => m.done).length} de ${dueThisWeek.length} completados`) +
        table(
          ["Hito", "Rock", "Vence", "Estado"],
          dueThisWeek.map((m) => {
            const rock = rocks.find((r) => r.id === m.rock_id);
            return [
              e(m.title),
              `${e(rock?.title ?? "—")}<br><span style="color:#6b7280;font-size:12px">${e(c.nameOf(rock?.owner_id ?? null))}</span>`,
              e(formatShortDate(m.due_date!.slice(0, 10))),
              m.done ? badge("Completado", "green") : badge("Pendiente", "red"),
            ];
          }),
        )
      : closing(c)
        ? note("Ningún hito vencía esta semana.")
        : "";
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
      ["left", "left", "right", "left"],
    ) +
    weekMilestones
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
  kind: ReportKind;
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
    kind: input.kind,
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
    }),
  );
  const teamName = team?.name ?? "Equipo";
  const title = REPORT_KINDS.find((k) => k.id === input.kind)?.title ?? "Reporte semanal";
  const range = formatWeekRange(week);
  const color = /^#[0-9a-f]{6}$/i.test(team?.theme_color ?? "") ? team!.theme_color : "#234c6a";
  const message = input.message?.trim()
    ? `<p style="${FONT}margin:12px 0 0;padding:10px 12px;background-color:#f9fafb;border-left:3px solid ${color};font-size:14px;line-height:21px;color:#374151;white-space:pre-line">${e(input.message.trim())}</p>`
    : "";
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${e(title)}</title><style>td{font:13px/18px Arial,Helvetica,sans-serif;color:#1f2937}</style></head>
<body style="margin:0;padding:0;background-color:#f3f4f6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f4f6" style="background-color:#f3f4f6"><tr><td align="center" style="padding:24px 8px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:720px;background-color:#ffffff;border-radius:12px">
<tr><td bgcolor="${color}" style="background-color:${color};border-top-left-radius:12px;border-top-right-radius:12px;padding:18px 24px;${FONT}font-size:14px;line-height:20px;color:#ffffff;font-weight:bold">EOS Nivel 10 · ${e(teamName)}</td></tr>
<tr><td style="padding:24px">
<h1 style="${FONT}margin:0;font-size:22px;line-height:28px;color:#111827">${e(title)}</h1>
<p style="${FONT}margin:4px 0 0;font-size:15px;line-height:22px;color:#374151">Semana del <b>${e(range)}</b> · enviado por ${e(input.author)}</p>
${message}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${parts.join("") || section("Sin secciones", note("No se eligió ninguna sección."))}</table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px"><tr><td bgcolor="${color}" style="background-color:${color};border-radius:8px"><a href="${e(`${input.appUrl}/reportes-semanales?tipo=${input.kind}&semana=${week}`)}" style="display:inline-block;padding:11px 20px;${FONT}font-size:14px;line-height:20px;color:#ffffff;text-decoration:none;font-weight:bold">Abrir EOS Nivel 10</a></td></tr></table>
</td></tr>
<tr><td style="padding:14px 24px 18px;border-top:1px solid #e5e7eb;${FONT}font-size:12px;line-height:18px;color:#9ca3af">Reporte generado con EOS Nivel 10 (Reportes semanales).</td></tr>
</table></td></tr></table></body></html>`;
  return { html, subject: `${title} · ${teamName} · ${range}`, teamName };
}

export async function setWeeklyReportPrefs(teamId: number, kind: ReportKind, recipients: string, sections: ReportSection[]) {
  const rows = (await db().sql`SELECT weekly_report_sections FROM teams WHERE id = ${teamId}`) as {
    weekly_report_sections: string;
  }[];
  const saved = serializeSections(rows[0]?.weekly_report_sections ?? "", kind, sections);
  await db().sql`
    UPDATE teams SET weekly_report_recipients = ${recipients}, weekly_report_sections = ${saved} WHERE id = ${teamId}
  `;
}
