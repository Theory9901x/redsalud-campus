-- AlterEnum
ALTER TYPE "QuestionType" ADD VALUE 'OPEN_TEXT';

-- AlterTable
ALTER TABLE "QuizAnswer" ADD COLUMN     "textAnswer" TEXT;
