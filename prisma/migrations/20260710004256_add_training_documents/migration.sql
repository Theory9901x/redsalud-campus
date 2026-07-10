-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "trainingActivityId" TEXT,
ADD COLUMN     "trainingPlanId" TEXT;

-- CreateIndex
CREATE INDEX "Media_trainingPlanId_idx" ON "Media"("trainingPlanId");

-- CreateIndex
CREATE INDEX "Media_trainingActivityId_idx" ON "Media"("trainingActivityId");

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_trainingPlanId_fkey" FOREIGN KEY ("trainingPlanId") REFERENCES "TrainingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_trainingActivityId_fkey" FOREIGN KEY ("trainingActivityId") REFERENCES "TrainingActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
