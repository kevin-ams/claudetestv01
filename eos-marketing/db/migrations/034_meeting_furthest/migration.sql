-- La L10 se puede recorrer en cualquier orden: se guarda la sección más avanzada a la que se llegó
-- (para marcar como vistas las anteriores aunque se regrese).
ALTER TABLE meetings ADD COLUMN furthest_segment TEXT;
UPDATE meetings SET furthest_segment = current_segment WHERE current_segment IS NOT NULL;
