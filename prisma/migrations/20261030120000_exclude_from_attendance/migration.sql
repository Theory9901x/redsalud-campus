ALTER TABLE "User" ADD COLUMN "excludeFromAttendance" BOOLEAN NOT NULL DEFAULT false;
-- La cuenta de administracion del sistema entra a las salas a revisar, no a asistir. El seed no toca cuentas existentes: su cargo se corrige aqui.
UPDATE "User" SET "excludeFromAttendance" = true, position = 'Administrador del sistema' WHERE role = 'ADMIN' AND (lower(email) = 'redsaludteforma@gmail.com' OR lower("fullName") = 'mateo robayo moreno');
