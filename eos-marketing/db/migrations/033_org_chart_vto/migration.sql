-- Organigrama y V/TO de toda la organización (todos los equipos reales; cada demo es su propia organización).

-- Un puesto puede tener varias personas (p. ej. "Asesores"): se muestran con su número y la lista.
CREATE TABLE accountability_seat_people (
  seat_id INTEGER NOT NULL REFERENCES accountability_seats(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (seat_id, user_id)
);
INSERT INTO accountability_seat_people (seat_id, user_id)
SELECT id, user_id FROM accountability_seats WHERE user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- V/TO único: se guarda en el primer equipo (id más bajo) de cada organización. Si ese está vacío, toma el
-- V/TO con contenido editado más recientemente de otro equipo de la organización.
INSERT INTO vto (team_id)
SELECT MIN(id) FROM teams GROUP BY CASE WHEN is_demo THEN 'demo:' || demo_owner_id ELSE 'main' END
ON CONFLICT (team_id) DO NOTHING;

WITH t AS (
  SELECT id, CASE WHEN is_demo THEN 'demo:' || demo_owner_id ELSE 'main' END AS org FROM teams
),
anchor AS (SELECT org, MIN(id) AS team_id FROM t GROUP BY org),
filled AS (
  SELECT v.*, t.org FROM vto v JOIN t ON t.id = v.team_id
  WHERE v.ten_year_target <> '' OR v.core_values <> '[]'::jsonb OR v.core_focus <> '{}'::jsonb
    OR v.marketing_strategy <> '{}'::jsonb OR v.three_year_picture <> '{}'::jsonb OR v.one_year_plan <> '{}'::jsonb
),
best AS (
  SELECT DISTINCT ON (f.org) f.*, a.team_id AS anchor_id
  FROM filled f JOIN anchor a ON a.org = f.org
  ORDER BY f.org, (f.team_id = a.team_id) DESC, f.updated_at DESC
)
UPDATE vto v SET
  core_values = b.core_values, core_focus = b.core_focus, ten_year_target = b.ten_year_target,
  marketing_strategy = b.marketing_strategy, three_year_picture = b.three_year_picture,
  one_year_plan = b.one_year_plan, updated_at = b.updated_at, updated_by = b.updated_by
FROM best b
WHERE v.team_id = b.anchor_id AND b.team_id <> b.anchor_id;
