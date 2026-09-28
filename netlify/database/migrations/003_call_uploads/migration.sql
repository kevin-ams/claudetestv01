-- La campaña de llamadas ya no se lee de Google: se sube el archivo Excel desde el dashboard.

DROP TABLE IF EXISTS google_connections;

CREATE TABLE call_uploads (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  -- Pestañas del libro tal cual: [{ "title": "...", "values": [["CARRERA", ...], ...] }]
  sheets JSONB NOT NULL,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX call_uploads_team_idx ON call_uploads (team_id, uploaded_at DESC);
