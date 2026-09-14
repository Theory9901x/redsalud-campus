import { randomInt } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { leerConfig } from "../../lib/encuestas/tipos";

/**
 * SOLO DESARROLLO: genera respuestas sintéticas de la encuesta SIAU para
 * probar métricas, informes y exportables (varias sedes, servicios, meses).
 * Se niega a correr contra producción.
 *
 * Uso: npx tsx --env-file=.env scripts/demo/generar-respuestas-siau.ts [cantidad]
 */
async function main() {
  if ((process.env.DATABASE_URL ?? "").includes("redsalud_prod")) throw new Error("No se generan datos sintéticos en producción.");
  const cantidad = Number(process.argv[2] ?? 240);
  const encuesta = await prisma.survey.findFirstOrThrow({
    where: { code: { startsWith: "PM-7-SIAU" } },
    include: { pages: { orderBy: { sortOrder: "asc" }, include: { questions: { orderBy: { sortOrder: "asc" } } } } },
  });
  const preguntas = encuesta.pages.flatMap((p) => p.questions.map((q) => ({ ...q, c: leerConfig(q.config) })));
  const elige = <T,>(arr: T[], pesos?: number[]): T => {
    if (!pesos) return arr[randomInt(arr.length)];
    const total = pesos.reduce((s, p) => s + p, 0);
    let r = Math.random() * total;
    for (let i = 0; i < arr.length; i++) { r -= pesos[i]; if (r <= 0) return arr[i]; }
    return arr[arr.length - 1];
  };
  const sedes = preguntas.find((q) => q.c.rol === "municipio")!.c.opciones!;
  const servicios = preguntas.find((q) => q.c.estilo === "servicios")!.c.opciones!;
  const epss = preguntas.find((q) => q.c.rol === "eps")!.c.opciones!;

  let creadas = 0;
  for (let i = 0; i < cantidad; i++) {
    // Fechas repartidas en los últimos 8 meses.
    const fecha = new Date(Date.now() - randomInt(0, 8 * 30) * 86400e3 - randomInt(0, 86400e3));
    const sede = elige(sedes.slice(0, -1));
    const calidadSede = 0.6 + (sedes.indexOf(sede) % 5) * 0.08; // sedes con distinta calidad
    const answers: { questionId: string; value: object; textValue?: string }[] = [];
    for (const q of preguntas) {
      const ops = q.c.opciones ?? [];
      if (q.c.estilo === "habeas") answers.push({ questionId: q.id, value: { tipo: "opcion", opcionId: "si" } });
      else if (q.c.rol === "fecha") answers.push({ questionId: q.id, value: { tipo: "fecha", valor: fecha.toISOString().slice(0, 10) } });
      else if (q.c.rol === "nombre") { if (Math.random() < 0.5) answers.push({ questionId: q.id, value: { tipo: "texto", texto: `Usuario ${i + 1}` }, textValue: `Usuario ${i + 1}` }); }
      else if (q.c.estilo === "sexo") answers.push({ questionId: q.id, value: { tipo: "opcion", opcionId: elige(["M", "F"], [45, 55]) } });
      else if (q.c.rol === "eps") answers.push({ questionId: q.id, value: { tipo: "opcion", opcionId: elige(epss.slice(0, 6)).id } });
      else if (q.c.rol === "municipio") answers.push({ questionId: q.id, value: { tipo: "opcion", opcionId: sede.id } });
      else if (q.c.estilo === "servicios") answers.push({ questionId: q.id, value: { tipo: "opcion", opcionId: elige(servicios.slice(0, -1)).id } });
      else if (q.c.estilo === "matriz") { if (Math.random() < 0.45) answers.push({ questionId: q.id, value: { tipo: "opcion", opcionId: elige(ops, ops.map((o) => (o.tono === "exc" ? 50 * calidadSede : o.tono === "bue" ? 30 : o.tono === "reg" ? 10 : o.tono === "mal" ? 4 : 6))).id } }); }
      else if (ops.length && (q.c.estilo === "caritas" || q.c.estilo === "tarjetas" || q.c.estilo === "semaforo")) {
        const pesos = ops.map((o) => (o.tono === "exc" ? 55 * calidadSede : o.tono === "bue" ? 30 : o.tono === "reg" ? 10 : o.tono === "mal" ? 4 : o.tono === "muymal" ? 2 : 3));
        answers.push({ questionId: q.id, value: { tipo: "opcion", opcionId: elige(ops, pesos).id } });
      } else if (q.type === "LONG_TEXT") { if (Math.random() < 0.25) { const t = elige(["Más médicos en urgencias, la espera fue larga.", "Excelente atención, muy amables.", "Mejorar la limpieza de los baños.", "Faltó información sobre el tratamiento.", "Todo bien, gracias."]); answers.push({ questionId: q.id, value: { tipo: "texto", texto: t }, textValue: t }); } }
    }
    await prisma.surveyResponse.create({
      data: { surveyId: encuesta.id, completed: true, startedAt: new Date(fecha.getTime() - 120e3), submittedAt: fecha, channel: "publico", answers: { create: answers } },
    });
    creadas++;
  }
  console.log(`respuestas sintéticas creadas: ${creadas}`);
}
main().finally(() => prisma.$disconnect());
