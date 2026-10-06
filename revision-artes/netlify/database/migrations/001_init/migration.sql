-- Revisión de Artes: esquema inicial

-- Administradores del sistema (único tipo de usuario con contraseña).
CREATE TABLE admins (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cada facultad entra al portal con su propio código de acceso.
CREATE TABLE facultades (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  codigo_acceso TEXT NOT NULL UNIQUE,
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE carreras (
  id SERIAL PRIMARY KEY,
  facultad_id INTEGER NOT NULL REFERENCES facultades(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX carreras_facultad_idx ON carreras(facultad_id);

-- Un arte vive en Google Drive; aquí solo guardamos el enlace.
-- carrera_id es opcional: un arte puede ser de toda la facultad.
CREATE TABLE artes (
  id SERIAL PRIMARY KEY,
  facultad_id INTEGER NOT NULL REFERENCES facultades(id) ON DELETE CASCADE,
  carrera_id INTEGER REFERENCES carreras(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  campana TEXT NOT NULL DEFAULT '',
  formato TEXT NOT NULL DEFAULT '',
  descripcion TEXT NOT NULL DEFAULT '',
  drive_url TEXT NOT NULL,
  fecha_publicacion DATE,
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'aprobado', 'cambios')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX artes_facultad_idx ON artes(facultad_id);
CREATE INDEX artes_carrera_idx ON artes(carrera_id);

-- Historial de revisiones. Las personas de facultad no tienen cuenta:
-- se guarda el nombre y correo con el que ingresaron.
CREATE TABLE revisiones (
  id SERIAL PRIMARY KEY,
  arte_id INTEGER NOT NULL REFERENCES artes(id) ON DELETE CASCADE,
  accion TEXT NOT NULL
    CHECK (accion IN ('aprobado', 'cambios', 'comentario', 'nueva_version')),
  comentario TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL,
  autor_tipo TEXT NOT NULL CHECK (autor_tipo IN ('facultad', 'admin')),
  autor_nombre TEXT NOT NULL,
  autor_email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX revisiones_arte_idx ON revisiones(arte_id);
