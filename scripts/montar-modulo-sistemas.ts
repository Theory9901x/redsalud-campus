import { readFile } from "node:fs/promises";
import { prisma } from "../lib/prisma";
import { saveLessonFile } from "../lib/storage";

/**
 * MÓDULO DE SISTEMAS del curso "Inducción y reinducción".
 *
 * Tres módulos nuevos al final del temario:
 *  - Seguridad digital (video institucional por elaborar: lección aviso).
 *  - Historia clínica Chronis, para personal ASISTENCIAL: videos del
 *    proveedor del sistema (Chronis) EMBEBIDOS desde su canal de YouTube
 *    -los videos no son nuestros, no se descargan ni se copian-.
 *  - Facturación de servicios, para personal ADMINISTRATIVO: idem.
 *
 * TODO queda visible para todos y NADA es obligatorio todavía: con 293
 * inscritos, una lección obligatoria nueva bajaría el avance de todo el
 * mundo. Cuando exista la pregunta condicional (asistencial vs
 * administrativo) se decidirá qué ve y qué debe completar cada quien.
 *
 * La lección de Laboratorio clínico usa el video institucional local
 * (VIDEO_LAB=/ruta/laboratorioredsalud.mp4); antes se enviaba por WhatsApp.
 *
 * Idempotente por título de módulo. Sin evaluación, a propósito.
 */

const SLUG_CURSO = "induccion-y-reinduccion";

type LeccionDef = {
  titulo: string;
  descripcion: string;
  tipo: "TEXT" | "YOUTUBE" | "VIDEO";
  youtube?: string;
  texto?: string;
  minutos?: number;
};

const MODULOS: { titulo: string; descripcion: string; lecciones: LeccionDef[] }[] = [
  {
    titulo: "Sistemas · Seguridad digital",
    descripcion: "Inducción del área de Sistemas: buenas prácticas de seguridad digital.",
    lecciones: [
      {
        titulo: "Seguridad digital",
        descripcion: "Video institucional en elaboración.",
        tipo: "TEXT",
        texto:
          "<h2>Seguridad digital</h2><p>El video institucional de esta lección está <strong>en elaboración</strong> por el área de Sistemas. Cuando esté disponible aparecerá aquí mismo.</p><p>Mientras tanto, recuerda las reglas de oro: no compartas tu contraseña, bloquea tu equipo al levantarte y reporta a Sistemas cualquier correo sospechoso.</p>",
        minutos: 5,
      },
    ],
  },
  {
    titulo: "Sistemas · Historia clínica Chronis (asistencial)",
    descripcion:
      "Manejo del sistema de información asistencial de historias clínicas (Chronis). Videos del proveedor, embebidos desde su canal.",
    lecciones: [
      {
        titulo: "Urgencias y hospitalización · Medicina y auxiliares de enfermería",
        descripcion: "Para profesionales en medicina y auxiliares de enfermería de urgencias y hospitalización.",
        tipo: "YOUTUBE",
        youtube: "https://www.youtube.com/watch?v=4JSglN2v8cs&t=154s",
        minutos: 25,
      },
      {
        titulo: "Prescripción de medicamentos · Urgencias y hospitalización",
        descripcion: "Prescripción de medicamentos en los servicios de urgencias y hospitalización.",
        tipo: "YOUTUBE",
        youtube: "https://www.youtube.com/watch?v=e64qp7SE1vc&t=241s",
        minutos: 20,
      },
      {
        titulo: "Consulta externa · Medicina y enfermería",
        descripcion: "Para profesionales en medicina y enfermería de los servicios de consulta externa.",
        tipo: "YOUTUBE",
        youtube: "https://www.youtube.com/watch?v=wdHJw7NPz0M&t=170s",
        minutos: 20,
      },
      {
        titulo: "Odontología",
        descripcion: "Para profesionales en odontología.",
        tipo: "YOUTUBE",
        youtube: "https://www.youtube.com/watch?v=bO-TUPRey-s&t=620s",
        minutos: 20,
      },
      {
        titulo: "Reporte Resolución 3280 · PMS",
        descripcion: "Para profesionales que reportan Resolución 3280 (PMS).",
        tipo: "YOUTUBE",
        youtube: "https://www.youtube.com/watch?v=14NDM5AW42E&t=112s",
        minutos: 20,
      },
      {
        titulo: "Laboratorio clínico",
        descripcion: "Videotutorial institucional para profesionales de laboratorio clínico (antes se enviaba por WhatsApp).",
        tipo: "VIDEO",
        minutos: 15,
      },
    ],
  },
  {
    titulo: "Sistemas · Facturación de servicios (administrativo)",
    descripcion: "Facturación de servicios en Chronis, para personal administrativo. Videos del proveedor, embebidos.",
    lecciones: [
      {
        titulo: "Generalidades del proceso de facturación",
        descripcion: "Visión general del proceso de facturación de servicios.",
        tipo: "YOUTUBE",
        youtube: "https://www.youtube.com/watch?v=y_FZI9BrOt4",
        minutos: 20,
      },
      {
        titulo: "Transición Resolución 2275 · FEV-RIPS",
        descripcion: "Transición a la Resolución 2275: factura electrónica de venta y RIPS.",
        tipo: "YOUTUBE",
        youtube: "https://www.youtube.com/watch?v=T5YGH0Assbc",
        minutos: 20,
      },
      {
        titulo: "Resolución 2275 de 2025",
        descripcion: "Detalle de la Resolución 2275 de 2025.",
        tipo: "YOUTUBE",
        youtube: "https://www.youtube.com/watch?v=1bjMNtJbpCk",
        minutos: 20,
      },
      {
        titulo: "Asistencia técnica · Resoluciones 2275 y 2284",
        descripcion: "Sesión de asistencia técnica sobre las resoluciones 2275 y 2284.",
        tipo: "YOUTUBE",
        youtube: "https://www.youtube.com/watch?v=vwO63WbQdjI&t=2861s",
        minutos: 45,
      },
    ],
  },
];

async function main() {
  const curso = await prisma.course.findUniqueOrThrow({
    where: { slug: SLUG_CURSO },
    select: { id: true, title: true, tutorId: true },
  });
  console.log("curso:", curso.title, curso.id);

  let ordenModulo = await prisma.courseModule.count({ where: { courseId: curso.id } });

  for (const mod of MODULOS) {
    const existente = await prisma.courseModule.findFirst({
      where: { courseId: curso.id, title: mod.titulo },
      select: { id: true },
    });
    let moduloId = existente?.id;
    if (!moduloId) {
      const creado = await prisma.courseModule.create({
        data: {
          courseId: curso.id,
          title: mod.titulo,
          description: mod.descripcion,
          isRequired: false, // hasta la pregunta condicional, nada obligatorio
          sortOrder: ordenModulo++,
        },
        select: { id: true },
      });
      moduloId = creado.id;
      console.log("módulo creado:", mod.titulo);
    } else {
      console.log("módulo ya existía:", mod.titulo);
    }

    let ordenLeccion = await prisma.lesson.count({ where: { moduleId: moduloId } });
    for (const lec of mod.lecciones) {
      const ya = await prisma.lesson.findFirst({
        where: { moduleId: moduloId, title: lec.titulo },
        select: { id: true, fileUrl: true },
      });
      let leccionId = ya?.id;
      if (!leccionId) {
        const creada = await prisma.lesson.create({
          data: {
            moduleId: moduloId,
            title: lec.titulo,
            description: lec.descripcion,
            contentType: lec.tipo,
            contentBody: lec.texto ?? null,
            videoUrl: lec.youtube ?? null,
            estimatedMinutes: lec.minutos ?? null,
            isRequired: false,
            sortOrder: ordenLeccion++,
          },
          select: { id: true },
        });
        leccionId = creada.id;
        console.log("  lección creada:", lec.titulo);
      }

      // El video local de laboratorio, si se pasó la ruta y aún no está cargado.
      if (lec.tipo === "VIDEO" && process.env.VIDEO_LAB && !ya?.fileUrl) {
        const buffer = await readFile(process.env.VIDEO_LAB);
        const archivo = new File([buffer], "laboratorioredsalud.mp4", { type: "video/mp4" });
        const media = await saveLessonFile(archivo, leccionId, curso.tutorId);
        await prisma.lesson.update({ where: { id: leccionId }, data: { fileUrl: media.fileUrl } });
        console.log("  video de laboratorio cargado:", media.fileUrl, `(${Math.round(buffer.byteLength / 1e6)} MB)`);
      }
    }
  }
  console.log("listo");
}

main().finally(() => prisma.$disconnect());
