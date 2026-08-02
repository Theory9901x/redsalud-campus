-- CreateEnum
CREATE TYPE "EvaluationMoment" AS ENUM ('PRESABER', 'POSTSABER');

-- AlterTable
ALTER TABLE "QuizAttempt" ADD COLUMN     "moment" "EvaluationMoment";

-- AlterTable
ALTER TABLE "TrainingActivity" ADD COLUMN     "postsaberClosedAt" TIMESTAMP(3),
ADD COLUMN     "postsaberOpenedAt" TIMESTAMP(3),
ADD COLUMN     "presaberClosedAt" TIMESTAMP(3),
ADD COLUMN     "presaberOpenedAt" TIMESTAMP(3);
