-- Ficha de cada documento: qué es (presentación, lista de asistencia, acta…) y una descripción corta.
ALTER TABLE "Media" ADD COLUMN "kind" TEXT;
ALTER TABLE "Media" ADD COLUMN "description" TEXT;
