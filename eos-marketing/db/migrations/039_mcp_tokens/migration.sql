-- Conexión con Claude (servidor MCP en /api/mcp): tokens personales, guardados solo como hash.
-- Cada token actúa como la persona que lo creó, en su equipo, con los permisos de su rol:
--   scope 'vault' = solo el vault (Conocimiento) · scope 'eos' = vault + EOS completo.
--   can_write = puede crear/editar (si su rol también lo permite).
CREATE TABLE api_tokens (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  -- Primeros caracteres, para reconocerlo en la lista.
  prefix TEXT NOT NULL,
  label TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'vault',
  can_write BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  use_count INTEGER NOT NULL DEFAULT 0,
  -- Límite de uso: peticiones en la ventana del minuto actual.
  window_start TIMESTAMPTZ,
  window_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX api_tokens_team_idx ON api_tokens (team_id);

-- Enlace al "Consultor IA" en Claude (artefacto que usa el conector MCP); vacío = no se muestra el botón.
ALTER TABLE vaults ADD COLUMN claude_consultant_url TEXT;
