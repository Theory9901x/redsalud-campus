import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { prisma } from "../lib/prisma";
import { saveTrainingPlanDocument } from "../lib/storage";

/**
 * Adjunta un archivo del disco a un plan o comité, como si se hubiera
 * subido desde la interfaz (mismo almacenamiento privado y registro Media).
 *
 * Uso: npx tsx --env-file=.env scripts/adjuntar-documento-plan.ts <planId> <ruta> [nombre visible]
 */
async function main() {
  const [planId, ruta, nombre] = process.argv.slice(2);
  if (!planId || !ruta) throw new Error("Uso: <planId> <ruta> [nombre visible]");
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (!admin) throw new Error("Sin administrador.");
  const plan = await prisma.trainingPlan.findUnique({ where: { id: planId }, select: { title: true } });
  if (!plan) throw new Error("Plan no encontrado.");

  const buffer = await readFile(ruta);
  const tipo = ruta.toLowerCase().endsWith(".pdf") ? "application/pdf" : "application/octet-stream";
  const file = new File([buffer], nombre ?? basename(ruta), { type: tipo });
  const media = await saveTrainingPlanDocument(file, planId, admin.id);
  console.log(`adjuntado a «${plan.title}»: ${file.name} (${Math.round(file.size / 1024)} KB) → ${JSON.stringify(media).slice(0, 120)}`);
}

main().finally(() => prisma.$disconnect());
