-- Los íconos de las herramientas pasan de emoji a un ícono del tema (por nombre).
UPDATE tools SET icon = CASE WHEN kind = 'embed' THEN 'Puzzle' ELSE 'Link' END WHERE icon !~ '^[A-Za-z]+$';
ALTER TABLE tools ALTER COLUMN icon SET DEFAULT 'Link';
