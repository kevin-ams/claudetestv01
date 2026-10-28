// Deterministic sample data shown while ActiveCampaign is not configured.
import type { AcMeta, DealRecord, DealStatus, FieldMap } from "./types";

const DAY = 86_400_000;

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function weighted<T>(rand: () => number, items: [T, number][]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [item, w] of items) {
    if ((r -= w) <= 0) return item;
  }
  return items[0][0];
}

const STAGES = ["Nuevo lead", "Contactado", "Interesado", "Cita / visita", "Solicitud enviada", "Inscrito"];

export const DEMO_META: AcMeta = {
  pipelines: [
    { id: "1", title: "Licenciaturas" },
    { id: "2", title: "Posgrados" },
  ],
  stages: ["1", "2"].flatMap((p) =>
    STAGES.map((title, i) => ({ id: `${p}${i + 1}`, title, pipelineId: p, order: i + 1 }))
  ),
  users: [
    { id: "1", name: "Ana López", email: "ana@example.com" },
    { id: "2", name: "Carlos Ruiz", email: "carlos@example.com" },
    { id: "3", name: "Daniela Torres", email: "daniela@example.com" },
    { id: "4", name: "Jorge Méndez", email: "jorge@example.com" },
    { id: "5", name: "Lucía Herrera", email: "lucia@example.com" },
  ],
  dealFields: [
    { id: "1", label: "Carrera", key: "CARRERA" },
    { id: "2", label: "Clasificación lead chat", key: "CLASIFICACION_CHAT" },
  ],
  contactFields: [
    { id: "10", label: "utm_source", key: "UTM_SOURCE" },
    { id: "11", label: "utm_medium", key: "UTM_MEDIUM" },
    { id: "12", label: "utm_term", key: "UTM_TERM" },
    { id: "13", label: "utm_campaign", key: "UTM_CAMPAIGN" },
  ],
  fetchedAt: null,
};

export const DEMO_FIELD_MAP: FieldMap = {
  career: { source: "deal", id: "1" },
  lead_classification: { source: "deal", id: "2" },
  utm_source: { source: "contact", id: "10" },
  utm_medium: { source: "contact", id: "11" },
  utm_term: { source: "contact", id: "12" },
  utm_campaign: { source: "contact", id: "13" },
};

const CAREERS: Record<string, [string, number][]> = {
  "1": [
    ["Psicología", 9],
    ["Derecho", 7],
    ["Administración", 6],
    ["Ing. en Sistemas", 5],
    ["Nutrición", 4],
    ["Diseño Gráfico", 3],
    ["Enfermería", 3],
  ],
  "2": [
    ["MBA", 4],
    ["Maestría en Educación", 3],
    ["Maestría en Psicología Clínica", 2],
  ],
};

const SOURCES: [[string, string, string], number][] = [
  [["facebook", "paid_social", "fb_admisiones_otono"], 9],
  [["google", "cpc", "search_carreras"], 7],
  [["instagram", "paid_social", "ig_reels_admisiones"], 5],
  [["tiktok", "paid_social", "tt_awareness"], 3],
  [["organic", "organic", ""], 3],
  [["email", "email", "newsletter_open_house"], 2],
  [["referido", "referral", ""], 1],
];

const TERMS = ["estudiar psicologia", "universidad en linea", "licenciatura derecho", "becas universidad", "maestria fin de semana", "carrera de nutricion", ""];
const CLASSES: [string, number][] = [
  ["Caliente", 3],
  ["Tibio", 4],
  ["Frío", 3],
  ["No calificado", 2],
];
const NOTES = [
  "Se envió información por WhatsApp.",
  "Llamada sin respuesta, se deja mensaje.",
  "Interesado en beca, pide costos.",
  "Agendó visita al campus.",
  "Solicita plan de estudios por correo.",
  "Pide llamar la próxima semana.",
];

export function demoDeals(now: number): DealRecord[] {
  const rand = rng(42);
  const deals: DealRecord[] = [];
  for (let i = 0; i < 420; i++) {
    const pipelineId = rand() < 0.78 ? "1" : "2";
    const created = now - Math.floor(Math.pow(rand(), 1.3) * 120 * DAY) - Math.floor(rand() * DAY);
    const age = (now - created) / DAY;
    const ownerId = String(1 + Math.floor(rand() * 5));
    // Deeper stages for older deals, with a per-owner diligence factor.
    const diligence = [1, 1.2, 0.8, 1.05, 0.6][Number(ownerId) - 1];
    const maxStage = Math.min(6, 1 + Math.floor(rand() * Math.min(6, age / 4) * diligence));
    let status: DealStatus = "open";
    if (maxStage === 6) status = "won";
    else if (age > 20 && rand() < 0.35) status = "lost";
    const stageIndex = status === "won" ? 6 : maxStage;
    const enteredAt = created + rand() * (now - created) * (stageIndex === 1 ? 0.15 : 0.85);
    const [source, medium, campaign] = weighted(rand, SOURCES);
    const notesCount = rand() < 0.12 * (2 - diligence) ? 0 : 1 + Math.floor(rand() * 6 * diligence);
    const firstAt = created + (rand() < 0.6 ? rand() * 6 : rand() * 72) * 3_600_000 / diligence;
    const lastAt = Math.min(now, firstAt + rand() * (now - firstAt));
    const career = weighted(rand, CAREERS[pipelineId]);
    deals.push({
      id: String(5000 + i),
      title: `Prospecto ${career} #${5000 + i}`,
      value: pipelineId === "1" ? 45000 + Math.round(rand() * 20) * 1000 : 80000 + Math.round(rand() * 40) * 1000,
      currency: "MXN",
      status,
      pipelineId,
      stageId: `${pipelineId}${stageIndex}`,
      ownerId,
      contactId: String(9000 + i),
      contactName: `Contacto ${i + 1}`,
      contactEmail: `contacto${i + 1}@example.com`,
      contactPhone: null,
      createdAt: new Date(created).toISOString(),
      updatedAt: new Date(lastAt).toISOString(),
      stageEnteredAt: new Date(enteredAt).toISOString(),
      closedAt: status === "open" ? null : new Date(enteredAt).toISOString(),
      stageChanges: stageIndex - 1,
      activityCount: notesCount + stageIndex,
      lastActivityAt: notesCount ? new Date(lastAt).toISOString() : new Date(enteredAt).toISOString(),
      notesCount,
      firstNote: notesCount
        ? { text: NOTES[Math.floor(rand() * NOTES.length)], at: new Date(firstAt).toISOString(), userId: ownerId }
        : null,
      lastNote: notesCount
        ? { text: NOTES[Math.floor(rand() * NOTES.length)], at: new Date(lastAt).toISOString(), userId: ownerId }
        : null,
      dealFields: { "1": career, "2": weighted(rand, CLASSES) },
      contactFields: {
        "10": source,
        "11": medium,
        "12": source === "google" ? TERMS[Math.floor(rand() * TERMS.length)] : "",
        "13": campaign,
      },
      enriched: true,
    });
  }
  return deals;
}
