-- Capacitación dirigida a los integrantes de un comité (audiencia = CommitteeMember del plan-comité).
ALTER TABLE "TrainingActivity" ADD COLUMN IF NOT EXISTS "audienceCommitteePlanId" TEXT;
