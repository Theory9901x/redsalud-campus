import { prisma } from "../lib/prisma";

/**
 * GESTIÓN DE PRUEBA COMPLETA para el área de CALIDAD (rol tutor): un plan
 * [PRUEBA] con una capacitación del programa IAAS que tiene curso con
 * contenido, evaluación presaber/postsaber (ciclo automático), jornada
 * agendada y sus QR. Sirve para recorrer en vivo todo el flujo del tutor:
 * jornada → asistencia → presaber → postsaber → resultados → informe.
 *
 * Todo queda marcado [PRUEBA]: el personal no lo ve en sus listas ni en el
 * catálogo; solo el personal de gestión. Se elimina con el botón de borrar
 * plan de prueba (el curso queda archivable desde Cursos).
 * Idempotente: si el plan ya existe, no hace nada.
 *
 *   npx tsx --env-file=.env scripts/prueba-gestion-calidad.ts
 */
const TITULO_PLAN = "[PRUEBA] Gestión de capacitación · Calidad";
const TITULO_CURSO = "[PRUEBA] Higiene de manos: los 5 momentos de la OMS";
const APROBAR = 70;

const op = (t: string, ok = false) => ({ t, ok });
const PREGUNTAS = [
  {
    enunciado: "Según la OMS, ¿cuántos son los momentos para la higiene de manos en la atención en salud?",
    opciones: [op("Tres"), op("Cinco", true), op("Siete"), op("Cuatro")],
  },
  {
    enunciado: "¿Cuál de las siguientes situaciones NO es uno de los 5 momentos de la higiene de manos?",
    opciones: [
      op("Antes del contacto con el paciente"),
      op("Después del contacto con el entorno del paciente"),
      op("Antes de ingresar a la cafetería institucional", true),
      op("Después del riesgo de exposición a fluidos corporales"),
    ],
  },
  {
    enunciado: "La fricción de manos con solución a base de alcohol debe durar:",
    opciones: [op("Entre 5 y 10 segundos"), op("Entre 20 y 30 segundos", true), op("Entre 40 y 60 segundos"), op("Dos minutos")],
  },
  {
    enunciado: "El lavado de manos con agua y jabón debe durar:",
    opciones: [op("Entre 10 y 15 segundos"), op("Entre 20 y 30 segundos"), op("Entre 40 y 60 segundos", true), op("Cinco minutos")],
  },
  {
    enunciado: "Cuando las manos están visiblemente sucias o contaminadas con fluidos, lo indicado es:",
    opciones: [
      op("Aplicar solución alcohólica únicamente"),
      op("Lavarlas con agua y jabón", true),
      op("Ponerse guantes sin hacer higiene de manos"),
      op("Secarlas con una toalla limpia"),
    ],
  },
  {
    enunciado: "El uso de guantes reemplaza la higiene de manos.",
    opciones: [op("Falso", true), op("Verdadero")],
  },
];

const LECCIONES = [
  {
    titulo: "¿Por qué importa la higiene de manos?",
    minutos: 5,
    html:
      "<p>Las manos del personal de salud son la principal vía de transmisión de microorganismos entre pacientes. " +
      "Una higiene de manos correcta es la medida más sencilla y costo-efectiva para prevenir las <strong>infecciones asociadas a la atención en salud (IAAS)</strong> " +
      "y la resistencia a los antimicrobianos.</p>" +
      "<ul><li>Protege al paciente de los gérmenes que llevamos en las manos.</li><li>Protege al trabajador y al entorno de atención.</li>" +
      "<li>Es un indicador de calidad y seguridad del paciente que se mide en cada servicio.</li></ul>",
  },
  {
    titulo: "Los 5 momentos de la OMS",
    minutos: 8,
    html:
      "<ol><li><strong>Antes del contacto con el paciente.</strong></li>" +
      "<li><strong>Antes de realizar una tarea limpia o aséptica</strong> (p. ej. manipular un catéter, preparar medicamentos).</li>" +
      "<li><strong>Después del riesgo de exposición a fluidos corporales.</strong></li>" +
      "<li><strong>Después del contacto con el paciente.</strong></li>" +
      "<li><strong>Después del contacto con el entorno del paciente</strong> (cama, mesa, equipos), aunque no se haya tocado al paciente.</li></ol>" +
      "<p>Los momentos 1 y 2 protegen al paciente; los momentos 3, 4 y 5 protegen al trabajador y al entorno.</p>",
  },
  {
    titulo: "Técnica: fricción con alcohol o lavado con agua y jabón",
    minutos: 7,
    html:
      "<p><strong>Fricción con solución alcohólica (20–30 segundos):</strong> es el método de elección cuando las manos no están visiblemente sucias.</p>" +
      "<p><strong>Lavado con agua y jabón (40–60 segundos):</strong> cuando las manos están visiblemente sucias o contaminadas con fluidos, y después de atender pacientes con diarrea infecciosa.</p>" +
      "<p>En ambos casos se frotan palmas, dorsos, entre los dedos, pulgares, uñas y muñecas. Los <strong>guantes no reemplazan</strong> la higiene de manos: se hace antes de ponérselos y después de retirarlos.</p>",
  },
];

async function main() {
  if (await prisma.trainingPlan.findFirst({ where: { title: TITULO_PLAN }, select: { id: true } })) {
    console.log("La gestión de prueba ya existe: no se hace nada.");
    return;
  }
  const area = await prisma.trainingArea.findFirstOrThrow({
    where: { name: { contains: "Calidad", mode: "insensitive" } },
    select: { id: true, name: true, tutorId: true },
  });
  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN", status: "ACTIVE" }, orderBy: { createdAt: "asc" }, select: { id: true } });
  const tutorId = area.tutorId ?? admin.id;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const curso = await prisma.course.create({
    data: {
      title: TITULO_CURSO,
      slug: `prueba-higiene-de-manos-calidad-${Date.now().toString(36)}`,
      shortDescription: "Los 5 momentos de la OMS y la técnica correcta de higiene de manos para prevenir las IAAS.",
      fullDescription: "Capacitación de prueba del programa IAAS - PROA - PMMHM del área de Calidad.",
      courseType: "CAPACITACION",
      durationHours: 1,
      status: "PUBLISHED",
      publishedAt: new Date(),
      tutorId,
      passingScore: APROBAR,
      enrollmentMode: "ASSIGNED",
      targetAudience: "ASISTENCIAL",
      isSequential: false,
      instructions: `<p>Presenta el <strong>presaber</strong>, revisa el material y luego presenta el <strong>postsaber</strong>. Necesitas ${APROBAR}% para aprobar.</p>`,
    },
    select: { id: true },
  });
  const modulo = await prisma.courseModule.create({
    data: { courseId: curso.id, title: "Higiene de manos", description: "Contenido de la capacitación", sortOrder: 0 },
    select: { id: true },
  });
  for (const [i, l] of LECCIONES.entries()) {
    await prisma.lesson.create({
      data: { moduleId: modulo.id, title: l.titulo, contentType: "TEXT", contentBody: l.html, sortOrder: i * 2, estimatedMinutes: l.minutos },
    });
  }
  const quiz = await prisma.quiz.create({
    data: {
      courseId: curso.id,
      moduleId: null,
      title: "Evaluación · Higiene de manos (presaber / postsaber)",
      description: `Se presenta como presaber antes de la capacitación y como postsaber después. Mínimo para aprobar: ${APROBAR}%.`,
      passingScore: APROBAR,
      maxAttempts: 3,
      showResultsNow: true,
    },
    select: { id: true },
  });
  for (const [i, p] of PREGUNTAS.entries()) {
    await prisma.question.create({
      data: {
        quizId: quiz.id,
        type: "SINGLE_CHOICE",
        statement: p.enunciado,
        area: area.name,
        score: 1,
        sortOrder: i,
        options: { create: p.opciones.map((o, j) => ({ text: o.t, isCorrect: o.ok, sortOrder: j })) },
      },
    });
  }

  const plan = await prisma.trainingPlan.create({
    data: {
      title: TITULO_PLAN,
      year: 2026,
      kind: "CAPACITACION",
      status: "ACTIVE",
      tutorId,
      description: "Plan de prueba para recorrer la gestión completa del área de Calidad. Se puede eliminar.",
    },
    select: { id: true },
  });
  const actividad = await prisma.trainingActivity.create({
    data: {
      planId: plan.id,
      areaId: area.id,
      title: "[PRUEBA] Higiene de manos: los 5 momentos de la OMS",
      type: "COURSE",
      courseId: curso.id,
      status: "OPEN",
      enabledAt: new Date(),
      modality: "VIRTUAL",
      isRequired: false,
      targetAudience: "ASISTENCIAL",
      targetAudienceNote: "Personal asistencial de las IPS (médicos, enfermería, auxiliares)",
      programa: "IAAS- PROA -PMMHM",
      objective: "Fortalecer la adherencia a la higiene de manos en los 5 momentos de la OMS para prevenir las IAAS.",
      methodology: "Sesión virtual con presaber, exposición del contenido, postsaber y retroalimentación.",
      responsibleLabel: "Profesional líder IAAS - PROA",
      responsibleUserId: tutorId,
      quarters: [4],
      followUpEvidence: ["Lista de asistencia", "Resultados presaber y postsaber", "Informe de la jornada"],
    },
    select: { id: true },
  });
  // Jornada: mañana 16-oct-2026, 9:00 a 10:00 (hora de Colombia).
  await prisma.trainingSession.create({
    data: {
      activityId: actividad.id,
      startsAt: new Date("2026-10-16T09:00:00-05:00"),
      endsAt: new Date("2026-10-16T10:00:00-05:00"),
      modality: "VIRTUAL",
      status: "OPEN",
      meetingUrl: `${appUrl}/sala/${actividad.id}`,
      facilitador: "Profesional líder IAAS - PROA",
    },
  });
  console.log(`Listo: ${TITULO_PLAN}`);
  console.log(`  plan ${plan.id} · actividad ${actividad.id} · curso ${curso.id}`);
  console.log(`  tutor: ${tutorId} (área ${area.name})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
