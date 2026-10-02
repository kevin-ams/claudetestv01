import "server-only";

/**
 * Integración con ActiveCampaign (API v3) para los leads semanales por carrera.
 *
 * Cada carrera se vincula en Ajustes › Leads desde ActiveCampaign a un embudo y una
 * etapa de tratos (p. ej. "Interesado - Cola de Asesor"). Si el embudo tiene varias
 * carreras, se filtra por el campo del trato "Nombre de la Carrera"
 * (%DEAL_NOMBRE_DE_LA_CARRERA%). El lead de la semana es la cantidad de tratos que
 * están en esa etapa al momento de sincronizar.
 *
 * Variables: ACTIVECAMPAIGN_API_URL (https://<cuenta>.api-us1.com) y
 * ACTIVECAMPAIGN_API_KEY (secreta).
 */

export class ActiveCampaignNotConfiguredError extends Error {
  constructor() {
    super("La conexión con ActiveCampaign no está configurada (faltan ACTIVECAMPAIGN_API_URL y ACTIVECAMPAIGN_API_KEY).");
  }
}

export function isActiveCampaignConfigured(): boolean {
  return Boolean(process.env.ACTIVECAMPAIGN_API_URL && process.env.ACTIVECAMPAIGN_API_KEY);
}

/** Campo personalizado del trato con el nombre de la carrera. */
export const CAREER_FIELD_TAG = "DEAL_NOMBRE_DE_LA_CARRERA";
const PAGE = 100;
/** Tope de páginas por etapa (10,000 tratos) para no exceder el tiempo de la función. */
const MAX_PAGES = 100;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function acGet<T>(path: string): Promise<T> {
  if (!isActiveCampaignConfigured()) throw new ActiveCampaignNotConfiguredError();
  const base = process.env.ACTIVECAMPAIGN_API_URL!.replace(/\/$/, "");
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${base}/api/3/${path}`, {
      headers: { "Api-Token": process.env.ACTIVECAMPAIGN_API_KEY!, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    });
    // ActiveCampaign permite ~5 solicitudes por segundo: si responde 429 se espera y reintenta.
    if (res.status === 429 && attempt < 4) {
      await sleep(1000 * (attempt + 1));
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`ActiveCampaign respondió ${res.status}${res.status === 403 ? " (sin permiso: revisa los permisos del usuario de la API)" : ""}: ${text.slice(0, 160)}`);
    }
    return (await res.json()) as T;
  }
}

type Meta = { meta?: { total?: string | number } };

export type AcStage = { id: string; title: string; order: number };
export type AcPipeline = { id: string; title: string; stages: AcStage[] };

/** Embudos con sus etapas, en el orden de ActiveCampaign. */
export async function listPipelines(): Promise<AcPipeline[]> {
  const groups: { id: string; title: string }[] = [];
  for (let offset = 0; offset < 2000; offset += PAGE) {
    const r = await acGet<Meta & { dealGroups: { id: string; title: string }[] }>(`dealGroups?limit=${PAGE}&offset=${offset}`);
    groups.push(...r.dealGroups);
    if (r.dealGroups.length < PAGE) break;
  }
  const stages: { id: string; title: string; group: string; order: string }[] = [];
  for (let offset = 0; offset < 10000; offset += PAGE) {
    const r = await acGet<Meta & { dealStages: { id: string; title: string; group: string; order: string }[] }>(
      `dealStages?limit=${PAGE}&offset=${offset}`
    );
    stages.push(...r.dealStages);
    if (r.dealStages.length < PAGE) break;
  }
  return groups
    .map((g) => ({
      id: String(g.id),
      title: g.title,
      stages: stages
        .filter((s) => String(s.group) === String(g.id))
        .map((s) => ({ id: String(s.id), title: s.title, order: Number(s.order) || 0 }))
        .sort((a, b) => a.order - b.order),
    }))
    .sort((a, b) => a.title.localeCompare(b.title, "es"));
}

let careerFieldId: Promise<string | null> | undefined;
/** Id del campo "Nombre de la Carrera" (se busca por su etiqueta de personalización). */
async function getCareerFieldId(): Promise<string | null> {
  careerFieldId ??= (async () => {
    const r = await acGet<{ dealCustomFieldMeta: { id: string | number; personalization?: string; fieldLabel?: string }[] }>(
      "dealCustomFieldMeta?limit=100"
    );
    const f =
      r.dealCustomFieldMeta.find((m) => m.personalization === CAREER_FIELD_TAG) ??
      r.dealCustomFieldMeta.find((m) => (m.fieldLabel ?? "").toLowerCase() === "nombre de la carrera");
    return f ? String(f.id) : null;
  })().catch((e) => {
    careerFieldId = undefined;
    throw e;
  });
  return careerFieldId;
}

type DealsPage = Meta & {
  deals: { id: string }[];
  // Con include=dealCustomFieldData cada valor viene como deal_id / custom_field_id /
  // custom_field_text_value (o deal / dealCustomFieldMetum); se aceptan ambas formas.
  dealCustomFieldData?: Record<string, unknown>[];
};

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Recorre los tratos de un filtro y devuelve el "Nombre de la Carrera" de cada uno. */
async function dealsWithCareer(filter: string, maxPages: number): Promise<{ id: string; career: string }[]> {
  const fieldId = await getCareerFieldId();
  const out: { id: string; career: string }[] = [];
  for (let page = 0; page < maxPages; page++) {
    const r = await acGet<DealsPage>(`deals?${filter}&limit=${PAGE}&offset=${page * PAGE}&include=dealCustomFieldData`);
    const careerByDeal = new Map<string, string>();
    for (const d of r.dealCustomFieldData ?? []) {
      const field = String(d.custom_field_id ?? d.dealCustomFieldMetum ?? d.customFieldId ?? "");
      if (field !== fieldId) continue;
      const deal = String(d.deal_id ?? d.deal ?? d.dealId ?? "");
      const value = d.custom_field_text_value ?? d.custom_field_text_blob ?? d.fieldValue ?? "";
      careerByDeal.set(deal, String(value).trim());
    }
    for (const deal of r.deals) out.push({ id: String(deal.id), career: careerByDeal.get(String(deal.id)) ?? "" });
    if (r.deals.length < PAGE) break;
  }
  return out;
}

/** Valores de "Nombre de la Carrera" en los tratos más recientes del embudo (para sugerir). */
export async function careerValuesInPipeline(pipelineId: string): Promise<{ value: string; count: number }[]> {
  const deals = await dealsWithCareer(`filters[group]=${encodeURIComponent(pipelineId)}&orders[cdate]=DESC`, 3);
  const counts = new Map<string, number>();
  for (const d of deals) if (d.career) counts.set(d.career, (counts.get(d.career) ?? 0) + 1);
  return [...counts.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
}

/**
 * Tratos que hay ahora en la etapa, agrupados por "Nombre de la Carrera".
 * `total` = todos los tratos de la etapa (para vínculos sin filtro de carrera).
 */
export async function countStage(stageId: string): Promise<{ total: number; byCareer: Map<string, number> }> {
  const deals = await dealsWithCareer(`filters[stage]=${encodeURIComponent(stageId)}`, MAX_PAGES);
  const byCareer = new Map<string, number>();
  for (const d of deals) {
    const k = norm(d.career);
    byCareer.set(k, (byCareer.get(k) ?? 0) + 1);
  }
  return { total: deals.length, byCareer };
}

/** Cuántos tratos corresponden a un vínculo dado el conteo de su etapa. */
export function countFor(stage: { total: number; byCareer: Map<string, number> }, careerValue: string): number {
  return careerValue.trim() ? (stage.byCareer.get(norm(careerValue)) ?? 0) : stage.total;
}
