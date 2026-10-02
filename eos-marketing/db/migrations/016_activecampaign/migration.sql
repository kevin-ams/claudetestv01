-- Leads desde ActiveCampaign: cada carrera se vincula a un embudo y una etapa de tratos
-- (y, si el embudo tiene varias carreras, al valor del campo "Nombre de la Carrera").
CREATE TABLE career_ac_links (
  career_id INTEGER PRIMARY KEY REFERENCES careers(id) ON DELETE CASCADE,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  pipeline_id TEXT NOT NULL,
  pipeline_name TEXT NOT NULL DEFAULT '',
  stage_id TEXT NOT NULL,
  stage_name TEXT NOT NULL DEFAULT '',
  career_value TEXT NOT NULL DEFAULT '',   -- '' = todos los tratos de la etapa
  last_count INTEGER,
  last_synced_at TIMESTAMPTZ,
  last_error TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_career_ac_links_team ON career_ac_links(team_id);

ALTER TABLE teams ADD COLUMN ac_last_sync_at TIMESTAMPTZ;
ALTER TABLE teams ADD COLUMN ac_last_sync_detail TEXT NOT NULL DEFAULT '';
