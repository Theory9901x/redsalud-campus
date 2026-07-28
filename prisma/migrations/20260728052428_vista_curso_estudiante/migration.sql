-- AlterTable
ALTER TABLE "LessonProgress" ADD COLUMN     "lastPositionSeconds" INTEGER;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "area" TEXT;

-- AlterTable
ALTER TABLE "QuizAnswer" ADD COLUMN     "flagged" BOOLEAN NOT NULL DEFAULT false;
