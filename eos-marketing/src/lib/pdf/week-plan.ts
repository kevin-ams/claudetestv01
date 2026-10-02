import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  BUFFER_SLOTS,
  isActivePiece,
  summarizePieces,
  type Coverage,
  type EditorialDate,
  type EditorialPiece,
} from "@/lib/domain/editorial-shared";
import { formatShortDate, formatWeekRange } from "@/lib/utils/dates";
import { clean, H, hexToRgb, INK, Layout, LINE, M, MUTED, SOFT, W } from "./kit";

export type WeekPlan = {
  teamName: string;
  week: string;
  pieces: EditorialPiece[];
  dates: EditorialDate[];
  coverages: Coverage[];
  memberName: (id: number | null) => string;
};

const DATE = new Intl.DateTimeFormat("es", { dateStyle: "long", timeZone: process.env.EOS_TIMEZONE || "America/Guatemala" });

/** PDF de la planificación de una semana del calendario editorial (para enviar a jefatura). */
export async function buildWeekPlanPdf(plan: WeekPlan, brandColor: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const brand = hexToRgb(brandColor);
  const range = formatWeekRange(plan.week);

  doc.setTitle(clean(`Planificación de contenido · ${range} · ${plan.teamName}`));
  doc.setAuthor("EOS Nivel 10");
  doc.setCreationDate(new Date());

  const L = new Layout(doc, font, bold);
  L.page.drawRectangle({ x: 0, y: H - 112, width: W, height: 112, color: brand });
  L.page.drawText(clean("PLANIFICACIÓN SEMANAL DE CONTENIDO"), { x: M, y: H - 44, size: 9, font: bold, color: rgb(1, 1, 1), opacity: 0.85 });
  L.page.drawText(clean(plan.teamName), { x: M, y: H - 70, size: 20, font: bold, color: rgb(1, 1, 1) });
  L.page.drawText(clean(`Semana del ${range}`), { x: M, y: H - 92, size: 11, font, color: rgb(1, 1, 1) });
  L.y = H - 112 - 22;

  const active = plan.pieces.filter(isActivePiece);
  const off = plan.pieces.filter((p) => !isActivePiece(p));
  const s = summarizePieces(plan.pieces);
  const bufferUsed = active.filter((p) => p.is_buffer).length;
  const kpis: [string, string][] = [
    ["Piezas", `${s.total} (${s.published} publ.)`],
    ["Hero · Hub · Hygiene", `${s.byCapa.Hero} · ${s.byCapa.Hub} · ${s.byCapa.Hygiene}`],
    ["% Hygiene", s.hygienePct === null ? "-" : `${s.hygienePct}%`],
    ["Buffer usado", `${bufferUsed}/${BUFFER_SLOTS}`],
  ];
  const kw = (W - 2 * M - 3 * 10) / 4;
  kpis.forEach(([label, value], i) => {
    const x = M + i * (kw + 10);
    L.page.drawRectangle({ x, y: L.y - 52, width: kw, height: 52, color: SOFT, borderColor: LINE, borderWidth: 0.6 });
    L.page.drawText(clean(label.toUpperCase()), { x: x + 10, y: L.y - 18, size: 7.5, font: bold, color: MUTED });
    L.page.drawText(clean(value), { x: x + 10, y: L.y - 40, size: 14, font: bold, color: INK });
  });
  L.y -= 64;

  // Carga por persona
  const load = [...s.byAssignee.entries()].map(([id, v]) => `${plan.memberName(id)}: ${v.total} pieza(s)`).join("   ·   ");
  if (load) L.text(`Carga: ${load}`, { size: 9.5, color: MUTED, gap: 4 });

  if (plan.dates.length) {
    L.heading("Fechas clave de la semana", "Días internacionales y mundiales que sirven de gancho");
    for (const d of plan.dates)
      L.bullet(`${formatShortDate(d.date)} · ${d.title}`, { detail: [d.facultad, d.carrera, d.angle].filter(Boolean).join(" · ") || undefined });
  }

  const table = (rows: EditorialPiece[]) =>
    L.table(
      [
        { label: "Fecha", width: 0.11 },
        { label: "Pieza / tema", width: 0.39 },
        { label: "Pilar · capa", width: 0.18 },
        { label: "Facultad", width: 0.17 },
        { label: "Estado", width: 0.15 },
      ],
      rows.map((p) => ({
        cells: [
          p.pub_date ? formatShortDate(p.pub_date) : "-",
          [p.title, p.cta && `CTA: ${p.cta}`, p.link, p.note && `Nota: ${p.note}`].filter(Boolean).join("\n"),
          [p.pilar, p.capa].filter(Boolean).join(" · ") || "-",
          [p.facultad, p.carrera].filter(Boolean).join(" / ") || "-",
          p.status,
        ],
      }))
    );

  // Piezas por persona (planificadas)
  const planned = active.filter((p) => !p.is_buffer);
  const people = [...new Set(planned.map((p) => p.assignee_id))];
  if (planned.length === 0) {
    L.heading("Piezas planificadas");
    L.empty("No hay piezas planificadas para esta semana.");
  }
  for (const id of people) {
    const rows = planned.filter((p) => p.assignee_id === id);
    L.heading(`Piezas de ${plan.memberName(id)}`, `${rows.length} pieza(s) planificada(s)`);
    table(rows);
  }

  const buffer = active.filter((p) => p.is_buffer);
  if (buffer.length) {
    L.heading("Buffer esporádico / reactivo", `${buffer.length} de ${BUFFER_SLOTS} slots usados`);
    table(buffer);
  }

  if (plan.coverages.length) {
    L.heading("Coberturas de la semana", "Eventos con cobertura asignada");
    L.table(
      [
        { label: "Fecha", width: 0.13 },
        { label: "Evento", width: 0.4 },
        { label: "Horario", width: 0.14 },
        { label: "Asignación", width: 0.15 },
        { label: "Paquete", width: 0.18 },
      ],
      plan.coverages.map((c) => ({
        cells: [
          c.date ? formatShortDate(c.date) : "-",
          [c.title, c.facultad].filter(Boolean).join("\n"),
          c.start_time || c.end_time ? `${c.start_time || "?"} - ${c.end_time || "?"}` : "-",
          plan.memberName(c.assignee_id),
          c.paquete || "-",
        ],
      }))
    );
  }

  if (off.length) {
    L.heading("Reprogramadas o canceladas");
    for (const p of off) L.bullet(`${p.title} (${p.status})`, { color: MUTED, detail: p.note || undefined });
  }

  const pages = doc.getPages();
  const generated = `Generado el ${DATE.format(new Date())} · EOS Nivel 10`;
  pages.forEach((p, i) => {
    p.drawText(clean(generated), { x: M, y: 26, size: 8, font, color: MUTED });
    const label = `Página ${i + 1} de ${pages.length}`;
    p.drawText(clean(label), { x: W - M - font.widthOfTextAtSize(clean(label), 8), y: 26, size: 8, font, color: MUTED });
  });
  return doc.save();
}
