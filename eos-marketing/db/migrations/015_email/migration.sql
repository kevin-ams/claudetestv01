-- Correos: enlaces para crear o restablecer contraseña y destinatarios de la planificación semanal.
CREATE TABLE password_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,         -- sha256 del token (el token solo viaja en el correo)
  purpose TEXT NOT NULL DEFAULT 'reset',   -- 'reset' | 'invite'
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_password_tokens_user ON password_tokens(user_id);

ALTER TABLE teams ADD COLUMN planning_recipients TEXT NOT NULL DEFAULT '';
