-- Reportes semanales: destinatarios y secciones que el equipo eligió la última vez.
ALTER TABLE teams ADD COLUMN weekly_report_recipients TEXT NOT NULL DEFAULT '';
ALTER TABLE teams ADD COLUMN weekly_report_sections TEXT NOT NULL DEFAULT '';
