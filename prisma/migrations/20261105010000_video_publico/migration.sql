-- Videos públicos: se ven con el enlace, sin cuenta.
ALTER TABLE "VideoCapacitacion" ADD COLUMN "publico" BOOLEAN NOT NULL DEFAULT false;

-- El tutorial de exportación SIAU se comparte sin usuario ni contraseña.
UPDATE "VideoCapacitacion" SET "publico" = true WHERE "id" = 'cmw2nt9nv0000gfl8fx955l1p';
