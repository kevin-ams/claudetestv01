-- Agenda del equipo: en qué trabajará cada persona durante la semana, con semáforo.
-- Se llena antes de la L10 y se revisa en el segmento de Noticias. Puede venir de ClickUp.
CREATE TABLE team_agenda (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,       -- quién trabajará en esto
  week_start DATE NOT NULL,                                              -- lunes de la semana
  title TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'on_track',                               -- on_track | off_track
  due_date DATE,
  clickup_task_id TEXT,
  clickup_url TEXT,
  clickup_list TEXT NOT NULL DEFAULT '',
  issue_id INTEGER REFERENCES issues(id) ON DELETE SET NULL,             -- si se pasó a Issue
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_team_agenda_week ON team_agenda(team_id, week_start);
CREATE UNIQUE INDEX idx_team_agenda_clickup ON team_agenda(team_id, user_id, week_start, clickup_task_id) WHERE clickup_task_id IS NOT NULL;
