ALTER TABLE "TrainingPlan" ADD COLUMN "isIndependent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TrainingPlan" ADD COLUMN "independentAreaId" TEXT;
CREATE UNIQUE INDEX "TrainingPlan_independentAreaId_key" ON "TrainingPlan"("independentAreaId");
ALTER TABLE "TrainingPlan" ADD CONSTRAINT "TrainingPlan_independentAreaId_fkey" FOREIGN KEY ("independentAreaId") REFERENCES "TrainingArea"(id) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CallConnectionLog" ADD COLUMN "event" TEXT NOT NULL DEFAULT 'LEAVE';
