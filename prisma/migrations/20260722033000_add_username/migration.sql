-- Identificador de acceso alterno para el personal sin correo propio válido.
ALTER TABLE "User" ADD COLUMN "username" TEXT;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
