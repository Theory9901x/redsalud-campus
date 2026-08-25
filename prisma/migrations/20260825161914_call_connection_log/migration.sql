-- CreateTable
CREATE TABLE "CallConnectionLog" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" TEXT,
    "externalParticipantId" TEXT,
    "displayName" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL,
    "leftAt" TIMESTAMP(3) NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallConnectionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CallConnectionLog_activityId_idx" ON "CallConnectionLog"("activityId");

-- CreateIndex
CREATE INDEX "CallConnectionLog_userId_idx" ON "CallConnectionLog"("userId");

-- AddForeignKey
ALTER TABLE "CallConnectionLog" ADD CONSTRAINT "CallConnectionLog_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "TrainingActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallConnectionLog" ADD CONSTRAINT "CallConnectionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallConnectionLog" ADD CONSTRAINT "CallConnectionLog_externalParticipantId_fkey" FOREIGN KEY ("externalParticipantId") REFERENCES "ExternalParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
