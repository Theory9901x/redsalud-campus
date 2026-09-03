import { prisma } from "../lib/prisma";

/**
 * VIDEOTECA HISTORIA CLÍNICA CHRONIS (asistencial) en "Inducción y
 * reinducción": convierte las 6 lecciones sueltas del módulo en UNA
 * lección de videoteca con selector de SERVICIO (urgencias, consulta
 * externa, odontología, PMS Res. 3280 y laboratorio), igual que la de
 * Cronhis Financiero: cada asistencial elige el servicio al que
 * pertenece y ve solo sus videos.
 *
 * El video de laboratorio es un archivo propio (subido a la plataforma),
 * no de YouTube: su URL se toma de la lección existente antes de
 * borrarla, porque difiere entre entornos. Idempotente.
 */
const SLUG_CURSO = "induccion-y-reinduccion";
const TITULO_MODULO = "Sistemas · Historia clínica Chronis (asistencial)";
const TITULO_LECCION = "Videoteca Historia clínica Chronis · por servicios";
const TITULO_LAB = "Laboratorio clínico";

const TITULOS_VIEJOS = [
  "Urgencias y hospitalización · Medicina y auxiliares de enfermería",
  "Prescripción de medicamentos · Urgencias y hospitalización",
  "Consulta externa · Medicina y enfermería",
  "Odontología",
  "Reporte Resolución 3280 · PMS",
  TITULO_LAB,
];

async function main() {
  const curso = await prisma.course.findUniqueOrThrow({ where: { slug: SLUG_CURSO }, select: { id: true } });
  const modulo = await prisma.courseModule.findFirstOrThrow({
    where: { courseId: curso.id, title: TITULO_MODULO },
    select: { id: true },
  });

  const lab = await prisma.lesson.findFirst({
    where: { moduleId: modulo.id, title: TITULO_LAB },
    select: { fileUrl: true },
  });
  const archivoLab =
    lab?.fileUrl ??
    (
      await prisma.lesson.findFirst({
        where: { moduleId: modulo.id, title: TITULO_LECCION },
        select: { contentBody: true },
      })
    )?.contentBody?.match(/"archivo":\s*"([^"]+)"/)?.[1];
  // En desarrollo el archivo del laboratorio puede no estar subido: se deja
  // la URL de producción como referencia y solo se avisa.
  const archivoFinal = archivoLab ?? "/api/media/64561a88-c2e4-40ef-8ddd-c679876deeed";
  if (!archivoLab) console.warn("aviso: sin fileUrl del laboratorio en esta BD; se usa la URL de producción.");

  const videos = [
    { id: "4JSglN2v8cs", titulo: "Historia clínica · Medicina y auxiliares de enfermería", grupo: "Urgencias y hospitalización", seg: 1500 },
    { id: "e64qp7SE1vc", titulo: "Prescripción de medicamentos", grupo: "Urgencias y hospitalización", seg: 1200 },
    { id: "wdHJw7NPz0M", titulo: "Historia clínica · Medicina y enfermería", grupo: "Consulta externa", seg: 1200 },
    { id: "bO-TUPRey-s", titulo: "Historia clínica odontológica", grupo: "Odontología", seg: 1200 },
    { id: "14NDM5AW42E", titulo: "Reporte Resolución 3280 · PMS", grupo: "Promoción y mantenimiento (Res. 3280)", seg: 1200 },
    { id: "lab-redsalud", titulo: "Laboratorio clínico RedSalud", grupo: "Laboratorio clínico", seg: 2144, archivo: archivoFinal },
  ];
  const contenido = JSON.stringify({ videoteca: true, videos });
  const minutos = Math.round(videos.reduce((s, v) => s + v.seg, 0) / 60);

  const borradas = await prisma.lesson.deleteMany({
    where: { moduleId: modulo.id, title: { in: TITULOS_VIEJOS } },
  });
  console.log(`lecciones sueltas eliminadas: ${borradas.count}`);

  const ya = await prisma.lesson.findFirst({ where: { moduleId: modulo.id, title: TITULO_LECCION }, select: { id: true } });
  if (ya) {
    await prisma.lesson.update({ where: { id: ya.id }, data: { contentBody: contenido, estimatedMinutes: minutos } });
    console.log("lección ya existía: contenido refrescado");
  } else {
    await prisma.lesson.create({
      data: {
        moduleId: modulo.id,
        title: TITULO_LECCION,
        description:
          "Los videotutoriales del sistema de historia clínica Chronis en una sola pantalla: elige el servicio al que perteneces (urgencias y hospitalización, consulta externa, odontología, promoción y mantenimiento o laboratorio) y se despliegan los videos que te corresponden.",
        contentType: "YOUTUBE",
        contentBody: contenido,
        videoUrl: "https://www.youtube.com/watch?v=4JSglN2v8cs",
        estimatedMinutes: minutos,
        isRequired: false,
        sortOrder: ((await prisma.lesson.aggregate({ where: { moduleId: modulo.id }, _max: { sortOrder: true } }))._max.sortOrder ?? -1) + 1,
      },
    });
    console.log("lección creada:", TITULO_LECCION);
  }

  console.log(`listo · ${videos.length} videos · ${minutos} min · laboratorio: ${archivoFinal}`);
}

main().finally(() => prisma.$disconnect());
