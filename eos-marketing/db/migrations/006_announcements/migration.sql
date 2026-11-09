-- Anuncios tipo popup (Ajustes > Anuncios): hasta 5 imágenes por equipo.
CREATE TABLE announcement_settings (
  team_id INTEGER PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  interval_minutes INTEGER NOT NULL DEFAULT 5
);

CREATE TABLE announcement_slots (
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 5),
  image BYTEA,
  mime TEXT,
  title TEXT NOT NULL DEFAULT '',
  link_url TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_id, slot)
);
