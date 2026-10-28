import "server-only";
import { acGet, acGetAll } from "./client";
import type { AcMeta, DealNote, DealRecord, DealStatus, SyncProgress, SyncState } from "./types";
import {
  countDeals,
  deleteDealsNotSeenIn,
  getSyncState,
  listDealsToEnrich,
  saveAcMeta,
  saveEnrichedDeal,
  saveSyncState,
  upsertDealBase,
} from "@/lib/domain/deals";

// The sync runs in small resumable steps so each server action stays well under the
// serverless timeout. The client keeps calling runSyncStep() until phase is "done".
const STEP_BUDGET_MS = 18_000;
const DEALS_PAGE_SIZE = 100;
const ENRICH_BATCH = 6;

type RawDeal = {
  id: string;
  title?: string;
  value?: string;
  currency?: string;
  status?: string | number;
  group?: string;
  stage?: string;
  owner?: string | null;
  contact?: string | null;
  cdate?: string;
  mdate?: string;
  edate?: string | null;
  activitycount?: string | number;
};

const STATUS: Record<string, DealStatus> = { "0": "open", "1": "won", "2": "lost" };

function toIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function mapDeal(raw: RawDeal): DealRecord {
  const createdAt = toIso(raw.cdate) ?? new Date().toISOString();
  const status = STATUS[String(raw.status ?? "0")] ?? "open";
  return {
    id: String(raw.id),
    title: raw.title ?? "",
    // AC stores deal values in cents.
    value: Number(raw.value ?? 0) / 100,
    currency: (raw.currency ?? "mxn").toUpperCase(),
    status,
    pipelineId: String(raw.group ?? ""),
    stageId: String(raw.stage ?? ""),
    ownerId: raw.owner ? String(raw.owner) : null,
    contactId: raw.contact ? String(raw.contact) : null,
    contactName: null,
    contactEmail: null,
    contactPhone: null,
    createdAt,
    updatedAt: toIso(raw.mdate),
    stageEnteredAt: null,
    closedAt: status === "open" ? null : toIso(raw.edate) ?? toIso(raw.mdate),
    stageChanges: 0,
    activityCount: Number(raw.activitycount ?? 0),
    lastActivityAt: null,
    notesCount: 0,
    firstNote: null,
    lastNote: null,
    dealFields: {},
    contactFields: {},
    enriched: false,
  };
}

async function fetchMeta(): Promise<AcMeta> {
  type G = { id: string; title: string };
  type S = { id: string; title: string; group: string; order?: string };
  type U = { id: string; firstName?: string; lastName?: string; username?: string; email?: string };
  type DF = { id: string; fieldLabel: string; personalization?: string };
  type CF = { id: string; title: string; perstag?: string };

  const [groups, stages, users, dealFields, contactFields] = await Promise.all([
    acGetAll<G>("/dealGroups", "dealGroups"),
    acGetAll<S>("/dealStages", "dealStages"),
    acGetAll<U>("/users", "users"),
    acGetAll<DF>("/dealCustomFieldMeta", "dealCustomFieldMeta").catch(() => []),
    acGetAll<CF>("/fields", "fields").catch(() => []),
  ]);

  return {
    pipelines: groups.map((g) => ({ id: String(g.id), title: g.title })),
    stages: stages.map((s) => ({
      id: String(s.id),
      title: s.title,
      pipelineId: String(s.group),
      order: Number(s.order ?? 0),
    })),
    users: users.map((u) => ({
      id: String(u.id),
      name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || u.email || `Usuario ${u.id}`,
      email: u.email ?? "",
    })),
    dealFields: dealFields.map((f) => ({
      id: String(f.id),
      label: f.fieldLabel,
      key: f.personalization ?? "",
    })),
    contactFields: contactFields.map((f) => ({
      id: String(f.id),
      label: f.title,
      key: f.perstag ?? "",
    })),
    fetchedAt: new Date().toISOString(),
  };
}

// Pulls notes, activity log, deal custom fields and contact info for one deal.
async function enrichDeal(deal: DealRecord): Promise<DealRecord> {
  type Note = { note?: string; cdate?: string; userid?: string | null };
  type Activity = { dataType?: string; cdate?: string };
  type CfValue = { dealId?: string; customFieldId?: string; custom_field_id?: string; fieldValue?: unknown };
  type Contact = {
    contact?: { firstName?: string; lastName?: string; email?: string; phone?: string };
    fieldValues?: { field: string; value: string | null }[];
  };

  const [notesRes, activityRes, cfRes, contactRes] = await Promise.allSettled([
    acGet<{ notes?: Note[] }>(`/deals/${deal.id}/notes`, { limit: 100 }),
    acGet<{ dealActivities?: Activity[] }>(`/deals/${deal.id}/dealActivities`, { limit: 100 }),
    acGet<{ dealCustomFieldData?: CfValue[] }>("/dealCustomFieldData", {
      "filters[dealId]": deal.id,
      limit: 100,
    }),
    deal.contactId ? acGet<Contact>(`/contacts/${deal.contactId}`) : Promise.resolve(null),
  ]);

  const next: DealRecord = { ...deal, enriched: true };

  if (notesRes.status === "fulfilled") {
    const notes: DealNote[] = (notesRes.value.notes ?? [])
      .map((n) => ({
        text: (n.note ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
        at: toIso(n.cdate) ?? "",
        userId: n.userid ? String(n.userid) : null,
      }))
      .filter((n) => n.at)
      .sort((a, b) => a.at.localeCompare(b.at));
    next.notesCount = notes.length;
    next.firstNote = notes[0] ?? null;
    next.lastNote = notes.at(-1) ?? null;
  }

  let lastActivity = next.lastNote?.at ?? null;
  if (activityRes.status === "fulfilled") {
    const activities = activityRes.value.dealActivities ?? [];
    let stageEnteredAt: string | null = null;
    let closedAt: string | null = null;
    let stageChanges = 0;
    for (const a of activities) {
      const at = toIso(a.cdate);
      if (!at) continue;
      if (!lastActivity || at > lastActivity) lastActivity = at;
      if (a.dataType === "d_stageid") {
        stageChanges++;
        if (!stageEnteredAt || at > stageEnteredAt) stageEnteredAt = at;
      }
      if (a.dataType === "d_status" && (!closedAt || at > closedAt)) closedAt = at;
    }
    next.stageChanges = stageChanges;
    next.stageEnteredAt = stageEnteredAt;
    if (deal.status !== "open" && closedAt) next.closedAt = closedAt;
    next.activityCount = Math.max(deal.activityCount, activities.length);
  }
  next.stageEnteredAt ??= deal.createdAt;
  next.lastActivityAt = lastActivity;

  if (cfRes.status === "fulfilled") {
    const fields: Record<string, string> = {};
    for (const v of cfRes.value.dealCustomFieldData ?? []) {
      if (v.dealId && String(v.dealId) !== deal.id) continue;
      const fieldId = v.customFieldId ?? v.custom_field_id;
      const value = Array.isArray(v.fieldValue) ? v.fieldValue.join(", ") : v.fieldValue;
      if (fieldId && value !== null && value !== undefined && value !== "") {
        fields[String(fieldId)] = String(value);
      }
    }
    next.dealFields = fields;
  }

  if (contactRes.status === "fulfilled" && contactRes.value) {
    const c = contactRes.value.contact;
    next.contactName = [c?.firstName, c?.lastName].filter(Boolean).join(" ") || null;
    next.contactEmail = c?.email || null;
    next.contactPhone = c?.phone || null;
    const fields: Record<string, string> = {};
    for (const fv of contactRes.value.fieldValues ?? []) {
      if (fv.value) fields[String(fv.field)] = fv.value.replace(/^\|\||\|\|$/g, "").replace(/\|\|/g, ", ");
    }
    next.contactFields = fields;
  }

  return next;
}

async function progress(state: SyncState): Promise<SyncProgress> {
  const counts = await countDeals();
  return {
    phase: state.phase,
    totalDeals: counts.total,
    pendingEnrich: counts.pending,
    lastSyncedAt: state.lastSyncedAt,
    error: state.error,
  };
}

export async function getSyncProgress(): Promise<SyncProgress> {
  return progress(await getSyncState());
}

// mode "full" re-reads every deal (and drops deleted ones); "incremental" only deals updated
// since the last finished sync; "continue" resumes whatever run is in progress.
export async function runSyncStep(mode: "full" | "incremental" | "continue"): Promise<SyncProgress> {
  const deadline = Date.now() + STEP_BUDGET_MS;
  let state = await getSyncState();

  const inProgress = state.phase === "meta" || state.phase === "deals" || state.phase === "enrich";
  if (mode !== "continue" || !inProgress) {
    if (mode === "continue") return progress(state);
    const full = mode === "full" || !state.lastSyncedAt;
    state = {
      ...state,
      phase: "meta",
      runId: crypto.randomUUID(),
      full,
      since: full ? null : state.lastSyncedAt,
      offset: 0,
      startedAt: new Date().toISOString(),
      error: null,
    };
  }

  state = { ...state, error: null };
  try {
    while (Date.now() < deadline && state.phase !== "done") {
      if (state.phase === "meta") {
        await saveAcMeta(await fetchMeta());
        state = { ...state, phase: "deals", offset: 0 };
      } else if (state.phase === "deals") {
        const page = await acGet<{ deals?: (RawDeal & { mdate?: string })[] }>("/deals", {
          limit: DEALS_PAGE_SIZE,
          offset: state.offset,
          "orders[cdate]": "ASC",
          "filters[updated_after]": state.since ? state.since.slice(0, 19).replace("T", " ") : undefined,
        });
        const deals = page.deals ?? [];
        for (const raw of deals) {
          await upsertDealBase(mapDeal(raw), raw.mdate ?? null, state.runId!);
        }
        state = { ...state, offset: state.offset + deals.length };
        if (deals.length < DEALS_PAGE_SIZE) {
          if (state.full) await deleteDealsNotSeenIn(state.runId!);
          state = { ...state, phase: "enrich" };
        }
      } else if (state.phase === "enrich") {
        const batch = await listDealsToEnrich(ENRICH_BATCH);
        if (batch.length === 0) {
          state = { ...state, phase: "done", lastSyncedAt: state.startedAt };
          break;
        }
        const enriched = await Promise.all(batch.map(enrichDeal));
        for (const d of enriched) await saveEnrichedDeal(d);
      } else {
        break;
      }
    }
  } catch (err) {
    state = { ...state, error: err instanceof Error ? err.message : String(err) };
    await saveSyncState(state);
    return progress(state);
  }

  await saveSyncState(state);
  return progress(state);
}
