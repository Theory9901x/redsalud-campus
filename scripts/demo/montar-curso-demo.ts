import { prisma } from "../../lib/prisma";

/**
 * Curso [DEMO] para la capacitación "cómo crear un módulo en un curso".
 *
 * Solo crea el CASCARÓN del curso (crear cursos es del administrador y en
 * dev no se entra con esa cuenta): el temario -módulo, lecciones de cada
 * tipo y la evaluación- se monta después por la interfaz del tutor demo,
 * que es justo el flujo que se va a enseñar. Idempotente por slug.
 */
import { SLUG_DEMO } from "./curso-demo";

async function main() {
  const tutora = await prisma.user.findUniqueOrThrow({ where: { email: "demo.tutora@ejemplo.test" }, select: { id: true } });
  const categoria = await prisma.courseCategory.findFirst({ where: { name: { contains: "Seguridad" } }, select: { id: true } });

  const curso = await prisma.course.upsert({
    where: { slug: SLUG_DEMO },
    update: {},
    create: {
      title: "[DEMO] Manejo de residuos hospitalarios",
      slug: SLUG_DEMO,
      shortDescription: "Curso corto de demostración: segregación de residuos por código de colores, con todos los tipos de contenido y una evaluación completa.",
      fullDescription:
        "Curso de un solo módulo pensado para enseñar el constructor: lección de texto enriquecido con embebido, video de YouTube, PDF, imagen, video subido, enlace externo y lección mixta; cierra con un cuestionario de cuatro tipos de pregunta.",
      categoryId: categoria?.id ?? null,
      courseType: "CAPACITACION",
      durationHours: 2,
      passingScore: 70,
      enrollmentMode: "OPEN",
      targetAudience: "AMBOS",
      isSequential: true,
      status: "DRAFT",
      tutorId: tutora.id,
    },
    select: { id: true, title: true, status: true },
  });
  console.log("curso demo:", curso.id, curso.title, curso.status);
}

main().finally(() => prisma.$disconnect());
