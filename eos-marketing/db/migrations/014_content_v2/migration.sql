-- Contenido v2: link de publicación, carrera separada de la facultad, indicadores
-- calculados del Scorecard y logo de la organización por equipo.

ALTER TABLE editorial_pieces ADD COLUMN link TEXT NOT NULL DEFAULT '';
ALTER TABLE editorial_pieces ADD COLUMN carrera TEXT NOT NULL DEFAULT '';

-- "FISICC / Ing. en Telecomunicaciones" → facultad "FISICC", carrera "Ing. en Telecomunicaciones".
UPDATE editorial_pieces
SET carrera = btrim(substr(facultad, strpos(facultad, '/') + 1)),
    facultad = btrim(substr(facultad, 1, strpos(facultad, '/') - 1))
WHERE strpos(facultad, '/') > 0;

-- Indicador calculado: (numerador ÷ denominador) × 100 si es %, por dueño y semana.
ALTER TABLE scorecard_metrics ADD COLUMN calc_numerator_id INTEGER REFERENCES scorecard_metrics(id) ON DELETE SET NULL;
ALTER TABLE scorecard_metrics ADD COLUMN calc_denominator_id INTEGER REFERENCES scorecard_metrics(id) ON DELETE SET NULL;

-- % Hygiene del plan de contenido = Hygiene producidas ÷ Cadencia (como en la hoja "Config").
UPDATE scorecard_metrics m
SET calc_numerator_id = n.id, calc_denominator_id = d.id
FROM scorecard_metrics n, scorecard_metrics d
WHERE m.name = '% Hygiene sobre el total de la semana'
  AND n.team_id = m.team_id AND n.name = 'Hygiene producidas / semana' AND n.archived = FALSE
  AND d.team_id = m.team_id AND d.name = 'Cadencia: piezas publicadas / semana' AND d.archived = FALSE;

ALTER TABLE teams ADD COLUMN logo_mime TEXT;
ALTER TABLE teams ADD COLUMN logo_updated_at TIMESTAMPTZ;

-- Tipos de lista ya copiados al equipo (para no volver a copiar una lista que vaciaron).
ALTER TABLE teams ADD COLUMN editorial_seeded TEXT NOT NULL DEFAULT '';
