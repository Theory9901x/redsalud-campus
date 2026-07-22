/**
 * Auto-inscripción del personal importado en los cursos obligatorios que le
 * corresponden a su grupo poblacional (Fase 7.3).
 *
 *   npx tsx --env-file=.env prisma/auto-inscribir-obligatorios.ts [slug] [--commit]
 *
 * Sin --commit corre en DRY-RUN. Idempotente: quien ya está inscrito no se
 * duplica ni se le reinicia el avance. Si se pasa un slug, solo ese curso;
 * si no, todos los cursos publicados de tipo OBLIGATORIO.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const commit = process.argv.includes("--commit");
  const slug = process.argv.slice(2).find((a) => !a.startsWith("--"));

  const cursos = await prisma.course.findMany({
    where: slug ? { slug } : { status: "PUBLISHED", courseType: "OBLIGATORIO" },
    select: { id: true, title: true, slug: true, targetAudience: true, status: true },
  });

  if (cursos.length === 0) {
    console.log("No hay cursos que coincidan.");
    await prisma.$disconnect();
    return;
  }

  console.log(commit ? "=== APLICANDO ===" : "=== DRY-RUN (no escribe) ===");

  for (const curso of cursos) {
    // El público objetivo del curso decide a quién le corresponde: AMBOS va a
    // todo el personal, ASISTENCIAL/ADMINISTRATIVO solo a su grupo.
    const dondePersonal =
      curso.targetAudience === "AMBOS" ? {} : { personnelType: curso.targetAudience };

    const candidatos = await prisma.user.findMany({
      where: { role: "STUDENT", status: "ACTIVE", ...dondePersonal },
      select: { id: true },
    });

    const yaInscritos = await prisma.enrollment.findMany({
      where: { courseId: curso.id, userId: { in: candidatos.map((c) => c.id) } },
      select: { userId: true },
    });
    const yaInscritosIds = new Set(yaInscritos.map((e) => e.userId));
    const porInscribir = candidatos.filter((c) => !yaInscritosIds.has(c.id));

    console.log(`\n${curso.title} (${curso.slug}) — dirigido a ${curso.targetAudience}, estado ${curso.status}`);
    console.log(`  candidatos:      ${candidatos.length}`);
    console.log(`  ya inscritos:    ${yaInscritos.length}`);
    console.log(`  se inscribirían: ${porInscribir.length}`);

    if (commit && porInscribir.length > 0) {
      // createMany en una sola pasada: 284 inserciones sueltas contra la BD
      // remota serían 284 viajes de ida y vuelta.
      const { count } = await prisma.enrollment.createMany({
        data: porInscribir.map((c) => ({ userId: c.id, courseId: curso.id, status: "ACTIVE" as const })),
        skipDuplicates: true,
      });
      console.log(`  INSCRITOS: ${count}`);
    }
  }

  if (!commit) console.log("\nNada fue escrito. Repite con --commit para aplicar.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
