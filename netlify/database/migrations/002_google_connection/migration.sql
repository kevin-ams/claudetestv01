-- Conexión OAuth con Google para leer la hoja de la campaña de llamadas.
-- Una sola fila por proveedor; el refresh token se guarda cifrado con AUTH_SECRET.

CREATE TABLE google_connections (
  id TEXT PRIMARY KEY,
  refresh_token_enc TEXT NOT NULL,
  google_email TEXT,
  connected_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
