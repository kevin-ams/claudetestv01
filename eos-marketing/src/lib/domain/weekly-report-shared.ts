import type { ModuleKey } from "@/lib/auth/modules";

/** Planificación (inicio de semana) o fin de semana (evolución de lo trabajado). */
export type ReportKind = "planificacion" | "cierre";

export const REPORT_KINDS: { id: ReportKind; label: string; title: string; hint: string }[] = [
  {
    id: "planificacion",
    label: "Planificación",
    title: "Reporte de planificación",
    hint: "Lo planificado para la semana; el Scorecard muestra los resultados de la semana anterior.",
  },
  {
    id: "cierre",
    label: "Fin de semana",
    title: "Reporte de fin de semana",
    hint: "La evolución de lo trabajado: avance contra lo planificado y comparación con la semana anterior.",
  },
];

export function isReportKind(v: unknown): v is ReportKind {
  return v === "planificacion" || v === "cierre";
}

/** Secciones que se pueden incluir en el reporte semanal, en el orden en que aparecen. */
export const REPORT_SECTIONS = [
  {
    key: "calendario",
    label: "Calendario editorial",
    hint: "Piezas y fechas clave de la semana",
    hintCierre: "Piezas publicadas contra planificadas y pendientes",
    module: "calendario",
  },
  {
    key: "coberturas",
    label: "Control de coberturas",
    hint: "Coberturas de la semana y horas",
    hintCierre: "Coberturas realizadas contra programadas y horas",
    module: "coberturas",
  },
  {
    key: "scorecard",
    label: "Scorecard semanal",
    hint: "Resultados de la semana anterior contra su meta",
    hintCierre: "Resultados de la semana y cambio contra la anterior",
    module: "scorecard",
  },
  {
    key: "l10",
    label: "Resumen de la reunión L10",
    hint: "Reunión de esa semana: calificación, To-Dos e Issues",
    hintCierre: "Reunión de esa semana y avance de sus To-Dos",
    module: "meeting",
  },
  {
    key: "eventos",
    label: "Eventos próximos",
    hint: "Eventos pendientes y con fecha desde esa semana",
    hintCierre: "Eventos pendientes y con fecha desde la próxima semana",
    module: "meeting",
  },
  {
    key: "indicadores",
    label: "Indicadores de carrera",
    hint: "Leads y consumo contra meta, por persona",
    hintCierre: "Leads y consumo de la semana contra la anterior, por persona",
    module: "indicadores",
  },
  {
    key: "rocks",
    label: "Resumen de Rocks",
    hint: "Rocks del trimestre y avance de hitos a esa semana",
    hintCierre: "Avance de Rocks e hitos que vencían en la semana",
    module: "rocks",
  },
] as const satisfies readonly { key: string; label: string; hint: string; hintCierre: string; module: ModuleKey }[];

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

/** Secciones guardadas por tipo de reporte. Acepta el formato anterior ("a,b"), que vale para ambos. */
export function parseSavedSections(raw: string, kind: ReportKind): ReportSection[] {
  const text = raw.trim();
  if (!text.startsWith("{")) return parseSections(text);
  try {
    const obj = JSON.parse(text) as Partial<Record<ReportKind, string[]>>;
    return parseSections(obj[kind] ?? []);
  } catch {
    return [];
  }
}

export function serializeSections(raw: string, kind: ReportKind, sections: ReportSection[]): string {
  const text = raw.trim();
  let obj: Partial<Record<ReportKind, string[]>> = {};
  if (text.startsWith("{")) {
    try {
      obj = JSON.parse(text);
    } catch {}
  } else if (text) {
    obj = { planificacion: parseSections(text), cierre: parseSections(text) };
  }
  obj[kind] = sections;
  return JSON.stringify(obj);
}
