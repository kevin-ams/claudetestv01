-- Registrar en el historial los avisos por correo de nueva versión.
ALTER TABLE revisiones DROP CONSTRAINT revisiones_accion_check;
ALTER TABLE revisiones ADD CONSTRAINT revisiones_accion_check
  CHECK (accion IN ('aprobado', 'cambios', 'comentario', 'nueva_version', 'notificacion'));
