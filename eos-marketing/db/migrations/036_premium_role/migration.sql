-- Rol "Administrador Premium": todo lo de Administrador más los módulos premium (Conocimiento / Vault).
-- Solo el dueño de la plataforma puede asignarlo o abrir módulos premium a otros roles.
ALTER TABLE team_roles ADD COLUMN is_premium BOOLEAN NOT NULL DEFAULT FALSE;
INSERT INTO team_roles (team_id, name, is_admin, is_system, is_premium, permissions)
SELECT id, 'Administrador Premium', TRUE, TRUE, TRUE, '{}'::jsonb FROM teams
ON CONFLICT (team_id, name) DO UPDATE SET is_admin = TRUE, is_system = TRUE, is_premium = TRUE;

-- Dueño de la plataforma (se puede marcar a mano; si nadie lo está, es la primera cuenta creada).
ALTER TABLE users ADD COLUMN is_platform_owner BOOLEAN NOT NULL DEFAULT FALSE;
