-- Control de carrera: tablero de hitos (Kanban + ruta crítica) por carrera.

CREATE TABLE career_tracks (
  career_id INTEGER PRIMARY KEY REFERENCES careers(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,                  -- inicio del plan (base de la ruta crítica)
  status TEXT NOT NULL DEFAULT 'on_track',   -- on_track | off_track
  labels JSONB NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '',
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hitos completados por carrera (la clave viene de CONTROL_MILESTONES en el código).
CREATE TABLE career_track_milestones (
  career_id INTEGER NOT NULL REFERENCES career_tracks(career_id) ON DELETE CASCADE,
  milestone TEXT NOT NULL,
  done_on DATE NOT NULL,
  done_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (career_id, milestone)
);
