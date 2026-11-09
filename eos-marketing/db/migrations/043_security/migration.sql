-- Seguridad (ISO 27001 8.5, 8.15, 8.16): intentos de acceso, bitácora de seguridad y doble factor opcional.

-- Intentos de inicio de sesión (y de código de doble factor) para limitar la fuerza bruta. Se purgan a los 30 días.
CREATE TABLE auth_attempts (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'password',   -- password | mfa | reset
  email TEXT NOT NULL,
  ip TEXT,
  ok BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_auth_attempts_email ON auth_attempts(email, created_at);
CREATE INDEX idx_auth_attempts_ip ON auth_attempts(ip, created_at);

-- Bitácora de eventos de seguridad. Sin llaves foráneas (sobrevive a borrar personas o equipos) y de solo agregar:
-- un disparador impide modificar filas y borrar las de menos de un año.
CREATE TABLE security_events (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  user_id INTEGER,
  actor_id INTEGER,
  team_id INTEGER,
  organization_id INTEGER,
  email TEXT,
  ip TEXT,
  detail TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_security_events_org ON security_events(organization_id, created_at DESC);
CREATE INDEX idx_security_events_type ON security_events(type, created_at DESC);

CREATE FUNCTION security_events_append_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'La bitácora de seguridad no se puede modificar';
  END IF;
  IF OLD.created_at > NOW() - INTERVAL '365 days' THEN
    RAISE EXCEPTION 'Los eventos de seguridad se conservan un año';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER security_events_protect BEFORE UPDATE OR DELETE ON security_events
FOR EACH ROW EXECUTE FUNCTION security_events_append_only();

-- Doble factor (TOTP) opcional por persona; el secreto va cifrado (AES-256-GCM).
ALTER TABLE users ADD COLUMN totp_secret TEXT;
ALTER TABLE users ADD COLUMN totp_pending_secret TEXT;
ALTER TABLE users ADD COLUMN totp_enabled_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN totp_recovery_hashes TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN last_login_at TIMESTAMPTZ;

-- El Administrador Premium decide si su organización ofrece el doble factor (off | optional).
ALTER TABLE organizations ADD COLUMN mfa_mode TEXT NOT NULL DEFAULT 'off';
