-- Dashboard de tratos: copia local de los tratos de ActiveCampaign (con notas, actividad y
-- datos del contacto) para analizarlos por embudo, etapa, carrera, facultad, asesor y UTM.
CREATE TABLE ac_dash_meta (
  key TEXT PRIMARY KEY,                     -- meta | settings | sync_state
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ac_deals (
  id TEXT PRIMARY KEY,
  pipeline_id TEXT NOT NULL,
  created_at TIMESTAMPTZ,
  mdate TEXT,                               -- última modificación en AC (si cambia, se vuelve a leer el detalle)
  data JSONB NOT NULL DEFAULT '{}',
  needs_enrich BOOLEAN NOT NULL DEFAULT TRUE,
  seen_run TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ac_deals_created ON ac_deals(created_at);
CREATE INDEX idx_ac_deals_enrich ON ac_deals(needs_enrich) WHERE needs_enrich;
