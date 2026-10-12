import type { ModuleKey } from "@/lib/auth/modules";

/** Secciones que se pueden incluir en el reporte semanal, en el orden en que aparecen. */
export const REPORT_SECTIONS = [
  { key: "calendario", label: "Calendario editorial", hint: "Piezas y fechas clave de la semana", module: "calendario" },
  { key: "coberturas", label: "Control de coberturas", hint: "Coberturas de la semana y horas", module: "coberturas" },
  { key: "scorecard", label: "Scorecard semanal", hint: "Indicadores del equipo contra su meta", module: "scorecard" },
  { key: "l10", label: "Resumen de la reunión L10", hint: "Reunión de esa semana: calificación, To-Dos e Issues", module: "meeting" },
  { key: "eventos", label: "Eventos próximos", hint: "Eventos pendientes y con fecha desde esa semana", module: "meeting" },
  { key: "indicadores", label: "Indicadores de carrera", hint: "Leads y consumo contra meta, por persona", module: "indicadores" },
  { key: "rocks", label: "Resumen de Rocks", hint: "Rocks del trimestre y avance de hitos a esa semana", module: "rocks" },
] as const satisfies readonly { key: string; label: string; hint: string; module: ModuleKey }[];

export type ReportSection = (typeof REPORT_SECTIONS)[number]["key"];

export function isReportSection(v: unknown): v is ReportSection {
  return REPORT_SECTIONS.some((s) => s.key === v);
}

/** "calendario,scorecard" → secciones válidas, sin repetir y en orden. */
export function parseSections(raw: string | readonly string[]): ReportSection[] {
  const list = typeof raw === "string" ? raw.split(",") : raw;
  const set = new Set(list.map((s) => s.trim()));
  return REPORT_SECTIONS.filter((s) => set.has(s.key)).map((s) => s.key);
}
