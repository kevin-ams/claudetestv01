-- Enlace de solo lectura para que Diseño vea el reporte de cambios de una
-- campaña sin cuenta. NULL = sin enlace activo (se crea o revoca desde el admin).
ALTER TABLE campanas ADD COLUMN reporte_token TEXT UNIQUE;
