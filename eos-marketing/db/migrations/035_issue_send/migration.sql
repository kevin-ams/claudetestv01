-- Issues enviados a otros equipos: la copia guarda de qué equipo e Issue viene.
ALTER TABLE issues ADD COLUMN from_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE issues ADD COLUMN origin_issue_id INTEGER REFERENCES issues(id) ON DELETE SET NULL;
ALTER TABLE issues ADD COLUMN sent_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX issues_origin_idx ON issues (origin_issue_id);
