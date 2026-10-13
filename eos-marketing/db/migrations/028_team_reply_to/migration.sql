-- Correo al que llegan las respuestas de los correos del equipo (vacío = quien envía).
ALTER TABLE teams ADD COLUMN reply_to TEXT NOT NULL DEFAULT '';
