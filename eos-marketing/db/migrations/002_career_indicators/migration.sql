-- Indicadores de carrera: leads y consumo de presupuesto semanal por carrera.

CREATE TABLE careers (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  program TEXT NOT NULL,                 -- unidad académica (FISICC, FACTI, ...)
  code TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'Pregrado', -- Pregrado, Postgrado, Técnico, Diplomado
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  leads_goal NUMERIC NOT NULL DEFAULT 0,  -- meta semanal de leads
  budget_goal NUMERIC NOT NULL DEFAULT 0, -- presupuesto semanal a consumir
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_careers_team ON careers(team_id);

CREATE TABLE career_weekly (
  career_id INTEGER NOT NULL REFERENCES careers(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  leads INTEGER,
  leads_source TEXT,          -- manual | activecampaign
  budget_spent NUMERIC,
  budget_source TEXT,         -- manual | csv
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (career_id, week_start)
);
CREATE INDEX idx_career_weekly_week ON career_weekly(week_start);

-- Nombre de campaña (reporte de Meta) -> carrera, recordado entre importaciones.
CREATE TABLE career_campaign_aliases (
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  career_id INTEGER NOT NULL REFERENCES careers(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, alias)
);

CREATE TABLE career_imports (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,         -- budget_csv | activecampaign
  week_start DATE NOT NULL,
  file_name TEXT,
  careers_updated INTEGER NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_career_imports_team ON career_imports(team_id, created_at DESC);
