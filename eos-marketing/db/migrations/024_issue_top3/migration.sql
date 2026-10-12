-- Top 3 de Issues: los primeros que se discuten en el IDS de la L10 (1, 2, 3; NULL = no está en el top).
ALTER TABLE issues ADD COLUMN top_rank SMALLINT;
