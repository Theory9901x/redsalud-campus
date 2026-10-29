ALTER TABLE "TrainingSession" ADD COLUMN "audience" TEXT NOT NULL DEFAULT 'BOTH';
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_audience_check" CHECK ("audience" IN ('INTERNAL', 'EXTERNAL', 'BOTH'));
