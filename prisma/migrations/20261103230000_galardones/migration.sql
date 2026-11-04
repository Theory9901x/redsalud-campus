-- Noche de Galardones: postulaciones al reconocimiento "Salud y Vida para el
-- Llano" por valor del Código de Integridad y por centro IPS. Solo crea
-- tablas nuevas: no toca ninguna existente ni sus datos.

-- CreateEnum
CREATE TYPE "GalardonValor" AS ENUM ('INTEGRIDAD', 'HUMANIZACION', 'LIDERAZGO');

-- CreateTable
CREATE TABLE "GalardonConvocatoria" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "anio" INTEGER NOT NULL DEFAULT 2026,
    "abierta" BOOLEAN NOT NULL DEFAULT true,
    "cierraEl" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GalardonConvocatoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GalardonCandidato" (
    "id" TEXT NOT NULL,
    "ips" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nombreClave" TEXT NOT NULL,
    "userId" TEXT,
    "fusionadoEnId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GalardonCandidato_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GalardonPostulacion" (
    "id" TEXT NOT NULL,
    "valor" "GalardonValor" NOT NULL,
    "ips" TEXT NOT NULL,
    "nombreEscrito" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "candidatoId" TEXT NOT NULL,
    "votanteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GalardonPostulacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GalardonCandidato_ips_nombreClave_idx" ON "GalardonCandidato"("ips", "nombreClave");
CREATE INDEX "GalardonCandidato_userId_idx" ON "GalardonCandidato"("userId");
CREATE UNIQUE INDEX "GalardonPostulacion_votanteId_valor_key" ON "GalardonPostulacion"("votanteId", "valor");
CREATE INDEX "GalardonPostulacion_ips_valor_idx" ON "GalardonPostulacion"("ips", "valor");
CREATE INDEX "GalardonPostulacion_candidatoId_idx" ON "GalardonPostulacion"("candidatoId");

-- AddForeignKey
ALTER TABLE "GalardonCandidato" ADD CONSTRAINT "GalardonCandidato_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GalardonCandidato" ADD CONSTRAINT "GalardonCandidato_fusionadoEnId_fkey" FOREIGN KEY ("fusionadoEnId") REFERENCES "GalardonCandidato"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "GalardonPostulacion" ADD CONSTRAINT "GalardonPostulacion_candidatoId_fkey" FOREIGN KEY ("candidatoId") REFERENCES "GalardonCandidato"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GalardonPostulacion" ADD CONSTRAINT "GalardonPostulacion_votanteId_fkey" FOREIGN KEY ("votanteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
