-- EOS Level 10 app: initial schema

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE teams (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE team_members (
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seat_title TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE vto (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL UNIQUE REFERENCES teams(id) ON DELETE CASCADE,
  core_values JSONB NOT NULL DEFAULT '[]',
  core_focus JSONB NOT NULL DEFAULT '{}',
  ten_year_target TEXT NOT NULL DEFAULT '',
  marketing_strategy JSONB NOT NULL DEFAULT '{}',
  three_year_picture JSONB NOT NULL DEFAULT '{}',
  one_year_plan JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE accountability_seats (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  parent_seat_id INTEGER REFERENCES accountability_seats(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  roles JSONB NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_seats_team ON accountability_seats(team_id);

CREATE TABLE rocks (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  is_company_rock BOOLEAN NOT NULL DEFAULT FALSE,
  quarter INTEGER NOT NULL,
  year INTEGER NOT NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'on_track',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_rocks_team_quarter ON rocks(team_id, year, quarter);

CREATE TABLE rock_milestones (
  id SERIAL PRIMARY KEY,
  rock_id INTEGER NOT NULL REFERENCES rocks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  due_date DATE,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_milestones_rock ON rock_milestones(rock_id);

CREATE TABLE scorecard_owners (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_rollup BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_scorecard_owners_team ON scorecard_owners(team_id);

CREATE TABLE scorecard_metrics (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  predicts TEXT NOT NULL DEFAULT '',
  direction TEXT NOT NULL DEFAULT 'higher_better',
  format TEXT NOT NULL DEFAULT 'count',
  aggregation TEXT NOT NULL DEFAULT 'sum',
  sort_order INTEGER NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_metrics_team ON scorecard_metrics(team_id);

CREATE TABLE scorecard_targets (
  metric_id INTEGER NOT NULL REFERENCES scorecard_metrics(id) ON DELETE CASCADE,
  owner_id INTEGER NOT NULL REFERENCES scorecard_owners(id) ON DELETE CASCADE,
  target_value NUMERIC NOT NULL DEFAULT 0,
  PRIMARY KEY (metric_id, owner_id)
);

CREATE TABLE scorecard_entries (
  id SERIAL PRIMARY KEY,
  metric_id INTEGER NOT NULL REFERENCES scorecard_metrics(id) ON DELETE CASCADE,
  owner_id INTEGER NOT NULL REFERENCES scorecard_owners(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  value NUMERIC,
  entered_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (metric_id, owner_id, week_start)
);
CREATE INDEX idx_entries_week ON scorecard_entries(week_start);

CREATE TABLE issues (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  raised_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open',
  term TEXT NOT NULL DEFAULT 'short_term',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  solved_at TIMESTAMPTZ
);
CREATE INDEX idx_issues_team_status ON issues(team_id, status);

CREATE TABLE meetings (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled',
  current_segment TEXT,
  segment_started_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  avg_rating NUMERIC,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_meetings_team ON meetings(team_id);

CREATE TABLE todos (
  id SERIAL PRIMARY KEY,
  team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'open',
  meeting_id INTEGER REFERENCES meetings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  done_at TIMESTAMPTZ
);
CREATE INDEX idx_todos_team_status ON todos(team_id, status);

CREATE TABLE meeting_ratings (
  meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 10),
  PRIMARY KEY (meeting_id, user_id)
);

CREATE TABLE meeting_headlines (
  id SERIAL PRIMARY KEY,
  meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE meeting_issues (
  meeting_id INTEGER NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  discussed BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (meeting_id, issue_id)
);
