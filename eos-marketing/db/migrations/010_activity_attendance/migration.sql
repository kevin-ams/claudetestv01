-- Bitácora de acciones importantes (Ajustes > Log).
CREATE TABLE activity_log (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL DEFAULT '',
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_activity_team_time ON activity_log(team_id, created_at DESC);

-- Reunión L10: lista de asistencia y quién la dirige.
CREATE TABLE meeting_attendees (
  meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  present BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (meeting_id, user_id)
);
ALTER TABLE meetings ADD COLUMN leader_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
UPDATE meetings SET leader_id = created_by;

-- Respaldos descargados y restaurados (Ajustes > Diagnóstico). No se incluye en los respaldos.
CREATE TABLE backup_events (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL,                -- 'download' | 'restore'
  user_id INTEGER,
  user_name TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
