-- Galardones: una postulación por PERSONA, no solo por cuenta.
-- Las cuentas creadas en la plataforma después del corte postulan por verificar.
CREATE TYPE "GalardonEstado" AS ENUM ('VALIDA', 'POR_VERIFICAR', 'ANULADA');

ALTER TABLE "GalardonPostulacion" ADD COLUMN "estado" "GalardonEstado" NOT NULL DEFAULT 'VALIDA';
ALTER TABLE "GalardonPostulacion" ADD COLUMN "revisadaPor" TEXT;
ALTER TABLE "GalardonPostulacion" ADD COLUMN "revisadaEl" TIMESTAMP(3);
CREATE INDEX "GalardonPostulacion_estado_idx" ON "GalardonPostulacion"("estado");

ALTER TABLE "GalardonConvocatoria" ADD COLUMN "cuentasNuevasDesde" TIMESTAMP(3);

-- Postulaciones ya hechas con cuentas creadas en la plataforma desde el
-- lanzamiento (3-nov-2026, 00:00 Colombia): pasan a revisión.
UPDATE "GalardonPostulacion" p
SET "estado" = 'POR_VERIFICAR'
FROM "User" u
WHERE u."id" = p."votanteId"
  AND u."origenRegistro" = 'AUTO'
  AND u."role" = 'STUDENT'
  AND u."createdAt" >= '2026-11-03 05:00:00'::timestamp;
