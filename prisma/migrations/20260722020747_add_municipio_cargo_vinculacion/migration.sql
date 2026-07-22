-- CreateEnum
CREATE TYPE "TipoVinculacion" AS ENUM ('PLANTA', 'CARRERA_ADMINISTRATIVA', 'PROVISIONAL', 'CONTRATO_PRESTACION', 'OTRO');

-- CreateEnum
CREATE TYPE "OrigenRegistro" AS ENUM ('IMPORTACION', 'AUTO');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "cargoId" TEXT,
ADD COLUMN     "municipioId" TEXT,
ADD COLUMN     "origenRegistro" "OrigenRegistro" NOT NULL DEFAULT 'AUTO',
ADD COLUMN     "provisionedAt" TIMESTAMP(3),
ADD COLUMN     "provisionedBy" TEXT,
ADD COLUMN     "tipoVinculacion" "TipoVinculacion" NOT NULL DEFAULT 'CONTRATO_PRESTACION';

-- CreateTable
CREATE TABLE "Municipio" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "departamento" TEXT NOT NULL DEFAULT 'Casanare',
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Municipio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cargo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "personnelType" "PersonnelType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Cargo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Municipio_nombre_key" ON "Municipio"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Cargo_nombre_key" ON "Cargo"("nombre");

-- CreateIndex
CREATE INDEX "Cargo_personnelType_idx" ON "Cargo"("personnelType");

-- CreateIndex
CREATE INDEX "User_municipioId_idx" ON "User"("municipioId");

-- CreateIndex
CREATE INDEX "User_cargoId_idx" ON "User"("cargoId");

-- CreateIndex
CREATE INDEX "User_tipoVinculacion_idx" ON "User"("tipoVinculacion");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_municipioId_fkey" FOREIGN KEY ("municipioId") REFERENCES "Municipio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
