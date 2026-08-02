-- CreateEnum
CREATE TYPE "TrainingModality" AS ENUM ('VIRTUAL', 'PRESENCIAL', 'MIXTA');

-- CreateEnum
CREATE TYPE "SessionShift" AS ENUM ('MANANA', 'TARDE');

-- AlterTable
ALTER TABLE "TrainingActivity" ADD COLUMN     "areaId" TEXT,
ADD COLUMN     "expectedAttendees" INTEGER,
ADD COLUMN     "expectedAttendeesNote" TEXT,
ADD COLUMN     "followUpEvidence" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "methodology" TEXT,
ADD COLUMN     "modality" "TrainingModality",
ADD COLUMN     "objective" TEXT,
ADD COLUMN     "quarters" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "responsibleLabel" TEXT,
ADD COLUMN     "responsibleUserId" TEXT,
ADD COLUMN     "sourceRow" INTEGER,
ADD COLUMN     "targetAudienceNote" TEXT,
ALTER COLUMN "startDate" DROP NOT NULL;

-- CreateTable
CREATE TABLE "TrainingArea" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TrainingArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "shift" "SessionShift",
    "modality" "TrainingModality" NOT NULL DEFAULT 'VIRTUAL',
    "location" TEXT,
    "meetingUrl" TEXT,
    "capacity" INTEGER,
    "municipioId" TEXT,
    "status" "TrainingActivityStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrainingArea_name_key" ON "TrainingArea"("name");

-- CreateIndex
CREATE INDEX "TrainingArea_isActive_idx" ON "TrainingArea"("isActive");

-- CreateIndex
CREATE INDEX "TrainingSession_activityId_idx" ON "TrainingSession"("activityId");

-- CreateIndex
CREATE INDEX "TrainingSession_startsAt_idx" ON "TrainingSession"("startsAt");

-- CreateIndex
CREATE INDEX "TrainingActivity_areaId_idx" ON "TrainingActivity"("areaId");

-- AddForeignKey
ALTER TABLE "TrainingActivity" ADD CONSTRAINT "TrainingActivity_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "TrainingArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingActivity" ADD CONSTRAINT "TrainingActivity_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "TrainingActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "Municipio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
