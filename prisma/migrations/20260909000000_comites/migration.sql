-- COMITÉS: un comité institucional (convivencia laboral, COPASST…) se
-- gestiona aparte de los planes de capacitación pero reutiliza toda su
-- maquinaria (reuniones = actividades, jornadas, sala, QR, asistencia,
-- conexiones). Se distingue por `kind` y lleva su resolución de
-- conformación e integrantes con zona, cargo y rol.
CREATE TYPE "PlanKind" AS ENUM ('CAPACITACION', 'COMITE');
CREATE TYPE "CommitteeRole" AS ENUM ('PRINCIPAL_EMPLEADOR', 'SUPLENTE_EMPLEADOR', 'PRINCIPAL_TRABAJADORES', 'SUPLENTE_TRABAJADORES');

ALTER TABLE "TrainingPlan"
  ADD COLUMN "kind" "PlanKind" NOT NULL DEFAULT 'CAPACITACION',
  ADD COLUMN "resolutionNumber" TEXT,
  ADD COLUMN "resolutionDate" TIMESTAMP(3),
  ADD COLUMN "periodLabel" TEXT,
  ADD COLUMN "summary" TEXT,
  ADD COLUMN "functions" JSONB;

CREATE INDEX "TrainingPlan_kind_idx" ON "TrainingPlan"("kind");

CREATE TABLE "CommitteeMember" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "userId" TEXT,
  "fullName" TEXT NOT NULL,
  "documentNumber" TEXT NOT NULL,
  "zone" TEXT NOT NULL,
  "position" TEXT,
  "role" "CommitteeRole" NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommitteeMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CommitteeMember_planId_documentNumber_key" ON "CommitteeMember"("planId", "documentNumber");
CREATE INDEX "CommitteeMember_userId_idx" ON "CommitteeMember"("userId");

ALTER TABLE "CommitteeMember"
  ADD CONSTRAINT "CommitteeMember_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TrainingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommitteeMember"
  ADD CONSTRAINT "CommitteeMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
