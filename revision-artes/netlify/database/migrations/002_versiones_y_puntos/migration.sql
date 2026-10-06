-- Historial de versiones de cada arte (enlace de Drive por versión) y
-- puntos marcados sobre la imagen por las facultades.

CREATE TABLE arte_versiones (
  id SERIAL PRIMARY KEY,
  arte_id INTEGER NOT NULL REFERENCES artes(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  drive_url TEXT NOT NULL,
  nota TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (arte_id, version)
);

-- Los artes existentes conservan su versión actual (las anteriores no
-- tenían el enlace guardado).
INSERT INTO arte_versiones (arte_id, version, drive_url, created_at)
SELECT id, version, drive_url, updated_at FROM artes;

-- Cada punto pertenece a una revisión (quién y cuándo) y a una versión.
-- x / y son porcentajes sobre el ancho y alto de la imagen.
CREATE TABLE anotaciones (
  id SERIAL PRIMARY KEY,
  arte_id INTEGER NOT NULL REFERENCES artes(id) ON DELETE CASCADE,
  revision_id INTEGER NOT NULL REFERENCES revisiones(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  numero INTEGER NOT NULL,
  x REAL NOT NULL CHECK (x >= 0 AND x <= 100),
  y REAL NOT NULL CHECK (y >= 0 AND y <= 100),
  comentario TEXT NOT NULL,
  atendida BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX anotaciones_arte_idx ON anotaciones(arte_id, version);
