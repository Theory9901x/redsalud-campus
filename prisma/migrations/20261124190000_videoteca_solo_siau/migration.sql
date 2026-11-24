-- La Videoteca se abre a todo el personal (estudiantes y docentes), salvo los
-- videos del área SIAU, que traen datos de acceso de esa área. Los que ya
-- existen quedan restringidos (DEFAULT true): son los de SIAU.
ALTER TABLE "VideoCapacitacion" ADD COLUMN "soloSiau" BOOLEAN NOT NULL DEFAULT true;
