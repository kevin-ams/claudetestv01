-- Organización explícita. Hasta ahora era implícita: todos los equipos reales forman una organización y
-- cada demo es la suya (la de su dueño). V/TO, organigrama y vault siguen guardándose en el equipo ancla
-- (el primero de la organización); a partir de aquí la organización se resuelve por teams.organization_id.
CREATE TABLE organizations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  -- base | premium (preparado para vender el plan por organización)
  plan TEXT NOT NULL DEFAULT 'base',
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  demo_owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_organizations_demo_owner ON organizations(demo_owner_id) WHERE is_demo;

ALTER TABLE teams ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;
CREATE INDEX idx_teams_organization ON teams(organization_id);

-- Organización principal (los equipos reales). Ya usa los módulos Premium.
INSERT INTO organizations (name, plan)
SELECT 'Organización principal', 'premium' WHERE EXISTS (SELECT 1 FROM teams WHERE NOT is_demo);
UPDATE teams SET organization_id = (SELECT MIN(id) FROM organizations WHERE NOT is_demo) WHERE NOT is_demo;

-- Una organización por cada dueño de demo.
INSERT INTO organizations (name, is_demo, demo_owner_id)
SELECT DISTINCT 'Demo', TRUE, demo_owner_id FROM teams WHERE is_demo AND demo_owner_id IS NOT NULL;
UPDATE teams t SET organization_id = o.id FROM organizations o
WHERE t.is_demo AND o.is_demo AND o.demo_owner_id = t.demo_owner_id;
