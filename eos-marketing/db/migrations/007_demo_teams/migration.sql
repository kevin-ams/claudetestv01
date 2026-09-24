-- Equipos de demostración (Ajustes > Información demo). Se borran completos al desactivar la demo.
ALTER TABLE teams ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE teams ADD COLUMN demo_owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE;
