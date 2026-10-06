-- Quién creó la campaña: recibe el aviso por correo cuando todos sus artes
-- quedan revisados. Las campañas anteriores no lo tienen (se avisa a todos
-- los administradores).
ALTER TABLE campanas ADD COLUMN creado_por_nombre TEXT;
ALTER TABLE campanas ADD COLUMN creado_por_email TEXT;
