-- Conocimiento (Vault): base de notas en Markdown de toda la organización.
-- Hay un vault por organización; se guarda en el equipo ancla (el primero creado), como el V/TO.
CREATE TABLE vaults (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL UNIQUE REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Conocimiento',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE vault_notes (
  id SERIAL PRIMARY KEY,
  vault_id INTEGER NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  -- Ruta con carpetas, p. ej. "procesos/onboarding-clientes.md".
  path TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  frontmatter JSONB NOT NULL DEFAULT '{}'::jsonb,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Control de concurrencia: se guarda solo si la versión no cambió.
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (vault_id, path)
);
CREATE INDEX vault_notes_title_idx ON vault_notes (vault_id, lower(title));

-- Enlaces salientes de cada nota: [[Nota]] (kind "note", destino normalizado) y [[rock:…]], [[issue:…]], [[kpi:…]].
CREATE TABLE vault_links (
  from_note_id INTEGER NOT NULL REFERENCES vault_notes(id) ON DELETE CASCADE,
  vault_id INTEGER NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  target TEXT NOT NULL,
  -- Entidad EOS resuelta (id del rock, issue o indicador).
  entity_id INTEGER
);
CREATE INDEX vault_links_target_idx ON vault_links (vault_id, kind, target);
CREATE INDEX vault_links_from_idx ON vault_links (from_note_id);
CREATE INDEX vault_links_entity_idx ON vault_links (kind, entity_id);

-- Historial simple: una versión por sesión de edición (cada 10 minutos o al cambiar de autor).
CREATE TABLE vault_note_versions (
  id SERIAL PRIMARY KEY,
  note_id INTEGER NOT NULL REFERENCES vault_notes(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  path TEXT NOT NULL,
  content TEXT NOT NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX vault_note_versions_note_idx ON vault_note_versions (note_id, id DESC);
