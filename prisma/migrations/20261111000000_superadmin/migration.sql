-- Superadministrador: la única cuenta que puede eliminar reuniones.
ALTER TABLE "User" ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Es la cuenta administradora original del sistema (la primera ADMIN creada,
-- la del seed). Las demás cuentas ADMIN (p. ej. Talento Humano) no lo son.
UPDATE "User" SET "isSuperAdmin" = true
WHERE "id" = (SELECT "id" FROM "User" WHERE "role" = 'ADMIN' ORDER BY "createdAt" ASC LIMIT 1);
