-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('MANUAL', 'AUTOMATIC');

-- DropForeignKey
ALTER TABLE "TrainingAttendance" DROP CONSTRAINT "TrainingAttendance_registeredBy_fkey";

-- AlterTable
ALTER TABLE "TrainingAttendance" ADD COLUMN     "source" "AttendanceSource" NOT NULL DEFAULT 'MANUAL',
ALTER COLUMN "registeredBy" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "TrainingAttendance" ADD CONSTRAINT "TrainingAttendance_registeredBy_fkey" FOREIGN KEY ("registeredBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
