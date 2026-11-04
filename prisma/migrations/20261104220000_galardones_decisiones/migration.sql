-- Galardones: ganador definido por Talento Humano (desempates).
CREATE TABLE "GalardonDecision" (
    "id" TEXT NOT NULL,
    "ips" TEXT NOT NULL,
    "valor" "GalardonValor" NOT NULL,
    "candidatoId" TEXT NOT NULL,
    "decididoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GalardonDecision_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GalardonDecision_ips_valor_key" ON "GalardonDecision"("ips", "valor");
CREATE INDEX "GalardonDecision_candidatoId_idx" ON "GalardonDecision"("candidatoId");
ALTER TABLE "GalardonDecision" ADD CONSTRAINT "GalardonDecision_candidatoId_fkey" FOREIGN KEY ("candidatoId") REFERENCES "GalardonCandidato"("id") ON DELETE CASCADE ON UPDATE CASCADE;
