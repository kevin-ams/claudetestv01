-- Color del template por equipo (Ajustes > Apariencia).
ALTER TABLE teams ADD COLUMN theme_color TEXT NOT NULL DEFAULT '#234c6a';
