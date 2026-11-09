-- Indicadores calculados con fórmula: variables (A, B, C…) → indicadores y una expresión con + − × ÷ y paréntesis.
-- {"expr": "A / B * 100", "vars": {"A": 12, "B": 15}}
ALTER TABLE scorecard_metrics ADD COLUMN calc_formula JSONB;

-- Los calculados anteriores (numerador ÷ denominador, × 100 si es %) pasan a fórmula con el mismo resultado.
UPDATE scorecard_metrics
SET calc_formula = jsonb_build_object(
  'expr', CASE WHEN format = 'percentage' THEN 'A / B * 100' ELSE 'A / B' END,
  'vars', jsonb_build_object('A', calc_numerator_id, 'B', calc_denominator_id)
)
WHERE calc_numerator_id IS NOT NULL AND calc_denominator_id IS NOT NULL;

-- Para restaurar archivados en el orden en que estaban.
ALTER TABLE scorecard_metrics ADD COLUMN archived_at TIMESTAMPTZ;
UPDATE scorecard_metrics SET archived_at = NOW() WHERE archived = TRUE;
