import "server-only";

/**
 * Integración con ActiveCampaign (API v3) para los leads calificados por carrera.
 *
 * Cada carrera se vincula en Ajustes › Leads desde ActiveCampaign a un embudo (el del
 * director/carrera) y, si el embudo tiene varias carreras, al valor del campo del trato
 * "Nombre de la Carrera" (%DEAL_NOMBRE_DE_LA_CARRERA%). Un lead calificado es un trato que
 * entra a ese embudo (normalmente a "Interesado - Cola de Asesor"); la fecha de entrada sale
 * del historial de cambios de etapa del trato (dealActivities, tipo d_stageid).
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ActiveCampaign permite ~5 solicitudes por segundo: se espacian las llamadas de este proceso.
let lastCall = 0;
async function throttle() {
  const wait = lastCall + 220 - Date.now();
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();
}

async function acGet<T>(path: string): Promise<T> {
  if (!isActiveCampaignConfigured()) throw new ActiveCampaignNotConfiguredError();
  const base = process.env.ACTIVECAMPAIGN_API_URL!.replace(/\/$/, "");
  for (let attempt = 0; ; attempt++) {
    await throttle();
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

export type AcDeal = { id: string; stage: string; cdate: string; mdate: string; career: string };

/**
 * Una página de tratos del embudo modificados desde `since` (AAAA-MM-DD), del más antiguo
 * al más reciente, con su "Nombre de la Carrera".
 */
export async function dealsUpdatedSince(pipelineId: string, since: string, offset: number, limit: number): Promise<AcDeal[]> {
  const fieldId = await getCareerFieldId();
  const r = await acGet<Omit<DealsPage, "deals"> & { deals: { id: string; stage?: string; cdate?: string; mdate?: string }[] }>(
    `deals?filters[group]=${encodeURIComponent(pipelineId)}&filters[updated_after]=${encodeURIComponent(since)}` +
      `&orders[mdate]=ASC&limit=${limit}&offset=${offset}&include=dealCustomFieldData`
  );
  const careerByDeal = new Map<string, string>();
  for (const d of r.dealCustomFieldData ?? []) {
    const field = String(d.custom_field_id ?? d.dealCustomFieldMetum ?? d.customFieldId ?? "");
    if (field !== fieldId) continue;
    const deal = String(d.deal_id ?? d.deal ?? d.dealId ?? "");
    careerByDeal.set(deal, String(d.custom_field_text_value ?? d.custom_field_text_blob ?? d.fieldValue ?? "").trim());
  }
  return r.deals.map((d) => ({
    id: String(d.id),
    stage: String(d.stage ?? ""),
    cdate: String(d.cdate ?? ""),
    mdate: String(d.mdate ?? ""),
    career: careerByDeal.get(String(d.id)) ?? "",
  }));
}

export type StageChange = { from: string; to: string; at: string };

/** Cambios de etapa del trato (incluye los cambios de embudo), en orden cronológico. */
export async function dealStageChanges(dealId: string): Promise<StageChange[]> {
  const out: StageChange[] = [];
  for (let page = 0; page < 30; page++) {
    const r = await acGet<{ dealActivities?: Record<string, unknown>[] }>(
      `deals/${encodeURIComponent(dealId)}/dealActivities?limit=${PAGE}&offset=${page * PAGE}`
    );
    const rows = r.dealActivities ?? [];
    for (const a of rows) {
      if (a.dataType !== "d_stageid") continue;
      out.push({ from: String(a.dataOldval ?? ""), to: String(a.dataAction ?? ""), at: String(a.cdate ?? "") });
    }
    if (rows.length < PAGE) break;
  }
  return out.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

let stageGroups: { at: number; map: Promise<Map<string, string>> } | undefined;
/** Etapa → embudo (para saber cuándo un cambio de etapa fue una entrada al embudo). */
export async function stageGroupMap(): Promise<Map<string, string>> {
  if (!stageGroups || Date.now() - stageGroups.at > 10 * 60 * 1000) {
    const map = (async () => {
      const m = new Map<string, string>();
      for (let offset = 0; offset < 10000; offset += PAGE) {
        const r = await acGet<{ dealStages: { id: string; group: string }[] }>(`dealStages?limit=${PAGE}&offset=${offset}`);
        for (const st of r.dealStages) m.set(String(st.id), String(st.group));
        if (r.dealStages.length < PAGE) break;
      }
      return m;
    })();
    stageGroups = { at: Date.now(), map };
    map.catch(() => (stageGroups = undefined));
  }
  return stageGroups.map;
}

/**
 * Primera vez que el trato entró al embudo: al crearse, si nació en una etapa del embudo, o
 * en el primer cambio de una etapa de otro embudo a una de este. null si no se encuentra.
 */
export function firstEntry(deal: AcDeal, changes: StageChange[], groupOf: Map<string, string>, pipelineId: string): string | null {
  const inPipeline = (stage: string) => groupOf.get(stage) === pipelineId;
  const initial = changes.length ? changes[0].from : deal.stage;
  if (initial && inPipeline(initial)) return deal.cdate || null;
  for (const c of changes) if (inPipeline(c.to) && !inPipeline(c.from)) return c.at;
  return null;
}

export const normCareer = norm;

// --- Diagnóstico: historial de tratos ------------------------------------------------

/** Respuesta cruda (sin lanzar error) para la prueba de Diagnóstico. */
async function acRaw(path: string): Promise<{ path: string; status: number; body: unknown }> {
  if (!isActiveCampaignConfigured()) throw new ActiveCampaignNotConfiguredError();
  const base = process.env.ACTIVECAMPAIGN_API_URL!.replace(/\/$/, "");
  const res = await fetch(`${base}/api/3/${path}`, {
    headers: { "Api-Token": process.env.ACTIVECAMPAIGN_API_KEY!, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text().catch(() => "");
  let body: unknown = text.slice(0, 300);
  try {
    body = JSON.parse(text);
  } catch {}
  return { path, status: res.status, body };
}

/**
 * Deja solo campos técnicos (fechas, tipos, ids, valores de etapa) y recorta textos, para
 * no mostrar nombres, correos ni notas de los contactos.
 */
function scrub(value: unknown, depth = 0): unknown {
  if (Array.isArray(value)) return value.slice(0, 15).map((v) => scrub(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (v && typeof v === "object") {
        if (depth < 3 && !/links/i.test(k)) out[k] = scrub(v, depth + 1);
      } else if (/date|type|action|val|stage|group|^id$|deal|status|^meta$|total|^d_/i.test(k)) {
        out[k] = typeof v === "string" ? v.slice(0, 60) : v;
      } else {
        out[k] = "…";
      }
    }
    return out;
  }
  return value;
}

const total = (r: { body: unknown }) => (r.body as Meta)?.meta?.total ?? null;

/** Comprueba si la API entrega el historial de cambios de etapa/embudo de un trato y los filtros por fecha. */
export async function probeDealHistory(pipelineId: string) {
  const g = encodeURIComponent(pipelineId);
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const recent = await acRaw(`deals?filters[group]=${g}&orders[mdate]=DESC&limit=3`);
  const deals = ((recent.body as { deals?: Record<string, unknown>[] })?.deals ?? []).map((d) => ({
    id: String(d.id),
    stage: d.stage,
    group: d.group,
    cdate: d.cdate,
    mdate: d.mdate,
    edate: d.edate,
  }));
  const dealId = deals[0]?.id;
  const history = dealId
    ? [
        await acRaw(`deals/${dealId}/dealActivities?limit=15`),
        await acRaw(`dealActivities?filters[deal]=${dealId}&limit=15`),
        await acRaw(`deals/${dealId}/dealStageHistories`),
      ]
    : [];
  const filters = [
    await acRaw(`deals?filters[group]=${g}&limit=1`),
    await acRaw(`deals?filters[group]=${g}&filters[updated_after]=${weekAgo}&limit=1`),
    await acRaw(`deals?filters[group]=${g}&filters[created_after]=${weekAgo}&limit=1`),
  ];
  return {
    pipelineId,
    recentStatus: recent.status,
    deals,
    history: history.map((h) => ({ path: h.path.replace(`/${dealId}/`, "/{id}/").replace(`=${dealId}&`, "={id}&"), status: h.status, body: scrub(h.body) })),
    filters: filters.map((f) => ({ path: f.path, status: f.status, total: total(f) })),
  };
}
