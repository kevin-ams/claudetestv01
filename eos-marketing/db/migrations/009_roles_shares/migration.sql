-- Roles por equipo con nivel de acceso por módulo (Ajustes > Roles y accesos).
CREATE TABLE team_roles (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  -- { "rocks": "edit" | "view" | "none", ... }; los módulos ausentes cuentan como "edit".
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, name)
);

ALTER TABLE team_members ADD COLUMN role_id INTEGER REFERENCES team_roles(id) ON DELETE SET NULL;

INSERT INTO team_roles (team_id, name, is_admin, is_system, permissions)
SELECT id, 'Administrador', TRUE, TRUE, '{}'::jsonb FROM teams;
INSERT INTO team_roles (team_id, name, is_admin, is_system, permissions)
SELECT id, 'Usuario', FALSE, TRUE, '{"ajustes": "view"}'::jsonb FROM teams;

-- Los administradores actuales (y el dueño de cada demo) quedan como Administrador.
UPDATE team_members tm SET role_id = r.id
FROM team_roles r, users u, teams t
WHERE r.team_id = tm.team_id AND u.id = tm.user_id AND t.id = tm.team_id
  AND r.name = CASE WHEN u.role = 'admin' OR t.demo_owner_id = u.id THEN 'Administrador' ELSE 'Usuario' END;

-- Indicadores del Scorecard visibles para otros equipos.
ALTER TABLE scorecard_metrics ADD COLUMN shared_all BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE scorecard_metric_shares (
  metric_id INTEGER NOT NULL REFERENCES scorecard_metrics(id) ON DELETE CASCADE,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  PRIMARY KEY (metric_id, team_id)
);

-- Conclusión de la L10: mensajes a cascadear (salen en el resumen PDF).
ALTER TABLE meetings ADD COLUMN cascade_notes TEXT NOT NULL DEFAULT '';
