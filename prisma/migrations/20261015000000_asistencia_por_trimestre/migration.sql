-- Asistencia POR TRIMESTRE: una misma capacitación programada en varios
-- trimestres registra la asistencia de cada trimestre por separado (antes
-- había una sola fila por persona y capacitación, y asistir en T3 no se
-- distinguía de haber asistido en T1).
ALTER TABLE "TrainingAttendance" ADD COLUMN "trimestre" INTEGER NOT NULL DEFAULT 0;

-- Las filas existentes toman el trimestre de su fecha de registro, en hora de Colombia.
UPDATE "TrainingAttendance"
SET "trimestre" = ((EXTRACT(MONTH FROM ("registeredAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Bogota'))::int - 1) / 3) + 1;

DROP INDEX "TrainingAttendance_activityId_userId_key";
CREATE UNIQUE INDEX "TrainingAttendance_activityId_userId_trimestre_key" ON "TrainingAttendance"("activityId", "userId", "trimestre");
