-- Gestión de indicadores del PIC: análisis cualitativo por periodo y planes
-- de mejora asignados a vigencia, trimestre, área y capacitación. Solo crea
-- tablas nuevas: no toca ninguna existente ni sus datos.


-- CreateEnum
CREATE TYPE "PlanMejoraEstado" AS ENUM ('ABIERTO', 'EN_CURSO', 'CERRADO');

-- CreateTable
CREATE TABLE "IndicadorAnalisis" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "trimestre" INTEGER NOT NULL,
    "areaId" TEXT,
    "texto" TEXT NOT NULL,
    "autorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndicadorAnalisis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanMejora" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "trimestre" INTEGER,
    "areaId" TEXT,
    "activityId" TEXT,
    "titulo" TEXT NOT NULL,
    "hallazgo" TEXT NOT NULL,
    "acciones" TEXT NOT NULL,
    "responsableUserId" TEXT,
    "responsableLabel" TEXT,
    "fechaCompromiso" TIMESTAMP(3) NOT NULL,
    "estado" "PlanMejoraEstado" NOT NULL DEFAULT 'ABIERTO',
    "cierreTexto" TEXT,
    "cerradoAt" TIMESTAMP(3),
    "creadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanMejora_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanMejoraSeguimiento" (
    "id" TEXT NOT NULL,
    "planMejoraId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "avance" INTEGER NOT NULL DEFAULT 0,
    "autorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanMejoraSeguimiento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IndicadorAnalisis_planId_codigo_idx" ON "IndicadorAnalisis"("planId", "codigo");

-- CreateIndex
CREATE INDEX "IndicadorAnalisis_areaId_idx" ON "IndicadorAnalisis"("areaId");

-- CreateIndex
CREATE UNIQUE INDEX "IndicadorAnalisis_planId_codigo_anio_trimestre_areaId_key" ON "IndicadorAnalisis"("planId", "codigo", "anio", "trimestre", "areaId");

-- CreateIndex
CREATE INDEX "PlanMejora_planId_codigo_idx" ON "PlanMejora"("planId", "codigo");

-- CreateIndex
CREATE INDEX "PlanMejora_areaId_idx" ON "PlanMejora"("areaId");

-- CreateIndex
CREATE INDEX "PlanMejora_activityId_idx" ON "PlanMejora"("activityId");

-- CreateIndex
CREATE INDEX "PlanMejora_estado_idx" ON "PlanMejora"("estado");

-- CreateIndex
CREATE INDEX "PlanMejoraSeguimiento_planMejoraId_idx" ON "PlanMejoraSeguimiento"("planMejoraId");

-- AddForeignKey
ALTER TABLE "IndicadorAnalisis" ADD CONSTRAINT "IndicadorAnalisis_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TrainingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndicadorAnalisis" ADD CONSTRAINT "IndicadorAnalisis_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "TrainingArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndicadorAnalisis" ADD CONSTRAINT "IndicadorAnalisis_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanMejora" ADD CONSTRAINT "PlanMejora_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TrainingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanMejora" ADD CONSTRAINT "PlanMejora_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "TrainingArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanMejora" ADD CONSTRAINT "PlanMejora_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "TrainingActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanMejora" ADD CONSTRAINT "PlanMejora_responsableUserId_fkey" FOREIGN KEY ("responsableUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanMejora" ADD CONSTRAINT "PlanMejora_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanMejoraSeguimiento" ADD CONSTRAINT "PlanMejoraSeguimiento_planMejoraId_fkey" FOREIGN KEY ("planMejoraId") REFERENCES "PlanMejora"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanMejoraSeguimiento" ADD CONSTRAINT "PlanMejoraSeguimiento_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

