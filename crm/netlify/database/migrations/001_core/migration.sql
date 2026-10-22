-- Ams CRM: esquema núcleo (fase 0)

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  google_sub TEXT UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  -- Acceso alterno a Google (personas externas o soporte). NULL = solo Google.
  password_hash TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE companies (
  id SERIAL PRIMARY KEY,
  legal_name TEXT NOT NULL,
  trade_name TEXT,
  nit TEXT,
  fiscal_address TEXT,
  industry TEXT,
  website TEXT,
  phone TEXT,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  custom_fields JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- La empresa es opcional: se vende tanto B2B como B2C.
CREATE TABLE contacts (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  whatsapp TEXT,
  job_title TEXT,
  nit TEXT NOT NULL DEFAULT 'CF',
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  source TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  lead_score INTEGER NOT NULL DEFAULT 0,
  custom_fields JSONB NOT NULL DEFAULT '{}',
  unsubscribed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX contacts_email_idx ON contacts (LOWER(email));
CREATE INDEX contacts_company_idx ON contacts (company_id);

CREATE TABLE pipelines (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pipeline_stages (
  id SERIAL PRIMARY KEY,
  pipeline_id INTEGER NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL,
  probability INTEGER NOT NULL DEFAULT 0 CHECK (probability BETWEEN 0 AND 100),
  kind TEXT NOT NULL DEFAULT 'open' CHECK (kind IN ('open', 'won', 'lost'))
);

CREATE TABLE deals (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  pipeline_id INTEGER NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  stage_id INTEGER NOT NULL REFERENCES pipeline_stages(id),
  contact_id INTEGER REFERENCES contacts(id) ON DELETE SET NULL,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'GTQ' CHECK (currency IN ('GTQ', 'USD')),
  expected_close_date DATE,
  lost_reason TEXT,
  closed_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX deals_stage_idx ON deals (stage_id);

CREATE TABLE activities (
  id SERIAL PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('note', 'call', 'meeting', 'email', 'whatsapp', 'stage_change', 'system')),
  body TEXT NOT NULL DEFAULT '',
  contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  deal_id INTEGER REFERENCES deals(id) ON DELETE CASCADE,
  author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX activities_contact_idx ON activities (contact_id, occurred_at DESC);
CREATE INDEX activities_deal_idx ON activities (deal_id, occurred_at DESC);

CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  due_date DATE,
  done_at TIMESTAMPTZ,
  assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  contact_id INTEGER REFERENCES contacts(id) ON DELETE CASCADE,
  deal_id INTEGER REFERENCES deals(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pipeline por defecto (editable desde Configuración).
INSERT INTO pipelines (name, is_default) VALUES ('Ventas', TRUE);

INSERT INTO pipeline_stages (pipeline_id, name, position, probability, kind) VALUES
  (1, 'Lead', 1, 10, 'open'),
  (1, 'Llamada', 2, 25, 'open'),
  (1, 'Propuesta', 3, 50, 'open'),
  (1, 'Reunión en negociación', 4, 75, 'open'),
  (1, 'Ganado', 5, 100, 'won'),
  (1, 'Perdido', 6, 0, 'lost');
