import "server-only";
import { db } from "@/lib/db";
import {
  DEFAULT_SETTINGS,
  type DashMeta,
  type DashSettings,
  type DealRecord,
  type SyncState,
} from "./deals-shared";

export const EMPTY_META: DashMeta = {
  pipelines: [],
  stages: [],
  users: [],
  dealFields: [],
  contactFields: [],
  careerFieldId: null,
  fetchedAt: null,
};

export const EMPTY_SYNC: SyncState = {
  phase: "idle",
  runId: null,
  full: false,
  since: null,
  offset: 0,
  startedAt: null,
  lastSyncedAt: null,
  error: null,
};

async function getValue<T extends object>(key: string, fallback: T): Promise<T> {
  const rows = (await db().sql`SELECT value FROM ac_dash_meta WHERE key = ${key}`) as { value: Partial<T> }[];
  return rows.length ? { ...fallback, ...rows[0].value } : fallback;
}

async function setValue(key: string, value: unknown) {
  await db().sql`
    INSERT INTO ac_dash_meta (key, value, updated_at) VALUES (${key}, ${JSON.stringify(value)}::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;
}

export const getDashMeta = () => getValue<DashMeta>("meta", EMPTY_META);
export const saveDashMeta = (meta: DashMeta) => setValue("meta", meta);
export const getSyncState = () => getValue<SyncState>("sync_state", EMPTY_SYNC);
export const saveSyncState = (s: SyncState) => setValue("sync_state", s);
export const getDashSettings = () => getValue<DashSettings>("settings", DEFAULT_SETTINGS);
export const saveDashSettings = (s: DashSettings) => setValue("settings", s);

/** Tratos creados entre dos fechas (AAAA-MM-DD, inclusive; se amplía un día por la zona horaria). */
export async function listDealsCreated(from: string, to: string): Promise<DealRecord[]> {
  const rows = (await db().sql`
    SELECT data FROM ac_deals
    WHERE created_at >= (${from}::date - INTERVAL '1 day') AND created_at < (${to}::date + INTERVAL '2 day')
  `) as { data: DealRecord }[];
  return rows.map((r) => r.data);
}

/** Valores de "Nombre de la Carrera" de los tratos guardados, por embudo, con cuántos tratos tiene cada uno. */
export async function careerValueCounts(): Promise<{ pipelineId: string; value: string; count: number }[]> {
  const rows = (await db().sql`
    SELECT pipeline_id, COALESCE(data->>'careerValue', '') AS value, COUNT(*)::int AS count FROM ac_deals
    GROUP BY 1, 2
  `) as { pipeline_id: string; value: string; count: number }[];
  return rows.map((r) => ({ pipelineId: r.pipeline_id, value: r.value, count: r.count }));
}

export async function countDeals(): Promise<{ total: number; pending: number }> {
  const rows = (await db().sql`
    SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE needs_enrich)::int AS pending FROM ac_deals
  `) as { total: number; pending: number }[];
  return rows[0] ?? { total: 0, pending: 0 };
}

/**
 * Guarda los datos básicos de una página de tratos. Lo que ya se leyó del detalle se conserva
 * (unión de JSONB); el trato se vuelve a leer solo si ActiveCampaign dice que cambió.
 */
export async function upsertDealsBase(deals: { deal: DealRecord; mdate: string | null }[], runId: string) {
  if (!deals.length) return;
  await db().batch(
    deals.map(({ deal, mdate }) => {
      const base = {
        id: deal.id,
        title: deal.title,
        value: deal.value,
        status: deal.status,
        pipelineId: deal.pipelineId,
        stageId: deal.stageId,
        ownerId: deal.ownerId,
        contactId: deal.contactId,
        createdAt: deal.createdAt,
        updatedAt: deal.updatedAt,
        careerValue: deal.careerValue,
        dealFields: deal.dealFields,
      };
      return {
        text: `
          INSERT INTO ac_deals (id, pipeline_id, created_at, mdate, data, needs_enrich, seen_run, synced_at)
          VALUES ($1, $2, $3, $4, $5::jsonb, TRUE, $6, NOW())
          ON CONFLICT (id) DO UPDATE SET
            pipeline_id = EXCLUDED.pipeline_id,
            created_at = EXCLUDED.created_at,
            data = ac_deals.data || $7::jsonb,
            needs_enrich = ac_deals.needs_enrich OR ac_deals.mdate IS DISTINCT FROM EXCLUDED.mdate,
            mdate = EXCLUDED.mdate,
            seen_run = EXCLUDED.seen_run,
            synced_at = NOW()`,
        params: [deal.id, deal.pipelineId, deal.createdAt, mdate, JSON.stringify(deal), runId, JSON.stringify(base)],
      };
    })
  );
}

/** Tras una sincronización completa: quita los tratos que ya no existen en ActiveCampaign. */
export async function deleteDealsNotSeenIn(runId: string, createdSince: string) {
  await db().sql`DELETE FROM ac_deals WHERE seen_run IS DISTINCT FROM ${runId} AND created_at >= ${createdSince}::date`;
}

export async function listDealsToEnrich(limit: number): Promise<DealRecord[]> {
  const rows = (await db().sql`
    SELECT data FROM ac_deals WHERE needs_enrich
    ORDER BY (data->>'status' = 'open') DESC, created_at DESC NULLS LAST
    LIMIT ${limit}
  `) as { data: DealRecord }[];
  return rows.map((r) => r.data);
}

export async function saveEnrichedDeals(deals: DealRecord[]) {
  if (!deals.length) return;
  await db().batch(
    deals.map((d) => ({
      text: `UPDATE ac_deals SET data = $1::jsonb, needs_enrich = FALSE, synced_at = NOW() WHERE id = $2`,
      params: [JSON.stringify(d), d.id],
    }))
  );
}
