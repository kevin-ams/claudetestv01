-- Checklist de Diseño: una fila = un cambio marcado como hecho, sobre la
-- versión actual de un arte. item = 'p:<anotacion_id>' (punto) o
-- 'c:<revision_id>' (comentario general).
CREATE TABLE checklist_diseno (
  arte_id INTEGER NOT NULL REFERENCES artes(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  item TEXT NOT NULL,
  hecho_por TEXT NOT NULL DEFAULT '',
  hecho_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (arte_id, version, item)
);

-- Avisos del panel de administración (campanita del encabezado).
-- `clave` evita repetir el mismo aviso (p. ej. el mismo arte y versión).
CREATE TABLE avisos (
  id SERIAL PRIMARY KEY,
  clave TEXT UNIQUE,
  titulo TEXT NOT NULL,
  mensaje TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lectura por administrador.
CREATE TABLE avisos_leidos (
  aviso_id INTEGER NOT NULL REFERENCES avisos(id) ON DELETE CASCADE,
  admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  PRIMARY KEY (aviso_id, admin_id)
);
