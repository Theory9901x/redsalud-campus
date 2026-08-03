-- AlterEnum
ALTER TYPE "TrainingPlanStatus" ADD VALUE 'CLOSED';

-- AlterTable
ALTER TABLE "TrainingPlan" ADD COLUMN     "closeObservations" TEXT,
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closedBy" TEXT;

-- AddForeignKey
ALTER TABLE "TrainingPlan" ADD CONSTRAINT "TrainingPlan_closedBy_fkey" FOREIGN KEY ("closedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
