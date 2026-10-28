import "server-only";
import { db } from "@/lib/db";
import type {
  AcMeta,
  DashboardSettings,
  DealRecord,
  FieldMap,
  SyncState,
} from "@/lib/activecampaign/types";
import { FIELD_KEYS } from "@/lib/activecampaign/types";

export const EMPTY_META: AcMeta = {
  pipelines: [],
  stages: [],
  users: [],
  dealFields: [],
  contactFields: [],
  fetchedAt: null,
};

export const EMPTY_SYNC_STATE: SyncState = {
  phase: "idle",
  runId: null,
  full: false,
  since: null,
  offset: 0,
  startedAt: null,
  lastSyncedAt: null,
  error: null,
};

export const DEFAULT_SETTINGS: DashboardSettings = { staleDays: 7 };

async function getMetaValue<T>(key: string, fallback: T): Promise<T> {
  const rows = await db().sql`SELECT value FROM ac_meta WHERE key = ${key}`;
  if (rows.length === 0) return fallback;
  return { ...fallback, ...(rows[0] as { value: T }).value };
}

async function setMetaValue(key: string, value: unknown) {
  await db().sql`
    INSERT INTO ac_meta (key, value, updated_at) VALUES (${key}, ${JSON.stringify(value)}::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `;
}

export const getAcMeta = () => getMetaValue<AcMeta>("meta", EMPTY_META);
export const saveAcMeta = (meta: AcMeta) => setMetaValue("meta", meta);

export const getSyncState = () => getMetaValue<SyncState>("sync_state", EMPTY_SYNC_STATE);
export const saveSyncState = (state: SyncState) => setMetaValue("sync_state", state);

export const getDashboardSettings = () =>
  getMetaValue<DashboardSettings>("settings", DEFAULT_SETTINGS);
export const saveDashboardSettings = (s: DashboardSettings) => setMetaValue("settings", s);

export async function getFieldMap(): Promise<FieldMap | null> {
  const rows = await db().sql`SELECT value FROM ac_meta WHERE key = 'field_map'`;
  if (rows.length === 0) return null;
  const stored = (rows[0] as { value: Partial<FieldMap> }).value;
  return Object.fromEntries(FIELD_KEYS.map((k) => [k, stored[k] ?? null])) as FieldMap;
}
export const saveFieldMap = (map: FieldMap) => setMetaValue("field_map", map);

export async function listDeals(pipelineIds: string[]): Promise<DealRecord[]> {
  const rows =
    pipelineIds.length > 0
      ? await db().sql`SELECT data FROM ac_deals
          WHERE pipeline_id = ANY(string_to_array(${pipelineIds.join(",")}, ','))`
      : await db().sql`SELECT data FROM ac_deals`;
  return (rows as { data: DealRecord }[]).map((r) => r.data);
}

export async function countDeals(): Promise<{ total: number; pending: number }> {
  const rows = await db().sql`
    SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE needs_enrich)::int AS pending FROM ac_deals
  `;
  return rows[0] as { total: number; pending: number };
}

// Upserts the base fields of a deal. Enrichment data already stored is kept (JSONB merge);
// the deal is queued for re-enrichment only if AC reports it changed.
export async function upsertDealBase(deal: DealRecord, mdate: string | null, runId: string) {
  const base = {
    id: deal.id,
    title: deal.title,
    value: deal.value,
    currency: deal.currency,
    status: deal.status,
    pipelineId: deal.pipelineId,
    stageId: deal.stageId,
    ownerId: deal.ownerId,
    contactId: deal.contactId,
    createdAt: deal.createdAt,
    updatedAt: deal.updatedAt,
    activityCount: deal.activityCount,
  };
  await db().sql`
    INSERT INTO ac_deals (id, pipeline_id, created_at, mdate, data, needs_enrich, seen_run, synced_at)
    VALUES (${deal.id}, ${deal.pipelineId}, ${deal.createdAt}, ${mdate}, ${JSON.stringify(deal)}::jsonb, TRUE, ${runId}, NOW())
    ON CONFLICT (id) DO UPDATE SET
      pipeline_id = EXCLUDED.pipeline_id,
      created_at = EXCLUDED.created_at,
      data = ac_deals.data || ${JSON.stringify(base)}::jsonb,
      needs_enrich = ac_deals.needs_enrich OR ac_deals.mdate IS DISTINCT FROM EXCLUDED.mdate,
      mdate = EXCLUDED.mdate,
      seen_run = EXCLUDED.seen_run,
      synced_at = NOW()
  `;
}

export async function deleteDealsNotSeenIn(runId: string) {
  await db().sql`DELETE FROM ac_deals WHERE seen_run IS DISTINCT FROM ${runId}`;
}

export async function listDealsToEnrich(limit: number): Promise<DealRecord[]> {
  const rows = await db().sql`
    SELECT data FROM ac_deals WHERE needs_enrich
    ORDER BY (data->>'status' = 'open') DESC, created_at DESC NULLS LAST
    LIMIT ${limit}
  `;
  return (rows as { data: DealRecord }[]).map((r) => r.data);
}

export async function saveEnrichedDeal(deal: DealRecord) {
  await db().sql`
    UPDATE ac_deals SET data = ${JSON.stringify(deal)}::jsonb, needs_enrich = FALSE, synced_at = NOW()
    WHERE id = ${deal.id}
  `;
}
