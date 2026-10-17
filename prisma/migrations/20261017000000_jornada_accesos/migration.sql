-- Accesos por JORNADA y evaluación de la capacitación sin cursos.
-- Migración ADITIVA: solo columnas nulas / con valor por defecto e índices.
-- No se borra ni se reescribe ningún dato existente.

-- 1. Contenedor interno de la evaluación presaber/postsaber de una capacitación.
ALTER TABLE "Course" ADD COLUMN "esContenedorCapacitacion" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Course_esContenedorCapacitacion_idx" ON "Course"("esContenedorCapacitacion");

-- 2. Jornada por cuyo enlace se presentó cada intento de evaluación.
ALTER TABLE "QuizAttempt" ADD COLUMN "sessionId" TEXT;
CREATE INDEX "QuizAttempt_sessionId_idx" ON "QuizAttempt"("sessionId");
ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Jornada por cuyo enlace se registró cada invitado externo.
ALTER TABLE "ExternalParticipant" ADD COLUMN "sessionId" TEXT;
CREATE INDEX "ExternalParticipant_sessionId_idx" ON "ExternalParticipant"("sessionId");
ALTER TABLE "ExternalParticipant" ADD CONSTRAINT "ExternalParticipant_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Jornada de la sala a la que corresponde cada tramo de conexión.
ALTER TABLE "CallConnectionLog" ADD COLUMN "sessionId" TEXT;
CREATE INDEX "CallConnectionLog_sessionId_idx" ON "CallConnectionLog"("sessionId");
ALTER TABLE "CallConnectionLog" ADD CONSTRAINT "CallConnectionLog_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
