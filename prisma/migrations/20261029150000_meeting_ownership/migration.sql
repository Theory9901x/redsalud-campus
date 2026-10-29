ALTER TABLE "User" ADD COLUMN "canManageAllMeetings" BOOLEAN NOT NULL DEFAULT false;
-- La cuenta de administracion general ya provisionada por el seed.
UPDATE "User" SET "canManageAllMeetings" = true WHERE role = 'ADMIN' AND lower(email) = 'redsaludteforma@gmail.com';
ALTER TABLE "TrainingPlan" ADD COLUMN "createdById" TEXT;
ALTER TABLE "TrainingPlan" ADD CONSTRAINT "TrainingPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"(id) ON DELETE SET NULL ON UPDATE CASCADE;
-- Recupera al creador original de la bitacora. Las altas por script sin bitacora quedan a nombre de su responsable actual.
UPDATE "TrainingPlan" p SET "createdById" = COALESCE((
 SELECT a."userId" FROM "AuditLog" a JOIN "User" u ON u.id = a."userId"
 WHERE a."entityId" = p.id AND a.entity = 'TrainingPlan' AND a.action = 'CREATE'
 ORDER BY a."createdAt", a.id LIMIT 1
), p."tutorId") WHERE p.kind = 'REUNION';
CREATE INDEX "TrainingPlan_createdById_idx" ON "TrainingPlan"("createdById");
