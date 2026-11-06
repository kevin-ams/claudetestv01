import "server-only";
import type { Career } from "./types";
import { normKey, type DashMeta, type DealRecord, type DealStatus } from "./deals-shared";

// Datos de ejemplo del Dashboard de tratos mientras ActiveCampaign no está configurado.
// Usan las carreras reales del equipo (nombre y facultad) para que la vista se parezca a la real.

const DAY = 86_400_000;
const STAGES = ["Interesado - Cola de Asesor", "Contactado", "En seguimiento", "Por inscribir", "Inscrito"];
const OWNERS = ["Andrea Pérez", "Luis Gómez", "María Castillo", "José Ramírez", "Sofía Morales", "Diego Herrera"];
const SOURCES: [string, string, string, number][] = [
  ["facebook", "paid_social", "fb_admisiones", 9],
  ["google", "cpc", "search_carreras", 7],
  ["instagram", "paid_social", "ig_reels", 5],
  ["tiktok", "paid_social", "tt_awareness", 3],
  ["organic", "organic", "", 3],
  ["email", "email", "newsletter_open_house", 2],
];
const TERMS = ["universidad en guatemala", "estudiar ingenieria", "maestria en linea", "becas universidad", "carreras tecnicas", ""];
const CLASSES: [string, number][] = [["Caliente", 3], ["Tibio", 4], ["Frío", 3], ["No calificado", 2]];
const NOTES = [
  "Se envió información por WhatsApp.",
  "Llamada sin respuesta, se deja mensaje.",
  "Pregunta por becas y forma de pago.",
  "Agendó visita al campus.",
  "Solicita pensum por correo.",
  "Pide que lo llamen la próxima semana.",
];
const FALLBACK: Pick<Career, "name" | "program">[] = [
  { name: "Ingeniería en Sistemas", program: "FISICC" },
  { name: "Ingeniería Industrial", program: "FISICC" },
  { name: "Licenciatura en Administración", program: "FACTI" },
  { name: "Licenciatura en Mercadeo", program: "FACTI" },
  { name: "Licenciatura en Psicología", program: "FACOM" },
  { name: "Licenciatura en Diseño Gráfico", program: "FACOM" },
  { name: "Maestría en Administración", program: "IDEA" },
];

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function weighted<T>(rand: () => number, items: [T, number][]): T {
  let r = rand() * items.reduce((s, [, w]) => s + w, 0);
  for (const [item, w] of items) if ((r -= w) <= 0) return item;
  return items[0][0];
}

export type DemoLink = { career_id: number; pipeline_id: string; career_value: string };

export function demoDeals(
  careers: Career[],
  now: number
): { meta: DashMeta; deals: DealRecord[]; careers: Career[]; links: DemoLink[] } {
  const rand = rng(7);
  const active = careers.filter((c) => !c.archived);
  const list: Career[] = (
    active.length
      ? active
      : FALLBACK.map((c, i) => ({ ...c, id: -(i + 1), team_id: 0, code: "", level: "Pregrado" as const, owner_id: null, archived: false, sort_order: i, created_at: "" }))
  ).slice(0, 40);
  const programs = [...new Set(list.map((c) => c.program || "General"))];

  const meta: DashMeta = {
    pipelines: programs.map((p, i) => ({ id: String(i + 1), title: `Admisiones ${p}` })),
    stages: programs.flatMap((_, i) =>
      STAGES.map((title, j) => ({ id: `${i + 1}-${j + 1}`, title, key: normKey(title), pipelineId: String(i + 1), order: j + 1 }))
    ),
    users: OWNERS.map((name, i) => ({ id: String(i + 1), name })),
    dealFields: [
      { id: "1", label: "Nombre de la Carrera", key: "DEAL_NOMBRE_DE_LA_CARRERA" },
      { id: "2", label: "Clasificación del lead (chat)", key: "DEAL_CLASIFICACION_CHAT" },
    ],
    contactFields: [
      { id: "10", label: "UTM Source", key: "UTM_SOURCE" },
      { id: "11", label: "UTM Medium", key: "UTM_MEDIUM" },
      { id: "12", label: "UTM Term", key: "UTM_TERM" },
      { id: "13", label: "UTM Campaign", key: "UTM_CAMPAIGN" },
    ],
    careerFieldId: "1",
    fetchedAt: null,
  };

  const weights = list.map((c, i) => [c, 1 + ((i * 7) % 5)] as [Career, number]);
  const deals: DealRecord[] = [];
  for (let i = 0; i < 900; i++) {
    const career = weighted(rand, weights);
    const pipelineId = String(programs.indexOf(career.program || "General") + 1);
    const created = now - Math.floor(Math.pow(rand(), 1.4) * 200 * DAY) - Math.floor(rand() * DAY);
    const age = (now - created) / DAY;
    const ownerIdx = Math.floor(rand() * OWNERS.length);
    const diligence = [1.1, 1, 0.75, 1.2, 0.6, 0.9][ownerIdx];
    const stageIdx = Math.min(5, 1 + Math.floor(rand() * Math.min(5, age / 5) * diligence));
    let status: DealStatus = "open";
    if (stageIdx === 5 && rand() < 0.7) status = "won";
    else if (age > 25 && rand() < 0.3) status = "lost";
    const entered = created + rand() * (now - created) * (stageIdx === 1 ? 0.15 : 0.85);
    // Historial: avanza una etapa a la vez; el último cambio es la entrada a la etapa actual.
    const stageHistory = Array.from({ length: stageIdx - 1 }, (_, j) => {
      const share = stageIdx - 1 === 1 ? 1 : Math.pow((j + 1) / (stageIdx - 1), 0.8 + rand() * 0.4);
      return {
        from: `${pipelineId}-${j + 1}`,
        to: `${pipelineId}-${j + 2}`,
        at: new Date(j === stageIdx - 2 ? entered : created + (entered - created) * share).toISOString(),
      };
    });
    const [source, medium, campaign] = weighted(rand, SOURCES.map(([s, m, c, w]) => [[s, m, c], w] as [string[], number]));
    const notesCount = rand() < 0.1 * (2 - diligence) ? 0 : 1 + Math.floor(rand() * 6 * diligence);
    const firstAt = created + ((rand() < 0.6 ? rand() * 6 : rand() * 72) * 3_600_000) / diligence;
    const lastAt = Math.min(now, firstAt + rand() * (now - firstAt));
    // Algunos tratos traen el nombre de la carrera escrito distinto (sin carrera vinculada).
    const careerValue = rand() < 0.06 ? `${career.name} (fin de semana)` : career.name;
    const note = (at: number) => ({ text: NOTES[Math.floor(rand() * NOTES.length)], at: new Date(at).toISOString(), userId: String(ownerIdx + 1) });
    deals.push({
      id: String(10000 + i),
      title: `${careerValue} · Prospecto ${i + 1}`,
      value: 0,
      status,
      pipelineId,
      stageId: `${pipelineId}-${stageIdx}`,
      ownerId: String(ownerIdx + 1),
      contactId: String(50000 + i),
      contactName: `Prospecto ${i + 1}`,
      contactEmail: `prospecto${i + 1}@ejemplo.com`,
      createdAt: new Date(created).toISOString(),
      updatedAt: new Date(lastAt).toISOString(),
      careerValue,
      dealFields: { "1": careerValue, "2": weighted(rand, CLASSES) },
      stageEnteredAt: new Date(entered).toISOString(),
      stageHistory,
      closedAt: status === "open" ? null : new Date(entered).toISOString(),
      lastActivityAt: new Date(notesCount ? lastAt : entered).toISOString(),
      notesCount,
      firstNote: notesCount ? note(firstAt) : null,
      lastNote: notesCount ? note(lastAt) : null,
      contactFields: {
        "10": source,
        "11": medium,
        "12": source === "google" ? TERMS[Math.floor(rand() * TERMS.length)] : "",
        "13": campaign,
      },
      enriched: true,
    });
  }
  // Vínculos como los de Ajustes › Leads desde ActiveCampaign: un embudo por facultad y el
  // "Nombre de la Carrera" de cada carrera.
  const links = list.map((c) => ({ career_id: c.id, pipeline_id: String(programs.indexOf(c.program || "General") + 1), career_value: c.name }));
  return { meta, deals, careers: list, links };
}
