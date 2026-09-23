-- Metas de carrera por mes (reemplazan la meta semanal fija por carrera).
CREATE TABLE career_monthly_goals (
  career_id INTEGER NOT NULL REFERENCES careers(id) ON DELETE CASCADE,
  month DATE NOT NULL,                 -- primer día del mes
  leads_goal NUMERIC NOT NULL DEFAULT 0,
  budget_goal NUMERIC NOT NULL DEFAULT 0,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (career_id, month)
);
CREATE INDEX idx_career_monthly_goals_month ON career_monthly_goals(month);

ALTER TABLE careers DROP COLUMN leads_goal;
ALTER TABLE careers DROP COLUMN budget_goal;

-- To-Dos: descripción y envío a ClickUp.
ALTER TABLE todos ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE todos ADD COLUMN clickup_task_id TEXT;
ALTER TABLE todos ADD COLUMN clickup_url TEXT;
ALTER TABLE todos ADD COLUMN clickup_sent_at TIMESTAMPTZ;

-- Issues (IDS): fecha específica y envío a ClickUp.
ALTER TABLE issues ADD COLUMN due_date DATE;
ALTER TABLE issues ADD COLUMN clickup_task_id TEXT;
ALTER TABLE issues ADD COLUMN clickup_url TEXT;
ALTER TABLE issues ADD COLUMN clickup_sent_at TIMESTAMPTZ;
