-- FASE 10: sesiones presenciales con fases en vivo y asistencia por sesión.
--
-- Se extiende TrainingSession (el modelo real de jornadas agendadas) en vez
-- de crear un modelo paralelo, y se conserva el enum de modalidad completo:
-- 38 de las 59 líneas reales del PIC son MIXTA y eliminarlas del enum
-- rompería datos vigentes.

CREATE TYPE "FaseSesion" AS ENUM ('REGISTRO', 'PRESABER', 'CAPACITACION', 'POSTSABER', 'CERRADA');

-- La modalidad pasa a ser obligatoria: primero se rellena la única nula.
UPDATE "TrainingActivity" SET "modality" = 'VIRTUAL' WHERE "modality" IS NULL;
ALTER TABLE "TrainingActivity" ALTER COLUMN "modality" SET DEFAULT 'VIRTUAL';
ALTER TABLE "TrainingActivity" ALTER COLUMN "modality" SET NOT NULL;

ALTER TABLE "TrainingSession"
  ADD COLUMN "facilitador" TEXT,
  ADD COLUMN "fase" "FaseSesion" NOT NULL DEFAULT 'REGISTRO',
  ADD COLUMN "tokenPublico" TEXT,
  ADD COLUMN "cierreSnapshot" JSONB,
  ADD COLUMN "cerradaEl" TIMESTAMP(3);

-- Token para las sesiones ya existentes: uno impredecible por fila.
UPDATE "TrainingSession" SET "tokenPublico" = md5(random()::text || id) WHERE "tokenPublico" IS NULL;
ALTER TABLE "TrainingSession" ALTER COLUMN "tokenPublico" SET NOT NULL;
CREATE UNIQUE INDEX "TrainingSession_tokenPublico_key" ON "TrainingSession"("tokenPublico");

CREATE TABLE "AsistenciaSesion" (
    "id" TEXT NOT NULL,
    "sesionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "registradaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "medio" TEXT NOT NULL DEFAULT 'QR',
    CONSTRAINT "AsistenciaSesion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AsistenciaSesion_sesionId_userId_key" ON "AsistenciaSesion"("sesionId", "userId");
CREATE INDEX "AsistenciaSesion_sesionId_idx" ON "AsistenciaSesion"("sesionId");

ALTER TABLE "AsistenciaSesion" ADD CONSTRAINT "AsistenciaSesion_sesionId_fkey" FOREIGN KEY ("sesionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AsistenciaSesion" ADD CONSTRAINT "AsistenciaSesion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
