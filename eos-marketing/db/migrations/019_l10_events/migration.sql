-- Eventos para la L10: se cargan antes de la reunión y se leen en el segmento de Noticias.
-- Se pueden enviar a la próxima L10 de otro equipo (se copia el evento a ese equipo).
CREATE TABLE l10_events (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,       -- equipo en cuya L10 se lee
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  event_date DATE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  from_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL,           -- si lo envió otro equipo
  origin_id INTEGER REFERENCES l10_events(id) ON DELETE SET NULL,        -- evento original (para "Enviado a")
  meeting_id INTEGER REFERENCES meetings(id) ON DELETE SET NULL,         -- L10 en que se leyó; NULL = pendiente
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_l10_events_team ON l10_events(team_id, meeting_id);
CREATE INDEX idx_l10_events_origin ON l10_events(origin_id);
