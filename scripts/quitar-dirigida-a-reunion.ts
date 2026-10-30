import "dotenv/config";
import { prisma } from "../lib/prisma";

/**
 * Quita el "Dirigida a" de UNA sesión de reunión, identificada por el código de
 * su acta: la nota y el sufijo " — ..." que se le agregó al título al crearla.
 * Sin --aplicar solo muestra el cambio.
 * Uso: npx tsx scripts/quitar-dirigida-a-reunion.ts ACT-2026-4XL9PH [--aplicar]
 */
async function main() {
  const sufijo = process.argv[2]?.split("-").pop()?.toLowerCase();
  if (!sufijo || sufijo.length !== 6) throw new Error("Indica el código del acta, p. ej. ACT-2026-4XL9PH");
  const halladas = await prisma.trainingActivity.findMany({
    where: { id: { endsWith: sufijo, mode: "insensitive" }, plan: { kind: "REUNION" } },
    select: { id: true, title: true, targetAudienceNote: true },
  });
  if (halladas.length !== 1) throw new Error(`Se esperaba una sesión y hay ${halladas.length}`);
  const [act] = halladas;
  const nota = act.targetAudienceNote;
  const title = nota && act.title.endsWith(` — ${nota}`) ? act.title.slice(0, -` — ${nota}`.length) : act.title;
  console.log("actual:", act);
  console.log("nuevo:", { title, targetAudienceNote: null });
  if (!process.argv.includes("--aplicar")) return;
  await prisma.trainingActivity.update({ where: { id: act.id }, data: { title, targetAudienceNote: null } });
  console.log("listo");
}
main().finally(() => prisma.$disconnect());
