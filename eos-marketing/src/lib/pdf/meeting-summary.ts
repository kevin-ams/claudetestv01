import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import type { MeetingRecap } from "@/lib/domain/meeting-recap";
import { money, num, pct } from "@/lib/domain/careers-shared";
import { formatWeekRange } from "@/lib/utils/dates";

// Las fuentes estándar de PDF solo traen el juego WinAnsi (latín): se
// reemplazan símbolos fuera de él (flechas, emojis…) por equivalentes.
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
function clean(text: string): string {
  return text
    .replace(/→/g, "->")
    .replace(/[✓✔]/g, "OK")
    .replace(/[\u2028\u2029\t]/g, " ")
    .split("")
    .filter((c) => {
      const code = c.charCodeAt(0);
      return c === "\n" || (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WIN_ANSI_EXTRA.has(c);
    })
    .join("");
}

function hexToRgb(hex: string): RGB {
  const n = parseInt(/^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : "234c6a", 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const INK = rgb(0.09, 0.1, 0.14);
const MUTED = rgb(0.42, 0.45, 0.5);
const LINE = rgb(0.88, 0.89, 0.91);
const RED = rgb(0.75, 0.17, 0.17);
const GREEN = rgb(0.12, 0.54, 0.3);
const SOFT = rgb(0.96, 0.97, 0.98);

const W = 612; // carta
const H = 792;
const M = 48;

class Layout {
  page!: PDFPage;
  y = 0;
  constructor(
    private doc: PDFDocument,
    private font: PDFFont,
    private bold: PDFFont
  ) {
    this.newPage();
  }

  newPage() {
    this.page = this.doc.addPage([W, H]);
    this.y = H - M;
  }

  ensure(height: number) {
    if (this.y - height < M + 20) this.newPage();
  }

  wrap(text: string, size: number, width: number, font = this.font): string[] {
    const lines: string[] = [];
    for (const paragraph of clean(text).split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= width) line = candidate;
        else {
          if (line) lines.push(line);
          line = word;
        }
      }
      lines.push(line);
    }
    return lines;
  }

  text(text: string, opts: { size?: number; bold?: boolean; color?: RGB; x?: number; width?: number; gap?: number } = {}) {
    const size = opts.size ?? 10;
    const font = opts.bold ? this.bold : this.font;
    const x = opts.x ?? M;
    const lineH = size * 1.35;
    for (const line of this.wrap(text, size, opts.width ?? W - x - M, font)) {
      this.ensure(lineH);
      this.page.drawText(line, { x, y: this.y - size, size, font, color: opts.color ?? INK });
      this.y -= lineH;
    }
    this.y -= opts.gap ?? 0;
  }

  heading(title: string, subtitle?: string) {
    this.ensure(48);
    this.y -= 10;
    this.text(title, { size: 13, bold: true, gap: 2 });
    if (subtitle) this.text(subtitle, { size: 9, color: MUTED, gap: 2 });
    this.page.drawLine({ start: { x: M, y: this.y }, end: { x: W - M, y: this.y }, thickness: 0.8, color: LINE });
    this.y -= 8;
  }

  bullet(text: string, opts: { color?: RGB; detail?: string } = {}) {
    this.ensure(14);
    this.page.drawCircle({ x: M + 4, y: this.y - 5, size: 1.8, color: opts.color ?? INK });
    this.text(text, { x: M + 12, size: 10, color: opts.color, gap: opts.detail ? 0 : 3 });
    if (opts.detail) this.text(opts.detail, { x: M + 12, size: 8.5, color: MUTED, gap: 3 });
  }

  empty(text: string) {
    this.text(text, { size: 9.5, color: MUTED, gap: 2 });
  }

  /** Tabla simple: anchos en proporción, encabezado gris. */
  table(columns: { label: string; width: number; align?: "right" }[], rows: { cells: string[]; color?: RGB }[]) {
    const total = W - 2 * M;
    const xs: number[] = [];
    let acc = M;
    for (const c of columns) {
      xs.push(acc);
      acc += c.width * total;
    }
    const drawRow = (cells: string[], header: boolean, color?: RGB) => {
      const size = header ? 8.5 : 9.5;
      const font = header ? this.bold : this.font;
      const wrapped = cells.map((c, i) => this.wrap(c, size, columns[i].width * total - 8, font));
      const height = Math.max(...wrapped.map((l) => l.length)) * size * 1.3 + 6;
      this.ensure(height);
      if (header) this.page.drawRectangle({ x: M, y: this.y - height, width: total, height, color: SOFT });
      wrapped.forEach((lines, i) => {
        lines.forEach((line, j) => {
          const w = font.widthOfTextAtSize(line, size);
          const x = columns[i].align === "right" ? xs[i] + columns[i].width * total - 4 - w : xs[i] + 4;
          this.page.drawText(line, { x, y: this.y - 3 - size - j * size * 1.3, size, font, color: header ? MUTED : (color ?? INK) });
        });
      });
      this.y -= height;
      this.page.drawLine({ start: { x: M, y: this.y }, end: { x: W - M, y: this.y }, thickness: 0.5, color: LINE });
    };
    drawRow(columns.map((c) => c.label.toUpperCase()), true);
    for (const r of rows) drawRow(r.cells, false, r.color);
    this.y -= 6;
  }
}

const DATE = new Intl.DateTimeFormat("es", { dateStyle: "long", timeZone: "America/Guatemala" });
const TIME = new Intl.DateTimeFormat("es", { timeStyle: "short", timeZone: "America/Guatemala" });
const SHORT = new Intl.DateTimeFormat("es", { day: "numeric", month: "short", timeZone: "UTC" });
const short = (d: string | null) => (d ? SHORT.format(new Date(`${d.slice(0, 10)}T12:00:00Z`)) : "sin fecha");
const ROCK_STATUS: Record<string, string> = { on_track: "On track", off_track: "Off track", done: "Completado" };

export async function buildMeetingSummaryPdf(recap: MeetingRecap, brandColor: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const brand = hexToRgb(brandColor);
  const { meeting } = recap;
  const started = meeting.started_at ? new Date(meeting.started_at) : new Date(meeting.created_at);

  doc.setTitle(clean(`Resumen Reunión L10 #${meeting.id} - ${recap.teamName}`));
  doc.setAuthor("EOS Nivel 10");
  doc.setCreationDate(new Date());

  const L = new Layout(doc, font, bold);

  // Encabezado
  L.page.drawRectangle({ x: 0, y: H - 112, width: W, height: 112, color: brand });
  L.page.drawText(clean("RESUMEN DE REUNIÓN LEVEL 10"), { x: M, y: H - 44, size: 9, font: bold, color: rgb(1, 1, 1), opacity: 0.85 });
  L.page.drawText(clean(`${recap.teamName} · Reunión #${meeting.id}`), { x: M, y: H - 70, size: 20, font: bold, color: rgb(1, 1, 1) });
  const when = `${DATE.format(started)} · ${TIME.format(started)}${meeting.ended_at ? ` a ${TIME.format(new Date(meeting.ended_at))}` : " (en curso)"}`;
  L.page.drawText(clean(when), { x: M, y: H - 92, size: 10, font, color: rgb(1, 1, 1) });
  L.y = H - 112 - 22;

  // Indicadores rápidos
  const kpis: [string, string][] = [
    ["Duración", recap.durationMinutes !== null ? `${recap.durationMinutes} min` : "-"],
    ["Calificación", recap.average !== null ? `${recap.average.toFixed(1)}/10` : "-"],
    ["To-Dos nuevos", String(recap.todos.created.length)],
    ["Issues resueltos", String(recap.issues.solved.length)],
  ];
  const kw = (W - 2 * M - 3 * 10) / 4;
  kpis.forEach(([label, value], i) => {
    const x = M + i * (kw + 10);
    L.page.drawRectangle({ x, y: L.y - 52, width: kw, height: 52, color: SOFT, borderColor: LINE, borderWidth: 0.6 });
    L.page.drawText(clean(label.toUpperCase()), { x: x + 10, y: L.y - 18, size: 7.5, font: bold, color: MUTED });
    L.page.drawText(clean(value), { x: x + 10, y: L.y - 40, size: 16, font: bold, color: INK });
  });
  L.y -= 64;

  // Asistentes y calificaciones
  L.heading("Calificación de la reunión", `${recap.ratings.length} de ${recap.members.length} personas calificaron`);
  if (recap.ratings.length === 0) L.empty("Nadie calificó la reunión.");
  else L.text(recap.ratings.map((r) => `${r.user_name}: ${r.rating}`).join("   ·   "), { gap: 2 });

  // Scorecard
  L.heading(
    "Scorecard",
    recap.scorecard.week ? `Semana ${formatWeekRange(recap.scorecard.week)} · números fuera de meta` : "Sin datos registrados"
  );
  if (!recap.scorecard.week) L.empty("No hay números registrados en las últimas semanas.");
  else if (recap.scorecard.offTrack.length === 0) L.text("Todos los indicadores están en meta.", { color: GREEN, gap: 2 });
  else
    L.table(
      [
        { label: "Indicador", width: 0.45 },
        { label: "Dueño", width: 0.25 },
        { label: "Valor", width: 0.15, align: "right" },
        { label: "Meta", width: 0.15, align: "right" },
      ],
      recap.scorecard.offTrack.map((o) => ({ cells: [o.metric, o.owner, o.value, o.target], color: RED }))
    );

  // Indicadores de carrera
  const t = recap.careers.totals;
  L.heading("Indicadores de carrera", `Semana ${recap.careers.weekLabel}`);
  if (t.careers === 0) L.empty("No hay carreras registradas.");
  else {
    L.bullet(`Leads: ${num(t.leads)} de una meta de ${num(t.leadsGoal)} (${pct(t.leads, t.leadsGoal)})`);
    L.bullet(`Consumo: ${money(t.spent)} de ${money(t.budgetGoal)} presupuestados (${pct(t.spent, t.budgetGoal)})`);
    L.bullet(`Carreras a revisar: ${t.leadsRed} en leads · ${t.budgetRed} en presupuesto`, {
      color: t.leadsRed + t.budgetRed > 0 ? RED : GREEN,
    });
  }

  // Rocks
  L.heading("Rocks del trimestre", `${recap.rocks.filter((r) => r.status === "off_track").length} off track de ${recap.rocks.length}`);
  if (recap.rocks.length === 0) L.empty("No hay Rocks este trimestre.");
  else
    L.table(
      [
        { label: "Rock", width: 0.58 },
        { label: "Dueño", width: 0.22 },
        { label: "Estado", width: 0.2 },
      ],
      recap.rocks.map((r) => ({
        cells: [r.title, recap.ownerName(r.owner_id), ROCK_STATUS[r.status] ?? r.status],
        color: r.status === "off_track" ? RED : undefined,
      }))
    );

  // Noticias
  L.heading("Noticias");
  if (recap.headlines.length === 0) L.empty("No se registraron noticias.");
  for (const h of recap.headlines) L.bullet(`${h.type === "customer" ? "Externa" : "Equipo"}: ${h.content}`);

  // To-Dos
  const todoRow = (td: MeetingRecap["todos"]["pending"][number], withStatus: boolean) => ({
    cells: [
      td.title,
      recap.ownerName(td.owner_id),
      short(td.due_date),
      ...(withStatus ? [td.status === "done" ? "Hecho" : "Pendiente"] : []),
    ],
    color: withStatus && td.status !== "done" ? RED : undefined,
  });
  L.heading("To-Dos que estaban pendientes", "Revisados en la reunión: ¿hecho o no hecho?");
  if (recap.todos.pending.length === 0) L.empty("No había To-Dos pendientes.");
  else
    L.table(
      [
        { label: "To-Do", width: 0.5 },
        { label: "Dueño", width: 0.2 },
        { label: "Fecha", width: 0.13 },
        { label: "Estado", width: 0.17 },
      ],
      recap.todos.pending.map((td) => todoRow(td, true))
    );

  L.heading("To-Dos nuevos de esta reunión");
  if (recap.todos.created.length === 0) L.empty("No se crearon To-Dos nuevos.");
  else
    L.table(
      [
        { label: "To-Do", width: 0.6 },
        { label: "Dueño", width: 0.25 },
        { label: "Fecha", width: 0.15 },
      ],
      recap.todos.created.map((td) => todoRow(td, false))
    );

  // IDS
  L.heading("IDS: Issues", `${recap.issues.stillOpen} issue(s) siguen abiertos`);
  L.text("Resueltos en la reunión", { bold: true, size: 10, gap: 2 });
  if (recap.issues.solved.length === 0) L.empty("Ninguno.");
  for (const i of recap.issues.solved) L.bullet(i.title, { color: GREEN, detail: `Dueño: ${recap.ownerName(i.owner_id)}` });
  L.y -= 4;
  L.text("Nuevos issues registrados", { bold: true, size: 10, gap: 2 });
  if (recap.issues.created.length === 0) L.empty("Ninguno.");
  for (const i of recap.issues.created)
    L.bullet(i.title, { detail: `Dueño: ${recap.ownerName(i.owner_id)} · ${i.term === "long_term" ? "Largo plazo" : "Corto plazo"}` });

  // Mensajes a cascadear
  L.heading("Mensajes a cascadear");
  if (meeting.cascade_notes.trim()) L.text(meeting.cascade_notes);
  else L.empty("No se registraron mensajes.");

  // Pie de página en todas las hojas
  const pages = doc.getPages();
  const generated = `Generado el ${DATE.format(new Date())} · EOS Nivel 10`;
  pages.forEach((p, i) => {
    p.drawText(clean(generated), { x: M, y: 26, size: 8, font, color: MUTED });
    const label = `Página ${i + 1} de ${pages.length}`;
    p.drawText(clean(label), { x: W - M - font.widthOfTextAtSize(clean(label), 8), y: 26, size: 8, font, color: MUTED });
  });

  return doc.save();
}
