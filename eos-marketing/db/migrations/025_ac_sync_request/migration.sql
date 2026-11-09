-- Sincronización manual en segundo plano: cuándo se pidió (para mostrar el avance al volver a la página).
ALTER TABLE teams ADD COLUMN ac_sync_requested_at TIMESTAMPTZ;
