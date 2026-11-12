-- 1) Cada campaña se vincula a una carrera (NULL = toda la facultad); el arte
--    ya no tiene carrera propia en la interfaz. A las campañas existentes se
--    les asigna la carrera si todos sus artes eran de la misma.
ALTER TABLE campanas ADD COLUMN carrera_id INTEGER REFERENCES carreras(id) ON DELETE SET NULL;

UPDATE campanas k SET carrera_id = x.carrera_id
FROM (
  SELECT campana_id, MIN(carrera_id) AS carrera_id
  FROM artes
  WHERE campana_id IS NOT NULL
  GROUP BY campana_id
  HAVING COUNT(DISTINCT COALESCE(carrera_id, 0)) = 1 AND MIN(carrera_id) IS NOT NULL
) x
WHERE x.campana_id = k.id;

-- 2) Diseñadores para enviarles el reporte de cambios con un clic.
CREATE TABLE disenadores (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3) Puntos marcados en el portal que todavía no se envían: se guardan al
--    pulsar "Listo" para no perderlos. Son de quien los marcó (su correo).
CREATE TABLE puntos_borrador (
  id SERIAL PRIMARY KEY,
  arte_id INTEGER NOT NULL REFERENCES artes(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  autor_email TEXT NOT NULL,
  x REAL NOT NULL CHECK (x >= 0 AND x <= 100),
  y REAL NOT NULL CHECK (y >= 0 AND y <= 100),
  comentario TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX puntos_borrador_arte_idx ON puntos_borrador(arte_id, version, autor_email);
