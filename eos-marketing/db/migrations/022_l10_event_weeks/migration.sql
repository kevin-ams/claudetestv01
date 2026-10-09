-- Eventos programados para la L10 de una semana en particular (NULL = la próxima L10).
ALTER TABLE l10_events ADD COLUMN week_from DATE;
