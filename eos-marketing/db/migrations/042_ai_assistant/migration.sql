-- Etapa 8 · Asistente IA (premium). Topes por organización y por persona, registro de consumo y caché de respuestas.
ALTER TABLE organizations ADD COLUMN ai_monthly_cap_usd NUMERIC NOT NULL DEFAULT 5;
ALTER TABLE organizations ADD COLUMN ai_user_daily_limit INTEGER NOT NULL DEFAULT 20;
-- Modelo que responde (lo elige el dueño de la plataforma en Ajustes › Asistente IA).
ALTER TABLE organizations ADD COLUMN ai_model TEXT NOT NULL DEFAULT 'claude-opus-5-5';

-- Una fila por pregunta respondida (o fallida después de gastar tokens).
CREATE TABLE ai_usage (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  tool_calls INTEGER NOT NULL DEFAULT 0,
  cost_usd NUMERIC NOT NULL DEFAULT 0,
  cached BOOLEAN NOT NULL DEFAULT FALSE,
  ok BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ai_usage_org_month ON ai_usage(organization_id, created_at);
CREATE INDEX idx_ai_usage_user_day ON ai_usage(user_id, created_at);

-- Respuestas recientes a la misma primera pregunta (mismo equipo y rol: mismos permisos). Caduca en 30 min.
CREATE TABLE ai_answer_cache (
  key TEXT PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  answer TEXT NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
