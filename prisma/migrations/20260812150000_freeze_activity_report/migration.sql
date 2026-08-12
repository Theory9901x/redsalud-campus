-- Informe congelado de la jornada.
--
-- El informe de adherencia se recalculaba en vivo cada vez que se abría, así
-- que cualquier cambio posterior en los datos -un usuario dado de baja, un
-- intento anulado, una clave de respuestas corregida- reescribía un acta que
-- ya se había radicado. Al cerrar la jornada el informe se materializa aquí y
-- deja de moverse.

ALTER TABLE "TrainingActivity" ADD COLUMN "reportSnapshot" JSONB;
ALTER TABLE "TrainingActivity" ADD COLUMN "reportSnapshotAt" TIMESTAMP(3);
