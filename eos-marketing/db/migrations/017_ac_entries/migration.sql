-- Leads calificados desde ActiveCampaign: fecha en que cada trato entró por primera vez a un
-- embudo vinculado (sale del historial de cambios de etapa del trato). El lead de la semana es
-- la cantidad de tratos que entraron al embudo en esa semana, filtrados por carrera.
CREATE TABLE ac_deal_entries (
  deal_id TEXT NOT NULL,
  pipeline_id TEXT NOT NULL,
  career_value TEXT NOT NULL DEFAULT '',
  career_norm TEXT NOT NULL DEFAULT '',    -- sin tildes ni mayúsculas, para comparar
  entered_at TIMESTAMPTZ,                   -- NULL = no se encontró la entrada al embudo
  deal_mdate TEXT NOT NULL DEFAULT '',      -- última modificación revisada (si cambia, se vuelve a revisar)
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (deal_id, pipeline_id)
);
CREATE INDEX idx_ac_deal_entries_pipeline ON ac_deal_entries(pipeline_id, entered_at);

-- Avance de la revisión de cada embudo (se retoma donde quedó).
CREATE TABLE ac_pipeline_scans (
  pipeline_id TEXT PRIMARY KEY,
  since_date TEXT NOT NULL,                 -- revisar tratos modificados desde esta fecha (AAAA-MM-DD)
  page_offset INTEGER NOT NULL DEFAULT 0,
  next_since TEXT NOT NULL DEFAULT '',      -- fecha de modificación más reciente vista en esta pasada
  scanned_at TIMESTAMPTZ,                   -- última vez que se terminó de revisar
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
