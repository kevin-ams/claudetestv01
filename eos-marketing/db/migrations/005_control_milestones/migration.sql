-- Hitos de Control de carrera configurables por equipo (Ajustes).
CREATE TABLE control_milestones (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  stage TEXT NOT NULL,                     -- definicion | produccion | activacion | mejora
  label TEXT NOT NULL,
  actions TEXT NOT NULL DEFAULT '',
  done_when TEXT NOT NULL DEFAULT '',
  days INTEGER NOT NULL DEFAULT 1,
  depends_on JSONB NOT NULL DEFAULT '[]',  -- claves de hitos anteriores
  is_launch BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (team_id, key)
);
CREATE INDEX idx_control_milestones_team ON control_milestones(team_id);
