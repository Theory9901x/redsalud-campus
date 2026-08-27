import { prisma } from "../../lib/prisma";
import { htmlSeguro } from "../../lib/html-seguro";
import { SLUG_DEMO } from "./montar-curso-demo";

/**
 * Asegura que la lección 1 del curso demo tenga un enlace de muestra (la
 * automatización por interfaz lo pierde a veces por tiempos de red).
 * Idempotente: si ya hay enlace, no toca nada.
 */
async function main() {
  const l1 = await prisma.lesson.findFirstOrThrow({
    where: { module: { course: { slug: SLUG_DEMO } } },
    orderBy: { sortOrder: "asc" },
    select: { id: true, contentBody: true },
  });
  const actual = l1.contentBody ?? "";
  if (actual.includes('href="https://www.minsalud.gov.co"')) {
    console.log("la lección 1 ya tiene enlace; sin cambios");
    return;
  }
  const parrafo = '<p>Consulta la <a href="https://www.minsalud.gov.co">normativa vigente</a> del Ministerio de Salud.</p>';
  const nuevo = actual.replace("<p></p>", parrafo).includes(parrafo) ? actual.replace("<p></p>", parrafo) : actual + parrafo;
  await prisma.lesson.update({ where: { id: l1.id }, data: { contentBody: htmlSeguro(nuevo) } });
  console.log("enlace añadido a la lección 1");
}

main().finally(() => prisma.$disconnect());
