import "server-only";
import { acGet, getCareerFieldId } from "@/lib/integrations/activecampaign";
import {
  countDeals,
  deleteDealsNotSeenIn,
  getDashSettings,
  getSyncState,
  listDealsToEnrich,
  saveDashMeta,
  saveEnrichedDeals,
  saveSyncState,
  upsertDealsBase,
} from "./deals";
import { normKey, type DashMeta, type DealNote, type DealRecord, type DealStatus, type SyncProgress, type SyncState } from "./deals-shared";

/**
 * Sincronización del Dashboard de tratos, en pasos cortos que se retoman donde quedaron
 * (cada llamada trabaja unos segundos). La llaman el botón "Sincronizar" (en bucle desde el
 * navegador) y la función programada de cada hora.
 *
 * 1. meta: embudos, etapas, usuarios y campos personalizados.
 * 2. deals: tratos (con sus campos personalizados). La primera vez, los creados en los últimos
 *    meses de Ajustes; después, solo los modificados desde la última sincronización.
 * 3. enrich: por cada trato nuevo o modificado, notas, historial de etapas y datos del contacto.
 */

const PAGE = 100;
const ENRICH_BATCH = 5;

type RawDeal = {
  id: string;
  title?: string;
  value?: string;
  status?: string | number;
  group?: string;
  stage?: string;
  owner?: string | null;
  contact?: string | null;
  cdate?: string;
  mdate?: string;
  edate?: string | null;
};

const STATUS: Record<string, DealStatus> = { "0": "open", "1": "won", "2": "lost" };

function toIso(value: unknown): string | null {
  if (!value) return null;
  const s = String(value);
  const d = new Date(s.includes("T") ? s : s.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function listAll<T>(path: string, key: string): Promise<T[]> {
  const out: T[] = [];
  for (let offset = 0; offset < 20000; offset += PAGE) {
    const sep = path.includes("?") ? "&" : "?";
    const r = await acGet<Record<string, T[]>>(`${path}${sep}limit=${PAGE}&offset=${offset}`);
    const items = r[key] ?? [];
    out.push(...items);
    if (items.length < PAGE) break;
  }
  return out;
}

async function fetchMeta(): Promise<DashMeta> {
  const [groups, stages, users, dealFields, contactFields, careerFieldId] = await Promise.all([
    listAll<{ id: string; title: string }>("dealGroups", "dealGroups"),
    listAll<{ id: string; title: string; group: string; order?: string }>("dealStages", "dealStages"),
    listAll<{ id: string; firstName?: string; lastName?: string; username?: string; email?: string }>("users", "users"),
    listAll<{ id: string; fieldLabel: string; personalization?: string }>("dealCustomFieldMeta", "dealCustomFieldMeta").catch(() => []),
    listAll<{ id: string; title: string; perstag?: string }>("fields", "fields").catch(() => []),
    getCareerFieldId().catch(() => null),
  ]);
  return {
    pipelines: groups.map((g) => ({ id: String(g.id), title: g.title })).sort((a, b) => a.title.localeCompare(b.title, "es")),
    stages: stages.map((s) => ({
      id: String(s.id),
      title: s.title,
      key: normKey(s.title),
      pipelineId: String(s.group),
      order: Number(s.order ?? 0),
    })),
    users: users.map((u) => ({
      id: String(u.id),
      name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || u.email || `Usuario ${u.id}`,
    })),
    dealFields: dealFields.map((f) => ({ id: String(f.id), label: f.fieldLabel, key: f.personalization ?? "" })),
    contactFields: contactFields.map((f) => ({ id: String(f.id), label: f.title, key: f.perstag ?? "" })),
    careerFieldId,
    fetchedAt: new Date().toISOString(),
  };
}

/** Campos personalizados de cada trato de la página (include=dealCustomFieldData). */
function customFieldsByDeal(rows: Record<string, unknown>[] | undefined): Map<string, Record<string, string>> {
  const out = new Map<string, Record<string, string>>();
  for (const d of rows ?? []) {
    const field = String(d.custom_field_id ?? d.dealCustomFieldMetum ?? d.customFieldId ?? "");
    const deal = String(d.deal_id ?? d.deal ?? d.dealId ?? "");
    const raw =
      d.custom_field_text_value ?? d.custom_field_text_blob ?? d.custom_field_number_value ?? d.custom_field_date_value ?? d.fieldValue ?? "";
    const value = (Array.isArray(raw) ? raw.join(", ") : String(raw ?? "")).trim();
    if (!field || !deal || !value) continue;
    const rec = out.get(deal) ?? {};
    rec[field] = value;
    out.set(deal, rec);
  }
  return out;
}

function mapDeal(raw: RawDeal, fields: Record<string, string>, careerFieldId: string | null): DealRecord {
  const status = STATUS[String(raw.status ?? "0")] ?? "open";
  return {
    id: String(raw.id),
    title: raw.title ?? "",
    value: Number(raw.value ?? 0) / 100, // ActiveCampaign guarda el valor en centavos
    status,
    pipelineId: String(raw.group ?? ""),
    stageId: String(raw.stage ?? ""),
    ownerId: raw.owner ? String(raw.owner) : null,
    contactId: raw.contact ? String(raw.contact) : null,
    contactName: null,
    contactEmail: null,
    createdAt: toIso(raw.cdate) ?? new Date().toISOString(),
    updatedAt: toIso(raw.mdate),
    careerValue: careerFieldId ? (fields[careerFieldId] ?? "") : "",
    dealFields: fields,
    stageEnteredAt: null,
    closedAt: status === "open" ? null : (toIso(raw.edate) ?? toIso(raw.mdate)),
    lastActivityAt: null,
    notesCount: 0,
    firstNote: null,
    lastNote: null,
    contactFields: {},
    enriched: false,
  };
}

const cleanNote = (html: string) =>
  html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim().slice(0, 300);

/** Notas, historial de etapas y datos del contacto de un trato. */
async function enrichDeal(deal: DealRecord): Promise<DealRecord> {
  type Note = { note?: string; cdate?: string; userid?: string | null };
  type Activity = { dataType?: string; cdate?: string };
  type Contact = {
    contact?: { firstName?: string; lastName?: string; email?: string };
    fieldValues?: { field: string; value: string | null }[];
  };

  const activities = async () => {
    const out: Activity[] = [];
    for (let page = 0; page < 5; page++) {
      const r = await acGet<{ dealActivities?: Activity[] }>(`deals/${deal.id}/dealActivities?limit=${PAGE}&offset=${page * PAGE}`);
      const rows = r.dealActivities ?? [];
      out.push(...rows);
      if (rows.length < PAGE) break;
    }
    return out;
  };

  const [notesRes, activityRes, contactRes] = await Promise.allSettled([
    acGet<{ notes?: Note[] }>(`deals/${deal.id}/notes?limit=${PAGE}`),
    activities(),
    deal.contactId ? acGet<Contact>(`contacts/${deal.contactId}`) : Promise.resolve(null),
  ]);
  const next: DealRecord = { ...deal, enriched: true };

  if (notesRes.status === "fulfilled") {
    const notes: DealNote[] = (notesRes.value.notes ?? [])
      .map((n) => ({ text: cleanNote(n.note ?? ""), at: toIso(n.cdate) ?? "", userId: n.userid ? String(n.userid) : null }))
      .filter((n) => n.at)
      .sort((a, b) => a.at.localeCompare(b.at));
    next.notesCount = notes.length;
    next.firstNote = notes[0] ?? null;
    next.lastNote = notes.at(-1) ?? null;
  }

  let last = next.lastNote?.at ?? null;
  if (activityRes.status === "fulfilled") {
    let entered: string | null = null;
    let closed: string | null = null;
    for (const a of activityRes.value) {
      const at = toIso(a.cdate);
      if (!at) continue;
      if (!last || at > last) last = at;
      if (a.dataType === "d_stageid" && (!entered || at > entered)) entered = at;
      if (a.dataType === "d_status" && (!closed || at > closed)) closed = at;
    }
    next.stageEnteredAt = entered;
    if (deal.status !== "open" && closed) next.closedAt = closed;
  }
  next.stageEnteredAt ??= deal.createdAt;
  next.lastActivityAt = last;

  if (contactRes.status === "fulfilled" && contactRes.value) {
    const c = contactRes.value.contact;
    next.contactName = [c?.firstName, c?.lastName].filter(Boolean).join(" ") || null;
    next.contactEmail = c?.email || null;
    const fields: Record<string, string> = {};
    for (const fv of contactRes.value.fieldValues ?? []) {
      // Las opciones múltiples vienen como ||a||b||.
      const v = (fv.value ?? "").replace(/^\|\||\|\|$/g, "").replace(/\|\|/g, ", ").trim();
      if (v) fields[String(fv.field)] = v;
    }
    next.contactFields = fields;
  }
  return next;
}

async function progress(state: SyncState): Promise<SyncProgress> {
  const counts = await countDeals();
  return { phase: state.phase, totalDeals: counts.total, pendingEnrich: counts.pending, lastSyncedAt: state.lastSyncedAt, error: state.error };
}

export async function getSyncProgress(): Promise<SyncProgress> {
  return progress(await getSyncState());
}

const dateOnly = (iso: string) => iso.slice(0, 10);

function monthsAgo(months: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return dateOnly(d.toISOString());
}

/**
 * Un paso de sincronización de hasta `budgetMs`.
 * - "incremental": empieza una pasada con lo modificado desde la última (la primera vez, completa).
 * - "full": vuelve a leer todos los tratos del periodo y quita los que se borraron en AC.
 * - "continue": sigue la pasada en curso (si no hay, no hace nada).
 */
export async function runSyncStep(mode: "full" | "incremental" | "continue", budgetMs = 9000): Promise<SyncProgress> {
  const deadline = Date.now() + budgetMs;
  let state = await getSyncState();
  const running = state.phase === "meta" || state.phase === "deals" || state.phase === "enrich";

  if (mode === "continue" && !running) return progress(state);
  if (mode !== "continue" || !running) {
    const full = mode === "full" || !state.lastSyncedAt;
    state = {
      ...state,
      phase: "meta",
      runId: crypto.randomUUID(),
      full,
      // Un día de margen: el filtro de AC es por fecha, sin hora.
      since: full ? null : dateOnly(new Date(Date.parse(state.lastSyncedAt!) - 864e5).toISOString()),
      offset: 0,
      startedAt: new Date().toISOString(),
    };
  }
  state = { ...state, error: null };

  try {
    const settings = await getDashSettings();
    const createdSince = monthsAgo(settings.historyMonths);
    let careerFieldId: string | null = null;

    while (Date.now() < deadline && state.phase !== "done") {
      if (state.phase === "meta") {
        await saveDashMeta(await fetchMeta());
        state = { ...state, phase: "deals", offset: 0 };
      } else if (state.phase === "deals") {
        careerFieldId ??= await getCareerFieldId().catch(() => null);
        const filter = state.since
          ? `filters[updated_after]=${state.since}`
          : `filters[created_after]=${createdSince}`;
        const r = await acGet<{ deals?: RawDeal[]; dealCustomFieldData?: Record<string, unknown>[] }>(
          `deals?${filter}&orders[cdate]=ASC&limit=${PAGE}&offset=${state.offset}&include=dealCustomFieldData`
        );
        const deals = r.deals ?? [];
        const fields = customFieldsByDeal(r.dealCustomFieldData);
        await upsertDealsBase(
          deals.map((raw) => ({ deal: mapDeal(raw, fields.get(String(raw.id)) ?? {}, careerFieldId), mdate: raw.mdate ?? null })),
          state.runId!
        );
        state = { ...state, offset: state.offset + deals.length };
        if (deals.length < PAGE) {
          if (state.full) await deleteDealsNotSeenIn(state.runId!, createdSince);
          state = { ...state, phase: "enrich" };
        }
      } else if (state.phase === "enrich") {
        const batch = await listDealsToEnrich(ENRICH_BATCH);
        if (!batch.length) {
          state = { ...state, phase: "done", lastSyncedAt: state.startedAt };
          break;
        }
        await saveEnrichedDeals(await Promise.all(batch.map(enrichDeal)));
      } else {
        break;
      }
    }
  } catch (err) {
    state = { ...state, error: err instanceof Error ? err.message : String(err) };
  }

  await saveSyncState(state);
  return progress(state);
}
