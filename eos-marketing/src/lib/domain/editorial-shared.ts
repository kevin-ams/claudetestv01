// Tipos y reglas del Calendario editorial y del Control de coberturas
// (sin acceso a la base: se usan también en componentes de cliente).

export type EditorialPiece = {
  id: number;
  team_id: number;
  week_start: string | null;
  pub_date: string | null;
  title: string;
  pilar: string;
  capa: string;
  assignee_id: number | null;
  frente: string;
  audiencia: string;
  facultad: string;
  cta: string;
  status: string;
  note: string;
  is_buffer: boolean;
};

export type EditorialDate = {
  id: number;
  date: string;
  title: string;
  facultad: string;
  carrera: string;
  pilar: string;
  capa: string;
  angle: string;
  priority: string;
  note: string;
};

export type Coverage = {
  id: number;
  team_id: number;
  date: string | null;
  title: string;
  facultad: string;
  start_time: string;
  end_time: string;
  assignee_id: number | null;
  tipo: string;
  status: string;
  paquete: string;
  est_hours: string;
  real_hours: number | null;
  overtime_hours: number;
  replaced_hours: number;
  notes: string;
};

export type OptionKind = "pilar" | "estado" | "frente" | "cob_tipo" | "cob_estado" | "cob_paquete";

export type EditorialOption = { id: number; kind: OptionKind; value: string; hint: string; sort_order: number };

export type EditorialOptions = Record<OptionKind, EditorialOption[]>;

export const OPTION_KIND_LABEL: Record<OptionKind, string> = {
  pilar: "Pilares",
  estado: "Estados de pieza",
  frente: "Frentes",
  cob_tipo: "Tipos de cobertura",
  cob_estado: "Estados de cobertura",
  cob_paquete: "Paquetes de cobertura",
};

/** Listas iniciales (pestaña "Listas" del plan de contenido). */
export const DEFAULT_OPTIONS: Record<OptionKind, { value: string; hint?: string }[]> = {
  pilar: [
    { value: "Galileo Tech", hint: "30% · Liderazgo tecnológico" },
    { value: "Divulgacion y guias", hint: "15% · Captación orgánica (SEO)" },
    { value: "Vida universitaria", hint: "15% · Engagement" },
    { value: "Historias de exito", hint: "15% · Admisiones / cercanía" },
    { value: "Investigacion e impacto", hint: "15% · Reputación" },
    { value: "Institucional y alianzas", hint: "10% · Marca / confianza" },
    { value: "Calidad y educación en línea" },
    { value: "Eventos" },
    { value: "Reputación" },
  ],
  estado: [
    { value: "Por producir" },
    { value: "Programado" },
    { value: "En seguimiento" },
    { value: "En espera de aprobación" },
    { value: "Pendiente Banner DG" },
    { value: "Publicado" },
    { value: "Reprogramado" },
    { value: "Cancelado" },
  ],
  frente: [
    { value: "Eventos" },
    { value: "Institucional" },
    { value: "Carreras" },
    { value: "Días int." },
    { value: "Historia de Éxito" },
    { value: "25 Aniversario" },
    { value: "Marketing" },
  ],
  cob_tipo: [{ value: "Previa" }, { value: "Cobertura en vivo" }, { value: "Cierre" }, { value: "Serie" }, { value: "Seguimiento" }],
  cob_estado: [{ value: "Agendada" }, { value: "En curso" }, { value: "Realizada" }, { value: "Reprogramada" }, { value: "Cancelada" }],
  cob_paquete: [
    { value: "Express", hint: "≈ 2-3 h" },
    { value: "Estándar", hint: "≈ 4-5 h" },
    { value: "Ampliada", hint: "≈ 6-8 h" },
    { value: "Especial / Hero", hint: "2+ días" },
  ],
};

export const CAPAS = ["Hero", "Hub", "Hygiene"] as const;

/** Mezcla objetivo por capa (Resumen del plan) y piso SEO de Hygiene. */
export const CAPA_TARGET: Record<string, number> = { Hero: 10, Hub: 50, Hygiene: 35 };
export const HYGIENE_FLOOR = 25;
/** Slots de buffer esporádico/reactivo por semana. */
export const BUFFER_SLOTS = 3;

export const DONE_STATUS = "Publicado";
const INACTIVE = new Set(["Cancelado", "Reprogramado"]);

/** Piezas que cuentan para la carga de la semana (no canceladas ni movidas a otra). */
export function isActivePiece(p: Pick<EditorialPiece, "status">) {
  return !INACTIVE.has(p.status);
}

export type WeekSummary = {
  total: number;
  published: number;
  planned: number;
  buffer: number;
  byCapa: Record<string, number>;
  hygienePct: number | null;
  byAssignee: Map<number | null, { total: number; published: number }>;
};

export function summarizePieces(pieces: EditorialPiece[]): WeekSummary {
  const active = pieces.filter(isActivePiece);
  const byCapa: Record<string, number> = { Hero: 0, Hub: 0, Hygiene: 0 };
  const byAssignee = new Map<number | null, { total: number; published: number }>();
  for (const p of active) {
    if (p.capa in byCapa) byCapa[p.capa]++;
    const a = byAssignee.get(p.assignee_id) ?? { total: 0, published: 0 };
    a.total++;
    if (p.status === DONE_STATUS) a.published++;
    byAssignee.set(p.assignee_id, a);
  }
  const tagged = byCapa.Hero + byCapa.Hub + byCapa.Hygiene;
  return {
    total: active.length,
    published: active.filter((p) => p.status === DONE_STATUS).length,
    planned: active.filter((p) => !p.is_buffer).length,
    buffer: active.filter((p) => p.is_buffer).length,
    byCapa,
    hygienePct: tagged ? Math.round((byCapa.Hygiene / tagged) * 100) : null,
    byAssignee,
  };
}

/** Saldo de horas por reponer de una cobertura. */
export function coverageBalance(c: Pick<Coverage, "overtime_hours" | "replaced_hours">) {
  return Math.round((Number(c.overtime_hours) - Number(c.replaced_hours)) * 100) / 100;
}

export function statusTone(status: string): "green" | "red" | "yellow" | "muted" | "primary" {
  if (status === "Publicado" || status === "Realizada") return "green";
  if (status === "Cancelado" || status === "Cancelada") return "red";
  if (status === "Reprogramado" || status === "Reprogramada") return "muted";
  if (status === "Programado" || status === "Agendada" || status === "Por producir") return "primary";
  return "yellow";
}
