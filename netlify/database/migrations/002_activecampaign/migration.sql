-- ActiveCampaign deals dashboard: local snapshot of deals synced from the AC API

CREATE TABLE ac_meta (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ac_deals (
  id TEXT PRIMARY KEY,
  pipeline_id TEXT NOT NULL,
  created_at TIMESTAMPTZ,
  mdate TEXT,
  data JSONB NOT NULL DEFAULT '{}',
  needs_enrich BOOLEAN NOT NULL DEFAULT TRUE,
  seen_run TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ac_deals_pipeline_idx ON ac_deals (pipeline_id, created_at);
CREATE INDEX ac_deals_needs_enrich_idx ON ac_deals (needs_enrich) WHERE needs_enrich;
