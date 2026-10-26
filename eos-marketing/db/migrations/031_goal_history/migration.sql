-- Histórico de metas por carrera y año: lo que ya se tenía (leads calificados / presupuesto usado)
-- antes del primer mes con distribución mensual (`from_month`). Total del ciclo = histórico + meses
-- desde `from_month`. `cycle_*` guarda la meta del ciclo de la hoja para comparar.
CREATE TABLE career_goal_history (
  career_id INTEGER NOT NULL REFERENCES careers(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  from_month DATE NOT NULL,
  leads NUMERIC,
  budget NUMERIC,
  cycle_leads NUMERIC,
  cycle_budget NUMERIC,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (career_id, year)
);
