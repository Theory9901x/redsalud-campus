-- Permiso propio de Galardones: ver, gestionar y administrar el módulo sin
-- ser administrador del campus (ni tener acceso a Usuarios).
ALTER TABLE "User" ADD COLUMN "canManageGalardones" BOOLEAN NOT NULL DEFAULT false;

-- La cuenta del área de Sistemas (rol TUTOR) lo recibe.
UPDATE "User" SET "canManageGalardones" = true WHERE "username" = 'sistemas';
