-- Frases motivacionales del Dashboard (Ajustes > Frases). Una distinta cada día.
CREATE TABLE quotes (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_quotes_team ON quotes(team_id);
-- El banco inicial se copia una sola vez por equipo (aunque luego borren todas).
ALTER TABLE teams ADD COLUMN quotes_seeded BOOLEAN NOT NULL DEFAULT FALSE;
