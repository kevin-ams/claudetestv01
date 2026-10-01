-- Calendario editorial y Control de coberturas (plan de contenido de la U).

-- Piezas del calendario. week_start NULL = idea en el banco (p. ej. Banco Hygiene).
CREATE TABLE editorial_pieces (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  week_start DATE,                                  -- lunes de la semana planificada
  pub_date DATE,                                    -- fecha de publicación (opcional)
  title TEXT NOT NULL,
  pilar TEXT NOT NULL DEFAULT '',
  capa TEXT NOT NULL DEFAULT '',                    -- Hero | Hub | Hygiene
  assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  frente TEXT NOT NULL DEFAULT '',
  audiencia TEXT NOT NULL DEFAULT '',
  facultad TEXT NOT NULL DEFAULT '',
  cta TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Programado',
  note TEXT NOT NULL DEFAULT '',
  is_buffer BOOLEAN NOT NULL DEFAULT FALSE,         -- esporádico / reactivo (usa un slot de buffer)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_editorial_pieces_team_week ON editorial_pieces(team_id, week_start);

-- Fechas clave (días internacionales / mundiales) como ganchos de contenido.
CREATE TABLE editorial_dates (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  title TEXT NOT NULL,
  facultad TEXT NOT NULL DEFAULT '',
  carrera TEXT NOT NULL DEFAULT '',
  pilar TEXT NOT NULL DEFAULT '',
  capa TEXT NOT NULL DEFAULT '',
  angle TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT '',                -- Alta | Media | Baja
  note TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_editorial_dates_team ON editorial_dates(team_id, date);

-- Listas editables (pilares, estados, frentes, tipos y paquetes de cobertura...).
CREATE TABLE editorial_options (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  value TEXT NOT NULL,
  hint TEXT NOT NULL DEFAULT '',                    -- p. ej. "≈ 4-5 h" en los paquetes
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (team_id, kind, value)
);

-- Coberturas de eventos y control de horas fuera de horario.
CREATE TABLE coverages (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  date DATE,
  title TEXT NOT NULL,
  facultad TEXT NOT NULL DEFAULT '',
  start_time TEXT NOT NULL DEFAULT '',              -- 'HH:MM'
  end_time TEXT NOT NULL DEFAULT '',
  assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Agendada',
  paquete TEXT NOT NULL DEFAULT '',
  est_hours TEXT NOT NULL DEFAULT '',               -- estimado libre: '4-5' o '3'
  real_hours NUMERIC,
  overtime_hours NUMERIC NOT NULL DEFAULT 0,        -- horas fuera de horario
  replaced_hours NUMERIC NOT NULL DEFAULT 0,        -- horas ya repuestas
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_coverages_team_date ON coverages(team_id, date);
