-- Avance por tratos de la revisión de cada embudo (para la barra de avance).
ALTER TABLE ac_pipeline_scans ADD COLUMN deals_total INTEGER NOT NULL DEFAULT 0;
ALTER TABLE ac_pipeline_scans ADD COLUMN deals_done INTEGER NOT NULL DEFAULT 0;
