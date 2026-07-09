-- CreateEnum
CREATE TYPE "PersonnelType" AS ENUM ('ADMINISTRATIVO', 'ASISTENCIAL');

-- CreateEnum
CREATE TYPE "CourseAudience" AS ENUM ('ADMINISTRATIVO', 'ASISTENCIAL', 'AMBOS');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "targetAudience" "CourseAudience" NOT NULL DEFAULT 'AMBOS';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "personnelType" "PersonnelType" NOT NULL DEFAULT 'ADMINISTRATIVO';

-- CreateIndex
CREATE INDEX "Course_status_targetAudience_idx" ON "Course"("status", "targetAudience");

-- CreateIndex
CREATE INDEX "User_personnelType_idx" ON "User"("personnelType");
