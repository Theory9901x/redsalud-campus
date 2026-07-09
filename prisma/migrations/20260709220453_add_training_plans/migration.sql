-- CreateEnum
CREATE TYPE "TrainingPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TrainingActivityType" AS ENUM ('COURSE', 'EXTERNAL_EVENT');

-- CreateEnum
CREATE TYPE "TrainingActivityStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "TrainingPlan" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "description" TEXT,
    "targetDepartment" TEXT NOT NULL,
    "tutorId" TEXT NOT NULL,
    "status" "TrainingPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingActivity" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "TrainingActivityType" NOT NULL,
    "courseId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "targetAudience" "CourseAudience" NOT NULL DEFAULT 'AMBOS',
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "status" "TrainingActivityStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingPlan_tutorId_idx" ON "TrainingPlan"("tutorId");

-- CreateIndex
CREATE INDEX "TrainingPlan_targetDepartment_idx" ON "TrainingPlan"("targetDepartment");

-- CreateIndex
CREATE INDEX "TrainingActivity_planId_idx" ON "TrainingActivity"("planId");

-- CreateIndex
CREATE INDEX "TrainingActivity_courseId_idx" ON "TrainingActivity"("courseId");

-- AddForeignKey
ALTER TABLE "TrainingPlan" ADD CONSTRAINT "TrainingPlan_tutorId_fkey" FOREIGN KEY ("tutorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingActivity" ADD CONSTRAINT "TrainingActivity_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TrainingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingActivity" ADD CONSTRAINT "TrainingActivity_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
