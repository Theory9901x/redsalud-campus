-- AlterTable
ALTER TABLE "TrainingArea" ADD COLUMN     "tutorId" TEXT;

-- CreateIndex
CREATE INDEX "TrainingArea_tutorId_idx" ON "TrainingArea"("tutorId");

-- AddForeignKey
ALTER TABLE "TrainingArea" ADD CONSTRAINT "TrainingArea_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
