-- Sustituye los valores provisionales del enum por las modalidades reales del
-- plan de cargos (columna TIPO NOM). Seguro: se verificó que ninguna fila usa
-- los valores retirados (PLANTA, PROVISIONAL) — todas están en
-- CONTRATO_PRESTACION, que se conserva.
ALTER TYPE "TipoVinculacion" RENAME TO "TipoVinculacion_old";

CREATE TYPE "TipoVinculacion" AS ENUM (
  'CARRERA_ADMINISTRATIVA',
  'PROVISIONALIDAD',
  'TEMPORAL',
  'TRABAJADOR_OFICIAL',
  'LIBRE_NOMBRAMIENTO',
  'PERIODO_FIJO',
  'CONTRATO_PRESTACION',
  'OTRO'
);

ALTER TABLE "User" ALTER COLUMN "tipoVinculacion" DROP DEFAULT;
ALTER TABLE "User"
  ALTER COLUMN "tipoVinculacion" TYPE "TipoVinculacion"
  USING (
    CASE "tipoVinculacion"::text
      WHEN 'PROVISIONAL' THEN 'PROVISIONALIDAD'
      WHEN 'PLANTA' THEN 'OTRO'
      ELSE "tipoVinculacion"::text
    END
  )::"TipoVinculacion";
ALTER TABLE "User" ALTER COLUMN "tipoVinculacion" SET DEFAULT 'CONTRATO_PRESTACION';

DROP TYPE "TipoVinculacion_old";
