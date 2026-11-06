-- Búsqueda del vault.
-- 1) Texto completo: título, tags y contenido "plegados" (minúsculas y sin acentos, 1 a 1 con el original
--    para poder recortar fragmentos), indexados con tsvector (configuración 'simple').
ALTER TABLE vault_notes ADD COLUMN search_title TEXT;
ALTER TABLE vault_notes ADD COLUMN search_tags TEXT;
ALTER TABLE vault_notes ADD COLUMN search_body TEXT;
ALTER TABLE vault_notes ADD COLUMN search_vec tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', coalesce(search_title, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(search_tags, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(search_body, '')), 'C')
) STORED;
CREATE INDEX vault_notes_search_idx ON vault_notes USING GIN (search_vec);

-- 2) Búsqueda por significado: los vectores (384 números) se calculan en el navegador de quien edita
--    (modelo multilingual-e5-small) y se guardan por fragmento; la nota guarda el promedio.
ALTER TABLE vault_notes ADD COLUMN embedding REAL[];
ALTER TABLE vault_notes ADD COLUMN embedded_version INTEGER;

CREATE TABLE vault_chunks (
  id SERIAL PRIMARY KEY,
  note_id INTEGER NOT NULL REFERENCES vault_notes(id) ON DELETE CASCADE,
  vault_id INTEGER NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  embedding REAL[] NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (note_id, chunk_index)
);
CREATE INDEX vault_chunks_vault_idx ON vault_chunks (vault_id);
