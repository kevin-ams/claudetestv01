import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

// ---------------------------------------------------------------------------
// Etapas e hitos del lanzamiento de una carrera
// ---------------------------------------------------------------------------

export type StageKey = "definicion" | "produccion" | "activacion" | "mejora";

export const CONTROL_STAGES: { key: StageKey; label: string; color: string; soft: string }[] = [
  { key: "definicion", label: "1. Definición", color: "#7c6fd6", soft: "color-mix(in srgb, #7c6fd6 12%, transparent)" },
  { key: "produccion", label: "2. Producción", color: "#e8845c", soft: "color-mix(in srgb, #e8845c 12%, transparent)" },
  { key: "activacion", label: "3. Activación", color: "#e0605e", soft: "color-mix(in srgb, #e0605e 12%, transparent)" },
  { key: "mejora", label: "4. Mejora continua", color: "#2f9e8f", soft: "color-mix(in srgb, #2f9e8f 12%, transparent)" },
];

export type MilestoneKey = string;

export type MilestoneDef = {
  key: MilestoneKey;
  stage: StageKey;
  label: string;
  actions: string;
  doneWhen: string;
  /** Duración estimada en días calendario. */
  days: number;
  /** Hitos que deben terminar antes de iniciar este (red de la ruta crítica). */
  dependsOn: MilestoneKey[];
  /** Marca el hito cuyo fin es la fecha de lanzamiento. */
  isLaunch?: boolean;
};

/** Hitos con los que arranca cada equipo; se editan en Ajustes. */
export const DEFAULT_MILESTONES: MilestoneDef[] = [
  {
    key: "brief",
    stage: "definicion",
    label: "Brief validado",
    actions:
      "Confirmar nombre de la carrera, modalidad, fechas, inversión, requisitos, malla curricular, cupos y proceso de inscripción. Identificar público objetivo y diferenciadores.",
    doneWhen: "La información fue revisada con la unidad académica y admisiones.",
    days: 5,
    dependsOn: [],
  },
  {
    key: "estrategia",
    stage: "definicion",
    label: "Estrategia comercial",
    actions:
      "Definir propuesta de valor, perfiles de aspirantes, objeciones, mensajes clave, canales, presupuesto y metas de leads e inscritos.",
    doneWhen: "Hay una estrategia aprobada para orientar contenido y campañas.",
    days: 5,
    dependsOn: ["brief"],
  },
  {
    key: "embudo",
    stage: "definicion",
    label: "Embudo y seguimiento",
    actions:
      "Dibujar el recorrido desde anuncio o contenido hasta inscripción; definir formularios, responsables, tiempos de contacto y etapas del prospecto.",
    doneWhen: "Está claro qué ocurre con cada contacto y quién lo atiende.",
    days: 3,
    dependsOn: ["estrategia"],
  },
  {
    key: "bot",
    stage: "definicion",
    label: "Contenido para bot",
    actions:
      "Preparar markdowns con información oficial, preguntas frecuentes, respuestas a objeciones y criterios para pasar a un asesor.",
    doneWhen: "El contenido está validado y el bot responde correctamente las consultas principales.",
    days: 5,
    dependsOn: ["estrategia"],
  },
  {
    key: "matriz",
    stage: "produccion",
    label: "Matriz de contenido",
    actions: "Planificar mensajes por perfil, etapa del embudo, formato, canal y llamado a la acción.",
    doneWhen: "La matriz cubre atracción, consideración y decisión.",
    days: 3,
    dependsOn: ["estrategia"],
  },
  {
    key: "piezas",
    stage: "produccion",
    label: "Piezas y destinos",
    actions:
      "Diseñar anuncios, publicaciones, correos y, según corresponda, landing o página de carrera y formulario. Adaptar formatos para Meta y Google.",
    doneWhen: "Textos, diseños, enlaces y formularios están aprobados.",
    days: 10,
    dependsOn: ["matriz"],
  },
  {
    key: "automatizaciones",
    stage: "activacion",
    label: "Automatizaciones",
    actions:
      "Configurar ActiveCampaign: entrada de leads, etiquetas o campos, asignación, correos, alertas y seguimiento.",
    doneWhen: "Un lead de prueba recorre el flujo y llega al responsable correcto.",
    days: 5,
    dependsOn: ["embudo"],
  },
  {
    key: "medicion",
    stage: "activacion",
    label: "Medición y campañas",
    actions:
      "Configurar conversiones, eventos, UTMs, públicos, campañas y presupuesto en Meta y Google según la estrategia.",
    doneWhen: "Se comprueba el registro de leads y la atribución de cada canal.",
    days: 3,
    dependsOn: ["embudo", "piezas"],
  },
  {
    key: "lanzamiento",
    stage: "activacion",
    label: "Lanzamiento",
    actions:
      "Hacer revisión final de anuncios, enlaces, formularios, bot, automatizaciones y atención comercial; activar campañas.",
    doneWhen: "La carrera está publicada y recibe contactos sin fallas detectadas.",
    days: 2,
    dependsOn: ["bot", "automatizaciones", "medicion"],
    isLaunch: true,
  },
  {
    key: "nurturing",
    stage: "activacion",
    label: "Nurturing",
    actions:
      "Enviar contenido y recordatorios a quienes mostraron interés, diferenciando a quienes aún consideran la carrera de quienes están cerca de inscribirse.",
    doneWhen: "Los contactos reciben una secuencia pertinente y pueden avanzar hacia admisiones.",
    days: 14,
    dependsOn: ["lanzamiento"],
  },
  {
    key: "aprendizaje",
    stage: "mejora",
    label: "Aprendizaje",
    actions:
      "Revisar preguntas frecuentes, objeciones, calidad de leads y motivos de no inscripción con admisiones y la unidad académica.",
    doneWhen: "Los hallazgos quedan registrados y se convierten en acciones.",
    days: 7,
    dependsOn: ["lanzamiento"],
  },
  {
    key: "optimizacion",
    stage: "mejora",
    label: "Optimización",
    actions: "Ajustar anuncios, inversión, públicos, mensajes, página, formularios y secuencias según resultados.",
    doneWhen: "Cada cambio tiene una hipótesis, fecha y resultado medido.",
    days: 14,
    dependsOn: ["aprendizaje"],
  },
];

export function stageInfo(stage: StageKey) {
  return CONTROL_STAGES.find((s) => s.key === stage) ?? CONTROL_STAGES[0];
}

/** Ordena por etapa y deja solo dependencias hacia hitos anteriores (red sin ciclos). */
export function normalizeMilestones(list: MilestoneDef[]): MilestoneDef[] {
  const stageIdx = (k: StageKey) => CONTROL_STAGES.findIndex((s) => s.key === k);
  const ordered = list
    .map((m, i) => ({ m, i }))
    .sort((a, b) => stageIdx(a.m.stage) - stageIdx(b.m.stage) || a.i - b.i)
    .map(({ m }) => m);
  const seen = new Set<string>();
  return ordered.map((m) => {
    const clean = { ...m, days: Math.max(0, Math.round(m.days)), dependsOn: m.dependsOn.filter((d) => seen.has(d)) };
    seen.add(m.key);
    return clean;
  });
}

/** Columna "terminado": todos los hitos completos. */
export const DONE_COLUMN = "completado" as const;
export type ColumnKey = MilestoneKey;

// ---------------------------------------------------------------------------
// Ruta crítica (CPM): inicio/fin temprano y tardío, holgura y hitos críticos
// ---------------------------------------------------------------------------

export type CpmNode = { es: number; ef: number; ls: number; lf: number; float: number; critical: boolean };

export type ControlPlan = {
  milestones: MilestoneDef[];
  keys: MilestoneKey[];
  nodes: Record<MilestoneKey, CpmNode>;
  critical: Set<MilestoneKey>;
  totalDays: number;
  /** Hito cuyo fin es el lanzamiento (marcado en Ajustes o, si no hay, el último de Activación). */
  launchKey: MilestoneKey | null;
  launchOffset: number;
};

export function buildPlan(input: MilestoneDef[]): ControlPlan {
  const milestones = normalizeMilestones(input);
  const nodes: Record<MilestoneKey, CpmNode> = {};
  // Pasada hacia adelante (la lista ya está en orden topológico).
  for (const m of milestones) {
    const es = Math.max(0, ...m.dependsOn.map((d) => nodes[d].ef));
    nodes[m.key] = { es, ef: es + m.days, ls: 0, lf: 0, float: 0, critical: false };
  }
  const totalDays = milestones.length ? Math.max(...Object.values(nodes).map((n) => n.ef)) : 0;
  // Pasada hacia atrás.
  for (const m of [...milestones].reverse()) {
    const successors = milestones.filter((s) => s.dependsOn.includes(m.key));
    const lf = successors.length ? Math.min(...successors.map((s) => nodes[s.key].ls)) : totalDays;
    const node = nodes[m.key];
    node.lf = lf;
    node.ls = lf - m.days;
    node.float = node.ls - node.es;
    node.critical = node.float === 0;
  }
  const launch =
    milestones.find((m) => m.isLaunch) ??
    [...milestones].reverse().find((m) => m.stage === "activacion") ??
    null;
  return {
    milestones,
    keys: milestones.map((m) => m.key),
    nodes,
    critical: new Set(milestones.filter((m) => nodes[m.key].critical).map((m) => m.key)),
    totalDays,
    launchKey: launch?.key ?? null,
    launchOffset: launch ? nodes[launch.key].ef : totalDays,
  };
}

// ---------------------------------------------------------------------------
// Estado de una carrera en el tablero
// ---------------------------------------------------------------------------

const iso = (d: Date) => format(d, "yyyy-MM-dd");

export type MilestonePlan = {
  key: MilestoneKey;
  plannedStart: string;
  plannedEnd: string;
  forecastEnd: string;
  doneOn: string | null;
  late: boolean;
  critical: boolean;
  float: number;
};

export type TrackSummary = {
  column: ColumnKey;
  doneCount: number;
  plans: Record<MilestoneKey, MilestonePlan>;
  plannedLaunch: string;
  forecastLaunch: string;
  launchDelay: number; // días de atraso previstos del lanzamiento (0 si va a tiempo)
  current: MilestonePlan | null;
};

/**
 * Plan (línea base) desde la fecha de inicio y pronóstico con lo real:
 * un hito completado termina en su fecha; uno pendiente no puede terminar
 * antes de hoy ni antes de que terminen sus dependencias.
 */
export function summarizeTrack(
  plan: ControlPlan,
  startDate: string,
  done: Partial<Record<MilestoneKey, string>>,
  today: string = iso(new Date())
): TrackSummary {
  const start = parseISO(startDate);
  const todayDate = parseISO(today);
  const plans: Record<MilestoneKey, MilestonePlan> = {};
  const forecastEnd: Record<MilestoneKey, Date> = {};

  for (const m of plan.milestones) {
    const node = plan.nodes[m.key];
    const plannedStart = addDays(start, node.es);
    const plannedEnd = addDays(start, node.ef);
    const doneOn = done[m.key] ?? null;

    let end: Date;
    if (doneOn) {
      end = parseISO(doneOn);
    } else {
      const depsEnd = m.dependsOn.map((d) => forecastEnd[d].getTime());
      const earliestStart = new Date(Math.max(plannedStart.getTime(), ...depsEnd));
      end = addDays(earliestStart, m.days);
      if (end < todayDate) end = todayDate;
    }
    forecastEnd[m.key] = end;
    plans[m.key] = {
      key: m.key,
      plannedStart: iso(plannedStart),
      plannedEnd: iso(plannedEnd),
      forecastEnd: iso(end),
      doneOn,
      late: !doneOn && plannedEnd < todayDate,
      critical: node.critical,
      float: node.float,
    };
  }

  const firstPending = plan.milestones.find((m) => !done[m.key]);
  const plannedLaunch = plan.launchKey ? plans[plan.launchKey].plannedEnd : iso(addDays(start, plan.totalDays));
  const forecastLaunch = plan.launchKey ? plans[plan.launchKey].forecastEnd : plannedLaunch;
  return {
    column: firstPending ? firstPending.key : DONE_COLUMN,
    doneCount: plan.milestones.filter((m) => done[m.key]).length,
    plans,
    plannedLaunch,
    forecastLaunch,
    launchDelay: Math.max(0, differenceInCalendarDays(parseISO(forecastLaunch), parseISO(plannedLaunch))),
    current: firstPending ? plans[firstPending.key] : null,
  };
}

/** Fecha de inicio para que el lanzamiento caiga en la fecha indicada. */
export function startForLaunch(plan: ControlPlan, launchDate: string): string {
  return iso(addDays(parseISO(launchDate), -plan.launchOffset));
}

export function shortDate(date: string): string {
  const d = parseISO(date);
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

export const SUGGESTED_LABELS = ["Nueva", "Relanzamiento", "Prioridad", "Pregrado", "Postgrado", "Bloqueada"];
