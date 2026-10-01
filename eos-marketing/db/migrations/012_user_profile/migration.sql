-- Perfil de cada persona (Mi perfil): pronombre, foto y color personal.
ALTER TABLE users ADD COLUMN pronoun TEXT NOT NULL DEFAULT '';        -- 'el' | 'ella' | 'elle' | ''
ALTER TABLE users ADD COLUMN avatar_mime TEXT;                        -- NULL = sin foto
ALTER TABLE users ADD COLUMN avatar_updated_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN color TEXT NOT NULL DEFAULT '';          -- '#rrggbb' o '' (sin color)
ALTER TABLE users ADD COLUMN use_color_theme BOOLEAN NOT NULL DEFAULT FALSE; -- usar su color como template (solo para esa persona)
