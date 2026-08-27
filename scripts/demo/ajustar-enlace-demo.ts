import { prisma } from "../../lib/prisma";
import { htmlSeguro } from "../../lib/html-seguro";
import { SLUG_DEMO } from "./montar-curso-demo";

/**
 * Deja la lección 1 del curso demo con un contenido enriquecido limpio y
 * completo (párrafo, título, lista, enlace y embebido): la automatización
 * por interfaz, con retardo de red, puede insertar el embebido a mitad de
 * frase. Idempotente: siempre deja el mismo contenido.
 */
const CONTENIDO = `
<p>La segregación correcta reduce el riesgo biológico y el costo de disposición final.</p>
<h2>Lo que debes recordar</h2>
<ul>
  <li><p>Rojo: biosanitarios y cortopunzantes (en guardián).</p></li>
  <li><p>Negro: no aprovechables.</p></li>
  <li><p>Blanco: aprovechables limpios y secos.</p></li>
</ul>
<p>Consulta la <a href="https://www.minsalud.gov.co">normativa vigente</a> del Ministerio de Salud.</p>
<h3>Video de referencia</h3>
<div data-embebido class="embebido"><iframe src="https://www.youtube.com/embed/3PmVJQUCm4E" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen="true" frameborder="0" title="Contenido embebido"></iframe></div>
`;

async function main() {
  const curso = await prisma.course.findUniqueOrThrow({ where: { slug: SLUG_DEMO }, select: { id: true } });
  const modulo = await prisma.courseModule.findFirstOrThrow({ where: { courseId: curso.id }, orderBy: { sortOrder: "asc" }, select: { id: true } });
  const l1 = await prisma.lesson.findFirstOrThrow({ where: { moduleId: modulo.id }, orderBy: { sortOrder: "asc" }, select: { id: true } });
  await prisma.lesson.update({ where: { id: l1.id }, data: { contentBody: htmlSeguro(CONTENIDO) } });
  console.log("lección 1 del demo actualizada con contenido limpio");
}

main().finally(() => prisma.$disconnect());
