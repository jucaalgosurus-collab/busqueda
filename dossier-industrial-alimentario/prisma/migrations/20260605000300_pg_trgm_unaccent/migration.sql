-- A.14: habilitar pg_trgm y unaccent para que las queries con
-- similarity() y normalize() funcionen. Pre-existente bug detectado
-- por smoke test A.4 (similarity() no existía en la BD).
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
