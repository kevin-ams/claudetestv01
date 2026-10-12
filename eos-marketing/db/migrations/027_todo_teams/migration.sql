-- To-Dos enviados a otros equipos: la copia guarda de qué equipo y To-Do viene.
ALTER TABLE todos ADD COLUMN from_team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL;
ALTER TABLE todos ADD COLUMN origin_todo_id INTEGER REFERENCES todos(id) ON DELETE SET NULL;
ALTER TABLE todos ADD COLUMN sent_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX todos_origin_idx ON todos (origin_todo_id);
