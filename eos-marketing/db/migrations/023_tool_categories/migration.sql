-- Categoría de cada herramienta (p. ej. Análisis, Marketing, Documentos) para agruparlas en el índice.
ALTER TABLE tools ADD COLUMN category TEXT NOT NULL DEFAULT '';
