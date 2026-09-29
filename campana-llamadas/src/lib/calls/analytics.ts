import { norm } from "./parse";
import type { CallOutcome, CallRecord, InterestLevel, PriorContact } from "./types";

export const OUTCOME_LABEL: Record<CallOutcome, string> = {
  efectiva: "Llamada efectiva",
  no_contesto: "No contestó / Buzón",
  numero_equivocado: "Número equivocado",
  otro: "Otro",
  pendiente: "Pendiente de llamar",
};

export const INTEREST_LABEL: Record<InterestLevel, string> = {
  interesado: "Interesado",
  solo_info: "Solo quiere información",
  inscrito: "Ya está inscrito",
  no_interesa: "Ya no le interesa",
};

export const PRIOR_LABEL: Record<PriorContact | "sin_dato", string> = {
  si: "Sí, ya lo llamaron",
  no: "No lo habían llamado",
  no_recuerda: "No recuerda",
  sin_dato: "Sin dato",
};

export type Filters = {
  from: string;
  to: string;
  includeUndated: boolean;
  agents: string[];
  faculties: string[];
  levels: string[];
  programs: string[];
  outcomes: CallOutcome[];
  interests: (InterestLevel | "sin_dato")[];
  prior: (PriorContact | "sin_dato")[];
  search: string;
};

export const EMPTY_FILTERS: Filters = {
  from: "",
  to: "",
  includeUndated: true,
  agents: [],
  faculties: [],
  levels: [],
  programs: [],
  outcomes: [],
  interests: [],
  prior: [],
  search: "",
};

export const isCalled = (r: CallRecord) => r.outcome !== "pendiente";

/**
 * Los filtros de llamada (fecha, asesor, resultado, interés) solo aplican a leads ya
 * llamados; los de segmentación (facultad, nivel, carrera) aplican a todo el universo,
 * para que la cobertura se calcule contra los leads pendientes del mismo segmento.
 */
export function applyFilters(records: CallRecord[], f: Filters) {
  const q = norm(f.search);
  const hasDate = Boolean(f.from || f.to);

  const universe = records.filter(
    (r) =>
      (!f.faculties.length || f.faculties.includes(r.faculty)) &&
      (!f.levels.length || f.levels.includes(r.level)) &&
      (!f.programs.length || f.programs.includes(r.program)) &&
      (!q || norm(`${r.name} ${r.phone} ${r.email} ${r.notes} ${r.program}`).includes(q))
  );

  const calls = universe.filter((r) => {
    if (!isCalled(r)) return false;
    // Una llamada sin fecha no puede estar dentro de un rango: con fechas se excluye siempre.
    if (hasDate) {
      if (!r.callDate || (f.from && r.callDate < f.from) || (f.to && r.callDate > f.to)) {
        return false;
      }
    } else if (!r.callDate && !f.includeUndated) {
      return false;
    }
    if (f.agents.length && !f.agents.includes(r.agent ?? "(Sin asesor)")) return false;
    if (f.outcomes.length && !f.outcomes.includes(r.outcome)) return false;
    if (f.interests.length) {
      const keys = r.interests.length ? r.interests : ["sin_dato" as const];
      if (!keys.some((k) => f.interests.includes(k))) return false;
    }
    if (f.prior.length && !f.prior.includes(r.priorContact ?? "sin_dato")) return false;
    return true;
  });

  const callFiltersActive =
    hasDate ||
    !f.includeUndated ||
    f.agents.length + f.outcomes.length + f.interests.length + f.prior.length > 0;

  return { universe, calls, callFiltersActive };
}

export type Rates = {
  calls: number;
  effective: number;
  noAnswer: number;
  wrongNumber: number;
  interested: number;
  infoOnly: number;
  enrolled: number;
  notInterested: number;
  neverContacted: number;
  /** Efectivas / llamadas. */
  contactRate: number;
  /** Interesados / efectivas. */
  interestRate: number;
  /** Interesados / llamadas: la efectividad de punta a punta. */
  yieldRate: number;
};

const ratio = (a: number, b: number) => (b ? a / b : 0);

export function rates(calls: CallRecord[]): Rates {
  let effective = 0,
    noAnswer = 0,
    wrongNumber = 0,
    interested = 0,
    infoOnly = 0,
    enrolled = 0,
    notInterested = 0,
    neverContacted = 0;
  for (const r of calls) {
    if (r.outcome === "efectiva") effective++;
    else if (r.outcome === "no_contesto") noAnswer++;
    else if (r.outcome === "numero_equivocado") wrongNumber++;
    if (r.interests.includes("interesado")) interested++;
    if (r.interests.includes("solo_info")) infoOnly++;
    if (r.interests.includes("inscrito")) enrolled++;
    if (r.interests.includes("no_interesa")) notInterested++;
    if (r.priorContact === "no") neverContacted++;
  }
  return {
    calls: calls.length,
    effective,
    noAnswer,
    wrongNumber,
    interested,
    infoOnly,
    enrolled,
    notInterested,
    neverContacted,
    contactRate: ratio(effective, calls.length),
    interestRate: ratio(interested, effective),
    yieldRate: ratio(interested, calls.length),
  };
}

export function groupBy<K extends string>(
  items: CallRecord[],
  key: (r: CallRecord) => K | null
): Map<K, CallRecord[]> {
  const map = new Map<K, CallRecord[]>();
  for (const r of items) {
    const k = key(r);
    if (k === null) continue;
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  return map;
}

export type AgentStats = Rates & {
  agent: string;
  days: number;
  /** Llamadas por hora trabajada (entre la primera y la última llamada de cada día). */
  callsPerHour: number | null;
};

export function agentStats(calls: CallRecord[]): AgentStats[] {
  return [...groupBy(calls, (r) => r.agent ?? "(Sin asesor)")]
    .map(([agent, list]) => {
      const byDay = groupBy(list, (r) => r.callDate);
      let minutes = 0,
        timedCalls = 0;
      for (const dayCalls of byDay.values()) {
        const times = dayCalls
          .map((r) => r.callTime)
          .filter((t): t is string => Boolean(t))
          .map((t) => +t.slice(0, 2) * 60 + +t.slice(3, 5))
          .sort((a, b) => a - b);
        if (times.length >= 3) {
          // +2 min por la última llamada, que también toma tiempo.
          minutes += times[times.length - 1] - times[0] + 2;
          timedCalls += times.length;
        }
      }
      return {
        agent,
        ...rates(list),
        days: byDay.size,
        callsPerHour: minutes >= 20 ? (timedCalls / minutes) * 60 : null,
      };
    })
    .sort((a, b) => b.calls - a.calls);
}

export function dailySeries(calls: CallRecord[]) {
  return [...groupBy(calls, (r) => r.callDate)]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, list]) => ({ day, ...rates(list) }));
}

export function hourlySeries(calls: CallRecord[]) {
  return [...groupBy(calls, (r) => (r.callHour === null ? null : String(r.callHour)))]
    .map(([hour, list]) => ({ hour: +hour, ...rates(list) }))
    .sort((a, b) => a.hour - b.hour);
}

export type ProgramStats = Rates & {
  program: string;
  faculty: string;
  level: string;
  leads: number;
  pending: number;
  coverage: number;
};

export function programStats(universe: CallRecord[], calls: CallRecord[]): ProgramStats[] {
  const callsByProgram = groupBy(calls, (r) => r.program);
  return [...groupBy(universe, (r) => r.program)]
    .map(([program, leads]) => {
      const pending = leads.filter((r) => !isCalled(r)).length;
      return {
        program,
        faculty: leads[0].faculty,
        level: leads[0].level,
        leads: leads.length,
        pending,
        coverage: ratio(leads.length - pending, leads.length),
        ...rates(callsByProgram.get(program) ?? []),
      };
    })
    .sort((a, b) => b.calls - a.calls || b.leads - a.leads);
}

/** Días entre que entró el lead y la llamada. */
export const LEAD_AGE_BUCKETS = [
  { label: "0–7 días", min: 0, max: 7 },
  { label: "8–14 días", min: 8, max: 14 },
  { label: "15–30 días", min: 15, max: 30 },
  { label: "31–60 días", min: 31, max: 60 },
  { label: "Más de 60 días", min: 61, max: Infinity },
];

export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

export function leadAgeSeries(calls: CallRecord[]) {
  return LEAD_AGE_BUCKETS.map((bucket) => {
    const list = calls.filter((r) => {
      if (!r.leadDate || !r.callDate) return false;
      const age = daysBetween(r.leadDate, r.callDate);
      return age >= bucket.min && age <= bucket.max;
    });
    return { label: bucket.label, ...rates(list) };
  });
}

/** Temas recurrentes en OBSERVACIONES, detectados por palabras clave. */
export const THEMES: { key: string; label: string; patterns: RegExp[] }[] = [
  { key: "whatsapp", label: "Pide info por WhatsApp", patterns: [/whats/] },
  {
    key: "no_info",
    label: "No ha recibido información",
    patterns: [/no (se )?le han (mandado|enviado|contactado|compartido)/, /no ha recibido/, /aun no le han/],
  },
  {
    key: "has_info",
    label: "Ya tiene la info, sin revisar/decidir",
    patterns: [/ya cuenta con la informacion/, /ya tiene la informacion/],
  },
  {
    key: "location",
    label: "Vive fuera / pide sede en su municipio",
    patterns: [/se encuentra en/, /municipio/, /departamento/, /sede/, /vive en/],
  },
  {
    key: "modality",
    label: "Pide modalidad virtual/híbrida/fin de semana",
    patterns: [/virtual/, /hibrid/, /en linea/, /online/, /fin de semana/, /distancia/],
  },
  {
    key: "price",
    label: "Precio / mensualidades / becas",
    patterns: [/mensualidad/, /precio/, /costo/, /pago/, /beca/, /cuota/],
  },
  {
    key: "process",
    label: "Trámite de inscripción complicado",
    patterns: [/tramite/, /personalmente/, /papeleria/, /requisito/],
  },
  { key: "voicemail", label: "Manda directo a buzón", patterns: [/buzon/] },
  { key: "hangup", label: "Cortó la llamada", patterns: [/corto/, /colgo/] },
  {
    key: "retries",
    label: "3 intentos sin respuesta",
    patterns: [/3 veces/, /tres veces/, /varias veces/],
  },
];

export function themeCounts(calls: CallRecord[]) {
  return THEMES.map((theme) => {
    const list = calls.filter((r) => {
      const n = norm(r.notes);
      return n && theme.patterns.some((p) => p.test(n));
    });
    return { ...theme, count: list.length, records: list };
  })
    .filter((t) => t.count > 0)
    .sort((a, b) => b.count - a.count);
}

/**
 * Prioridad de seguimiento: interesado que nadie había contactado primero, luego
 * interesados, luego quienes solo quieren información.
 */
export function followUps(calls: CallRecord[]) {
  const score = (r: CallRecord) =>
    (r.interests.includes("interesado") ? 2 : r.interests.includes("solo_info") ? 1 : 0) +
    (r.priorContact === "no" ? 2 : r.priorContact === "no_recuerda" ? 1 : 0);
  return calls
    .filter(
      (r) =>
        r.outcome === "efectiva" &&
        (r.interests.includes("interesado") || r.interests.includes("solo_info"))
    )
    .map((r) => ({ record: r, score: score(r) }))
    .sort((a, b) => b.score - a.score || (b.record.callDate ?? "").localeCompare(a.record.callDate ?? ""));
}

export type Recommendation = {
  tone: "action" | "warning" | "insight";
  title: string;
  detail: string;
};

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function recommendations(universe: CallRecord[], calls: CallRecord[]): Recommendation[] {
  const out: Recommendation[] = [];
  const total = rates(calls);
  if (total.calls === 0) {
    const pending = universe.filter((r) => !isCalled(r)).length;
    if (pending) {
      out.push({
        tone: "action",
        title: `Hay ${pending} leads sin llamar en esta selección`,
        detail: "Todavía no hay llamadas registradas para estos filtros. Asigna un asesor para empezar la campaña.",
      });
    }
    return out;
  }

  // 1. Leads que nadie había atendido: es la alerta más importante del guion.
  const interestedNoPrior = calls.filter(
    (r) => r.interests.includes("interesado") && r.priorContact === "no"
  ).length;
  const withPrior = calls.filter((r) => r.priorContact).length;
  if (total.neverContacted > 0) {
    out.push({
      tone: "action",
      title: `${total.neverContacted} de ${withPrior} contactados dicen que nadie los había llamado (${pct(ratio(total.neverContacted, withPrior))})`,
      detail: `${interestedNoPrior} de ellos están interesados. Pásalos hoy a admisiones con prioridad alta y revisa el tiempo de primera respuesta del equipo comercial.`,
    });
  }

  // 2. Mejor franja horaria.
  const hours = hourlySeries(calls).filter((h) => h.calls >= 5);
  if (hours.length >= 2) {
    const best = hours.reduce((a, b) => (b.contactRate > a.contactRate ? b : a));
    const worst = hours.reduce((a, b) => (b.contactRate < a.contactRate ? b : a));
    if (best.contactRate - worst.contactRate >= 0.1) {
      out.push({
        tone: "insight",
        title: `La franja de ${best.hour}:00 contesta más (${pct(best.contactRate)} vs ${pct(worst.contactRate)} a las ${worst.hour}:00)`,
        detail: "Concentra los primeros intentos en la franja con más contacto y usa la de menor contacto para reintentos o para enviar WhatsApp.",
      });
    }
  }

  // 3. Antigüedad del lead.
  const ages = leadAgeSeries(calls)
    .map((a, i) => ({ ...a, recent: LEAD_AGE_BUCKETS[i].max <= 14 }))
    .filter((a) => a.calls >= 8);
  if (ages.length >= 2 && ages[0].recent && !ages[ages.length - 1].recent) {
    const fresh = ages[0];
    const old = ages[ages.length - 1];
    if (fresh.contactRate - old.contactRate >= 0.1) {
      out.push({
        tone: "insight",
        title: `Los leads recientes contestan más: ${pct(fresh.contactRate)} (${fresh.label}) vs ${pct(old.contactRate)} (${old.label})`,
        detail: "Llama primero a los leads que entraron en la última semana; el interés se enfría rápido.",
      });
    }
  }

  // 4. Desempeño por asesor.
  const agents = agentStats(calls).filter((a) => a.calls >= 10);
  if (agents.length >= 2) {
    const worst = agents.reduce((a, b) => (b.contactRate < a.contactRate ? b : a));
    const best = agents.reduce((a, b) => (b.contactRate > a.contactRate ? b : a));
    if (best.contactRate - worst.contactRate >= 0.15) {
      out.push({
        tone: "warning",
        title: `${worst.agent} tiene ${pct(worst.contactRate)} de contacto vs ${pct(best.contactRate)} de ${best.agent}`,
        detail: "Compara horarios y número de reintentos entre asesores; puede ser la franja en la que llama y no el desempeño. Revisa juntos el guion y las observaciones.",
      });
    }
  }

  // 4b. Meta diaria de efectivas.
  const behind = agentGoals(calls).filter((g) => g.days.length > 0 && g.avgEffective < DAILY_EFFECTIVE_GOAL);
  if (behind.length) {
    const g = behind[behind.length - 1];
    out.push({
      tone: "warning",
      title: `${behind.map((b) => b.agent).join(", ")} ${behind.length === 1 ? "está" : "están"} bajo la meta de ${DAILY_EFFECTIVE_GOAL} efectivas diarias`,
      detail: `${g.agent} promedia ${g.avgEffective.toFixed(1)} efectivas por día${
        g.callsNeeded ? `; con su ${pct(g.contactRate)} de contacto necesita unas ${g.callsNeeded} llamadas diarias para llegar` : ""
      }. Sube el volumen de marcación o concentra llamadas en las franjas con más contacto.`,
    });
  }

  // 5. Muchos buzones.
  if (total.calls >= 10 && ratio(total.noAnswer, total.calls) >= 0.5) {
    out.push({
      tone: "warning",
      title: `${pct(ratio(total.noAnswer, total.calls))} de las llamadas no contestan o van a buzón`,
      detail: "Antes de marcar, envía un WhatsApp corto presentándote; reintenta en otra franja y en otro día antes de cerrar el lead.",
    });
  }

  // 6. Temas de las observaciones (un lead cuenta una sola vez por recomendación).
  const themeList = themeCounts(calls);
  const themes = new Map(themeList.map((t) => [t.key, t.count]));
  const leadsWith = (...keys: string[]) =>
    new Set(themeList.filter((t) => keys.includes(t.key)).flatMap((t) => t.records.map((r) => r.id))).size;
  const wantsInfo = leadsWith("whatsapp", "no_info");
  if (wantsInfo >= 2) {
    out.push({
      tone: "action",
      title: `${wantsInfo} leads piden la información o dicen no haberla recibido`,
      detail: "Arma un mensaje de WhatsApp con folleto, pensum y precios por carrera para enviarlo al terminar cada llamada.",
    });
  }
  const remote = leadsWith("location", "modality");
  if (remote >= 2) {
    out.push({
      tone: "insight",
      title: `${remote} contactos viven fuera o piden otra modalidad`,
      detail: "Ten a mano la oferta virtual, híbrida y de fin de semana (y sedes regionales) para no perder a estos leads.",
    });
  }
  if ((themes.get("price") ?? 0) + (themes.get("process") ?? 0) >= 1) {
    out.push({
      tone: "insight",
      title: "Hay objeciones de precio o de trámite de inscripción",
      detail: "Prepara respuestas sobre mensualidades, becas y la posibilidad de hacer el trámite en línea.",
    });
  }

  // 7. Ya inscritos: el lead no debería seguir en la lista.
  if (total.enrolled > 0) {
    out.push({
      tone: "warning",
      title: `${total.enrolled} leads ya están inscritos`,
      detail: "Márcalos en el CRM para sacarlos de la lista de leads pendientes; es tiempo de llamada desperdiciado.",
    });
  }

  if (total.wrongNumber > 0 && ratio(total.wrongNumber, total.calls) >= 0.05) {
    out.push({
      tone: "warning",
      title: `${pct(ratio(total.wrongNumber, total.calls))} de los números están equivocados`,
      detail: "Valida el formato del teléfono en el formulario de captación (8 dígitos, código +502).",
    });
  }

  // 8. Cobertura por carrera.
  const uncovered = programStats(universe, calls).filter((p) => p.leads >= 5 && p.coverage === 0);
  if (uncovered.length) {
    const leads = uncovered.reduce((s, p) => s + p.leads, 0);
    out.push({
      tone: "action",
      title: `${uncovered.length} carreras (${leads} leads) no tienen ninguna llamada`,
      detail: `Empieza por: ${uncovered
        .sort((a, b) => b.leads - a.leads)
        .slice(0, 3)
        .map((p) => `${p.program} (${p.leads})`)
        .join(", ")}.`,
    });
  }

  // 9. Calidad de datos.
  const undated = calls.filter((r) => !r.callDate).length;
  const untimed = calls.filter((r) => r.callHour === null).length;
  if (undated || untimed) {
    out.push({
      tone: "warning",
      title: `${undated} llamadas sin "Día" y ${untimed} sin "hora" válida`,
      detail: "Pide al equipo llenar Día (dd/mm/aaaa) y hora (hh:mm) en cada llamada; sin eso no se puede medir la productividad ni la mejor franja.",
    });
  }

  return out;
}

/** Meta de llamadas efectivas por asesor por día. */
export const DAILY_EFFECTIVE_GOAL = 15;

export type AgentGoal = {
  agent: string;
  /** Días con fecha, de más antiguo a más reciente. */
  days: { day: string; calls: number; effective: number }[];
  daysMet: number;
  avgEffective: number;
  periodEffective: number;
  periodGoal: number;
  lastDay: { day: string; calls: number; effective: number } | null;
  contactRate: number;
  /** Llamadas diarias que necesita, con su tasa de contacto actual, para llegar a la meta. */
  callsNeeded: number | null;
  undatedEffective: number;
};

export function agentGoals(calls: CallRecord[], goal = DAILY_EFFECTIVE_GOAL): AgentGoal[] {
  return [...groupBy(calls, (r) => r.agent ?? "(Sin asesor)")]
    .map(([agent, list]) => {
      const days = [...groupBy(list, (r) => r.callDate)]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, dayCalls]) => ({
          day,
          calls: dayCalls.length,
          effective: dayCalls.filter((r) => r.outcome === "efectiva").length,
        }));
      const periodEffective = days.reduce((s, d) => s + d.effective, 0);
      const { contactRate } = rates(list);
      return {
        agent,
        days,
        daysMet: days.filter((d) => d.effective >= goal).length,
        avgEffective: ratio(periodEffective, days.length),
        periodEffective,
        periodGoal: days.length * goal,
        lastDay: days[days.length - 1] ?? null,
        contactRate,
        callsNeeded: contactRate > 0 ? Math.ceil(goal / contactRate) : null,
        undatedEffective: list.filter((r) => !r.callDate && r.outcome === "efectiva").length,
      };
    })
    .sort((a, b) => b.avgEffective - a.avgEffective);
}
