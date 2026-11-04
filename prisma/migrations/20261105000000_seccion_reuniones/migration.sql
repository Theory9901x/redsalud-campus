-- Reuniones pasa a ser una sección propia del panel (antes dependía de PLANES_CAPACITACION).
-- El valor nuevo va solo en esta migración: Postgres no deja usarlo en la misma transacción.
ALTER TYPE "AdminSection" ADD VALUE IF NOT EXISTS 'REUNIONES';
