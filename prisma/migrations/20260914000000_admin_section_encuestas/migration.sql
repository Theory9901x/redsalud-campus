-- Sección de administración propia para el módulo de encuestas y su centro de datos,
-- para poder dar acceso SOLO a ese módulo (usuario SIHO).
ALTER TYPE "AdminSection" ADD VALUE IF NOT EXISTS 'ENCUESTAS';
