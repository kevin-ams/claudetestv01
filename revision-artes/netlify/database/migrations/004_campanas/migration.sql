-- Campañas: paso intermedio Facultad → Campaña → Artes.
CREATE TABLE campanas (
  id SERIAL PRIMARY KEY,
  facultad_id INTEGER NOT NULL REFERENCES facultades(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX campanas_facultad_idx ON campanas(facultad_id);

-- Si se elimina la campaña, sus artes quedan en "Otros artes".
ALTER TABLE artes ADD COLUMN campana_id INTEGER REFERENCES campanas(id) ON DELETE SET NULL;
CREATE INDEX artes_campana_idx ON artes(campana_id);

-- Los artes existentes pasan a la campaña que tenían escrita como texto.
INSERT INTO campanas (facultad_id, nombre)
SELECT DISTINCT facultad_id, TRIM(campana) FROM artes WHERE TRIM(campana) <> '';

UPDATE artes a SET campana_id = c.id
FROM campanas c
WHERE c.facultad_id = a.facultad_id AND c.nombre = TRIM(a.campana);

ALTER TABLE artes DROP COLUMN campana;
