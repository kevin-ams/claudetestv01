-- Agenda del equipo como bloc de notas: una sola nota por persona y semana (en `detail`).
ALTER TABLE team_agenda ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Las actividades sueltas que ya existían se juntan, una por línea, en la nota de esa persona.
WITH grouped AS (
  SELECT team_id, user_id, week_start, MIN(id) AS keep_id,
    string_agg(
      '• ' || title
        || CASE WHEN due_date IS NOT NULL THEN ' (' || to_char(due_date, 'DD/MM') || ')' ELSE '' END
        || CASE WHEN detail <> '' THEN ': ' || detail ELSE '' END
        || CASE WHEN clickup_url IS NOT NULL THEN ' ' || clickup_url ELSE '' END,
      E'\n' ORDER BY due_date NULLS LAST, id
    ) AS body,
    bool_or(status = 'off_track') AS any_off,
    MIN(due_date) AS first_due,
    MAX(issue_id) AS any_issue
  FROM team_agenda
  GROUP BY team_id, user_id, week_start
)
UPDATE team_agenda a
SET detail = g.body, title = '', due_date = g.first_due, issue_id = g.any_issue,
  status = CASE WHEN g.any_off THEN 'off_track' ELSE 'on_track' END,
  clickup_task_id = NULL, clickup_url = NULL, clickup_list = ''
FROM grouped g
WHERE a.id = g.keep_id;

DELETE FROM team_agenda a USING team_agenda b
WHERE a.team_id = b.team_id AND a.user_id = b.user_id AND a.week_start = b.week_start AND a.id > b.id;

DROP INDEX IF EXISTS idx_team_agenda_clickup;
CREATE UNIQUE INDEX idx_team_agenda_person_week ON team_agenda(team_id, user_id, week_start);
