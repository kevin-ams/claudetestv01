-- Caja de herramientas: accesos directos (enlace a otro sitio) o mini módulos con un sitio
-- insertado (iframe), visibles en "Otras herramientas" según el acceso de cada una.
CREATE TABLE tools (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'link' CHECK (kind IN ('link', 'embed')),   -- link = pestaña nueva; embed = dentro de la app
  url TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '🔗',
  access TEXT NOT NULL DEFAULT 'all' CHECK (access IN ('all', 'restricted')), -- restricted = solo roles/personas elegidas
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_tools_team ON tools(team_id, sort_order);

CREATE TABLE tool_roles (
  tool_id INTEGER NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES team_roles(id) ON DELETE CASCADE,
  PRIMARY KEY (tool_id, role_id)
);

CREATE TABLE tool_users (
  tool_id INTEGER NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (tool_id, user_id)
);
