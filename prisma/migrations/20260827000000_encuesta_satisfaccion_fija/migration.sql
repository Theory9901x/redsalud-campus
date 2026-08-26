-- Encuesta de satisfacción fija: el modelo institucional que se clona y
-- publica automáticamente para cada capacitación al cerrar su jornada.
ALTER TABLE "Survey" ADD COLUMN "esSatisfaccionFija" BOOLEAN NOT NULL DEFAULT false;
