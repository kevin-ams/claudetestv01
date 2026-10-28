// Shared types for the ActiveCampaign deals dashboard (safe to import from client components).

export type DealStatus = "open" | "won" | "lost";

export type AcPipeline = { id: string; title: string };
export type AcStage = { id: string; title: string; pipelineId: string; order: number };
export type AcUser = { id: string; name: string; email: string };
export type AcField = { id: string; label: string; key: string };

export type AcMeta = {
  pipelines: AcPipeline[];
  stages: AcStage[];
  users: AcUser[];
  dealFields: AcField[];
  contactFields: AcField[];
  fetchedAt: string | null;
};

export type DealNote = { text: string; at: string; userId: string | null };

export type DealRecord = {
  id: string;
  title: string;
  value: number;
  currency: string;
  status: DealStatus;
  pipelineId: string;
  stageId: string;
  ownerId: string | null;
  contactId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  createdAt: string;
  updatedAt: string | null;
  // Fields below come from the per-deal enrichment step.
  stageEnteredAt: string | null;
  closedAt: string | null;
  stageChanges: number;
  activityCount: number;
  lastActivityAt: string | null;
  notesCount: number;
  firstNote: DealNote | null;
  lastNote: DealNote | null;
  dealFields: Record<string, string>;
  contactFields: Record<string, string>;
  enriched: boolean;
};

export const FIELD_KEYS = [
  "career",
  "utm_source",
  "utm_medium",
  "utm_term",
  "utm_campaign",
  "lead_classification",
] as const;

export type FieldKey = (typeof FIELD_KEYS)[number];

export const FIELD_LABELS: Record<FieldKey, string> = {
  career: "Carrera (career)",
  utm_source: "UTM Source",
  utm_medium: "UTM Medium",
  utm_term: "UTM Term",
  utm_campaign: "UTM Campaign",
  lead_classification: "Clasificación del lead (chat)",
};

export type FieldRef = { source: "deal" | "contact"; id: string } | null;
export type FieldMap = Record<FieldKey, FieldRef>;

export type DashboardSettings = {
  // Days in the same stage after which an open deal counts as "estancado".
  staleDays: number;
};

export type SyncPhase = "idle" | "meta" | "deals" | "enrich" | "done" | "error";

export type SyncState = {
  phase: SyncPhase;
  runId: string | null;
  full: boolean;
  since: string | null;
  offset: number;
  startedAt: string | null;
  lastSyncedAt: string | null;
  error: string | null;
};

export type SyncProgress = {
  phase: SyncPhase;
  totalDeals: number;
  pendingEnrich: number;
  lastSyncedAt: string | null;
  error: string | null;
};
