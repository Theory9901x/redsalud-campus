import { prisma } from "../../lib/prisma";
import { SLUG_DEMO } from "./montar-curso-demo";

/** Publica el curso demo (acción de administrador) y resume lo montado. */
async function main() {
  const curso = await prisma.course.update({
    where: { slug: SLUG_DEMO },
    data: { status: "PUBLISHED", publishedAt: new Date() },
    include: {
      modules: { include: { lessons: { orderBy: { sortOrder: "asc" }, select: { title: true, contentType: true, fileUrl: true, contentBody: true, description: true } } } },
      quizzes: { include: { questions: { include: { options: true } } } },
    },
  });
  const lecciones = curso.modules.flatMap((m) => m.lessons);
  const t = lecciones[0]?.contentBody ?? "";
  console.log(curso.title, "→", curso.status);
  console.log("lecciones:", lecciones.length, "| con archivo:", lecciones.filter((l) => l.fileUrl).length, "| descripciones:", lecciones.every((l) => l.description));
  console.log("texto L1: h2 =", t.includes("<h2>"), "| enlace =", t.includes('href="https://www.minsalud.gov.co"'), "| embebido =", t.includes("youtube.com/embed/"));
  console.log("preguntas:", curso.quizzes[0]?.questions.map((q) => `${q.type}:${q.options.length}op${q.imageUrl ? "+img" : ""}`).join(", "));
}

main().finally(() => prisma.$disconnect());
