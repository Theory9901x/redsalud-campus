-- CreateTable
CREATE TABLE "ExternalParticipant" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalAttempt" (
    "id" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "moment" "EvaluationMoment" NOT NULL,
    "score" INTEGER NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "answers" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExternalParticipant_activityId_idx" ON "ExternalParticipant"("activityId");

-- CreateIndex
CREATE INDEX "ExternalAttempt_participantId_idx" ON "ExternalAttempt"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalAttempt_participantId_moment_key" ON "ExternalAttempt"("participantId", "moment");

-- AddForeignKey
ALTER TABLE "ExternalParticipant" ADD CONSTRAINT "ExternalParticipant_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "TrainingActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExternalAttempt" ADD CONSTRAINT "ExternalAttempt_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "ExternalParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
