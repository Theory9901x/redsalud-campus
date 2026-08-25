/**
 * EJERCICIO DE DEMOSTRACIÓN COMPLETO: dos personas, una capacitación, de
 * principio a fin.
 *
 * Monta un plan de capacitación aislado y recorre con dos usuarios de
 * demostración TODO el ciclo real de la plataforma, paso por paso, para
 * poder revisar cada instancia con datos dentro:
 *
 *   1. Alta de las dos personas (con cargo, municipio y vinculación)
 *   2. Curso con contenido y evaluación de 5 preguntas
 *   3. Capacitación del plan, publicada, con jornada agendada
 *   4. Inscripción bajo demanda (la misma puerta del QR y del cronograma)
 *   5. Asistencia registrada automáticamente
 *   6. PRESABER: cada quien con su resultado real
 *   7. Consumo del contenido (lecciones completadas)
 *   8. POSTSABER: mejora medible frente al presaber
 *   9. Tiempo conectado a la videollamada
 *  10. Cierre de la jornada -> informe CONGELADO
 *  11. Certificados emitidos por el camino real de la aplicación
 *
 * DOS SALVAGUARDAS, porque esto corre sobre producción:
 *
 *  - Plan APARTE: no toca el PIC 2026 real ni sus indicadores.
 *  - Audiencia restringida por dependencia a los dos usuarios de
 *    demostración: ningún funcionario real ve esta capacitación en su plan.
 *
 * Es idempotente: se puede volver a correr. Para borrarlo todo:
 * scripts/demo/borrar-demo.ts
 *
 *   npx tsx --env-file=.env scripts/demo/montar-demo.ts
 */
import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { recalculateEnrollmentProgress } from "../../lib/lesson-progress";
import { freezeActivityReport } from "../../lib/training-plans";
import { registrarConexionLlamada } from "../../lib/call-connections";

const MARCA = "[DEMO]";
const DEPENDENCIA = "[DEMO] Dependencia de demostración";
const CLAVE = "Demo2026*";

/** Fechas hacia atrás, para que la jornada tenga una historia creíble. */
const HOY = new Date();
const hace = (dias: number, horas = 0) =>
  new Date(HOY.getTime() - dias * 86400000 - horas * 3600000);

type Persona = {
  documento: string;
  nombre: string;
  correo: string;
  presaber: number;
  postsaber: number;
  minutosEnLlamada: number;
};

const PERSONAS: Persona[] = [
  {
    documento: "DEMO-1000000001",
    nombre: "[DEMO] Ana Lucía Herrera",
    correo: "demo.ana@ejemplo.test",
    presaber: 40, // 2 de 5
    postsaber: 100, // 5 de 5  -> mejora de 150 pp
    minutosEnLlamada: 52,
  },
  {
    documento: "DEMO-1000000002",
    nombre: "[DEMO] Carlos Mario Peña",
    correo: "demo.carlos@ejemplo.test",
    presaber: 60, // 3 de 5
    postsaber: 80, // 4 de 5  -> mejora de 33 pp
    minutosEnLlamada: 37,
  },
];

const PREGUNTAS = [
  {
    enunciado: "¿Cuál es el objetivo principal del lavado de manos clínico?",
    opciones: [
      "Retirar la suciedad visible únicamente",
      "Eliminar la flora transitoria y reducir la residente",
      "Hidratar la piel del personal asistencial",
      "Cumplir un requisito administrativo",
    ],
    correcta: 1,
    explicacion: "El lavado clínico busca eliminar la flora transitoria, que es la que transmite infecciones entre pacientes.",
  },
  {
    enunciado: "¿En cuál de estos momentos se debe realizar higiene de manos?",
    opciones: [
      "Solo al terminar la jornada laboral",
      "Únicamente si el paciente lo solicita",
      "Antes y después del contacto con el paciente",
      "Solo cuando se usan guantes",
    ],
    correcta: 2,
    explicacion: "La OMS define cinco momentos; el contacto con el paciente marca dos de ellos.",
  },
  {
    enunciado: "El uso de guantes reemplaza la higiene de manos.",
    opciones: ["Verdadero", "Falso"],
    correcta: 1,
    explicacion: "Falso: los guantes no sustituyen la higiene de manos, se usan además de ella.",
  },
  {
    enunciado: "¿Qué elemento de protección personal se retira primero al salir de una habitación de aislamiento?",
    opciones: ["La mascarilla", "Los guantes", "Las gafas", "La bata"],
    correcta: 1,
    explicacion: "Los guantes son lo más contaminado, por eso se retiran primero.",
  },
  {
    enunciado: "¿Ante quién se reporta un evento adverso detectado durante la atención?",
    opciones: [
      "No se reporta para evitar sanciones",
      "Solo al compañero de turno",
      "Al referente de seguridad del paciente de la IPS",
      "Directamente a la familia del paciente",
    ],
    correcta: 2,
    explicacion: "El reporte al referente de seguridad del paciente alimenta el programa institucional; no es punitivo.",
  },
];

/** Reparte aciertos según el porcentaje objetivo: 5 preguntas = 20 % cada una. */
function aciertosPara(porcentaje: number) {
  return Math.round((porcentaje / 100) * PREGUNTAS.length);
}

async function main() {
  const paso = (n: number, texto: string) => console.log(`\n${"─".repeat(64)}\n${n}. ${texto}\n${"─".repeat(64)}`);

  const admin = await prisma.user.findFirstOrThrow({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });
  const municipio = await prisma.municipio.findFirstOrThrow({ where: { nombre: "Yopal" } });
  // El catálogo de cargos existe en producción pero puede estar vacío en
  // desarrollo: el cargo es informativo, no condiciona el flujo.
  const cargo = await prisma.cargo.findFirst();

  // ---------------------------------------------------------------- 1
  paso(1, "ALTA DE LAS DOS PERSONAS");
  const hash = await bcrypt.hash(CLAVE, 10);
  const usuarios = [];
  for (const p of PERSONAS) {
    const u = await prisma.user.upsert({
      where: { documentNumber: p.documento },
      update: { department: DEPENDENCIA },
      create: {
        fullName: p.nombre,
        documentType: "CC",
        documentNumber: p.documento,
        email: p.correo,
        passwordHash: hash,
        role: "STUDENT",
        status: "ACTIVE",
        // Sin cambio obligatorio: así se puede entrar a ver el flujo sin
        // tropezar con la pantalla de cambio de contraseña.
        mustChangePassword: false,
        personnelType: "ASISTENCIAL",
        department: DEPENDENCIA, // <- restringe la audiencia SOLO a estas dos
        position: cargo?.nombre ?? "Auxiliar de enfermería",
        ...(cargo ? { cargoId: cargo.id } : {}),
        municipioId: municipio.id,
        tipoVinculacion: "CARRERA_ADMINISTRATIVA",
        origenRegistro: "IMPORTACION",
        provisionedAt: hace(30),
        provisionedBy: admin.id,
      },
    });
    usuarios.push(u);
    console.log(`   ✔ ${u.fullName}  ·  ${u.email}  ·  clave: ${CLAVE}`);
  }

  // ---------------------------------------------------------------- 2
  paso(2, "CURSO CON CONTENIDO Y EVALUACIÓN");
  const curso = await prisma.course.upsert({
    where: { slug: "demo-flujo-completo" },
    update: {},
    create: {
      title: `${MARCA} Higiene de manos y seguridad del paciente`,
      slug: "demo-flujo-completo",
      shortDescription: "Curso de demostración para revisar el flujo completo de la plataforma.",
      fullDescription: "Contenido de ejemplo: recorre presentación, evaluación y certificado tal como lo haría una capacitación real.",
      courseType: "CAPACITACION",
      durationHours: 4,
      status: "PUBLISHED",
      publishedAt: hace(20),
      tutorId: admin.id,
      passingScore: 80,
      enrollmentMode: "ASSIGNED",
      targetAudience: "AMBOS",
      isSequential: false,
    },
  });

  const modulo = await prisma.courseModule.upsert({
    where: { courseId_sortOrder: { courseId: curso.id, sortOrder: 1 } },
    update: {},
    create: { courseId: curso.id, title: "Contenido de la capacitación", sortOrder: 1, isRequired: true },
  });

  const LECCIONES = [
    { titulo: "Los cinco momentos de la higiene de manos", minutos: 15 },
    { titulo: "Uso correcto de elementos de protección personal", minutos: 20 },
    { titulo: "Reporte de eventos adversos", minutos: 15 },
  ];
  const lecciones = [];
  for (const [i, l] of LECCIONES.entries()) {
    const leccion = await prisma.lesson.upsert({
      where: { moduleId_sortOrder: { moduleId: modulo.id, sortOrder: i + 1 } },
      update: {},
      create: {
        moduleId: modulo.id,
        title: l.titulo,
        contentType: "TEXT",
        contentBody: `<p>Contenido de demostración de la lección «${l.titulo}».</p>`,
        sortOrder: i + 1,
        isRequired: true,
        estimatedMinutes: l.minutos,
      },
    });
    lecciones.push(leccion);
  }
  console.log(`   ✔ Curso «${curso.title}» con ${lecciones.length} lecciones`);

  // La evaluación del ciclo es la FINAL del curso (moduleId null), que es
  // la que el módulo de planes usa como presaber/postsaber.
  let quiz = await prisma.quiz.findFirst({ where: { courseId: curso.id, moduleId: null } });
  if (!quiz) {
    quiz = await prisma.quiz.create({
      data: {
        courseId: curso.id,
        moduleId: null,
        title: "Evaluación de conocimientos",
        description: "Misma evaluación para presaber y postsaber.",
        passingScore: 80,
        maxAttempts: 10,
        sortOrder: 99,
        isActive: true,
      },
    });
    for (const [i, p] of PREGUNTAS.entries()) {
      const pregunta = await prisma.question.create({
        data: {
          quizId: quiz.id,
          type: p.opciones.length === 2 ? "TRUE_FALSE" : "SINGLE_CHOICE",
          statement: p.enunciado,
          score: 1,
          explanation: p.explicacion,
          sortOrder: i + 1,
        },
      });
      await prisma.questionOption.createMany({
        data: p.opciones.map((texto, j) => ({
          questionId: pregunta.id,
          text: texto,
          isCorrect: j === p.correcta,
          sortOrder: j + 1,
        })),
      });
    }
  }
  const preguntasBD = await prisma.question.findMany({
    where: { quizId: quiz.id },
    include: { options: true },
    orderBy: { sortOrder: "asc" },
  });
  console.log(`   ✔ Evaluación con ${preguntasBD.length} preguntas (aprueba con ${quiz.passingScore} %)`);

  // ---------------------------------------------------------------- 3
  paso(3, "PLAN, ÁREA Y CAPACITACIÓN PROGRAMADA");
  let area = await prisma.trainingArea.findFirst({ where: { name: `${MARCA} Área de demostración` } });
  if (!area) {
    area = await prisma.trainingArea.create({
      data: { name: `${MARCA} Área de demostración`, sortOrder: 99, tutorId: admin.id },
    });
  }

  let plan = await prisma.trainingPlan.findFirst({ where: { title: `${MARCA} Plan de demostración` } });
  if (!plan) {
    plan = await prisma.trainingPlan.create({
      data: {
        title: `${MARCA} Plan de demostración`,
        year: HOY.getFullYear(),
        description: "Plan aislado para revisar el flujo completo. No forma parte del PIC institucional.",
        // Restringe la audiencia a la dependencia de demostración: ningún
        // funcionario real queda convocado a esta capacitación.
        targetDepartment: DEPENDENCIA,
        tutorId: admin.id,
        status: "ACTIVE",
      },
    });
  }

  let actividad = await prisma.trainingActivity.findFirst({
    where: { planId: plan.id, title: `${MARCA} Jornada de higiene de manos` },
  });
  if (!actividad) {
    actividad = await prisma.trainingActivity.create({
      data: {
        planId: plan.id,
        areaId: area.id,
        title: `${MARCA} Jornada de higiene de manos`,
        type: "COURSE",
        courseId: curso.id,
        quarters: [Math.floor(HOY.getMonth() / 3) + 1],
        targetAudience: "AMBOS",
        isRequired: true,
        status: "OPEN",
        enabledAt: hace(10),
        modality: "VIRTUAL",
        programa: "Seguridad del paciente",
        objective: "Fortalecer la adherencia del personal asistencial a las prácticas de higiene de manos.",
        methodology: "Sesión virtual con presentación, evaluación previa y posterior.",
        targetAudienceNote: "Personal de la dependencia de demostración",
        expectedAttendees: 2,
        responsibleLabel: "Profesional de demostración",
        responsibleUserId: admin.id,
        followUpEvidence: ["Registro de asistencia", "Resultados presaber/postsaber"],
        startDate: hace(3),
      },
    });
  }

  // Segunda línea SIN contenido: así la cobertura no sale en un 100 % plano
  // y se ve el indicador midiendo algo real.
  const yaHaySegunda = await prisma.trainingActivity.findFirst({
    where: { planId: plan.id, title: `${MARCA} Jornada pendiente de montar` },
  });
  if (!yaHaySegunda) {
    await prisma.trainingActivity.create({
      data: {
        planId: plan.id,
        areaId: area.id,
        title: `${MARCA} Jornada pendiente de montar`,
        type: "COURSE",
        quarters: [Math.floor(HOY.getMonth() / 3) + 1],
        targetAudience: "AMBOS",
        status: "OPEN",
        enabledAt: hace(9),
        modality: "PRESENCIAL",
        objective: "Línea del plan todavía sin curso vinculado, para ver el indicador de cobertura.",
      },
    });
  }

  const sesionExiste = await prisma.trainingSession.findFirst({ where: { activityId: actividad.id } });
  if (!sesionExiste) {
    await prisma.trainingSession.create({
      data: {
        activityId: actividad.id,
        startsAt: hace(3, 4),
        endsAt: hace(3, 2),
        modality: "VIRTUAL",
        municipioId: municipio.id,
        meetingUrl: `https://campusvirtual.redsaludteforma.com/sala/${actividad.id}`,
      },
    });
  }
  // TERCERA línea, EN VIVO: el ejercicio no debe mostrar solo el resultado
  // final. Esta queda abierta, con contenido y el presaber disponible, y sin
  // inscribir a nadie, para poder recorrer el flujo en persona -entrar,
  // inscribirse bajo demanda, presentar la evaluación- y ver moverse los
  // indicadores en el momento.
  const cursoVivo = await prisma.course.upsert({
    where: { slug: "demo-en-curso" },
    update: {},
    create: {
      title: `${MARCA} Manejo seguro de medicamentos`,
      slug: "demo-en-curso",
      shortDescription: "Segundo curso de demostración, para recorrer el flujo en vivo.",
      courseType: "CAPACITACION",
      durationHours: 2,
      status: "PUBLISHED",
      publishedAt: hace(5),
      tutorId: admin.id,
      passingScore: 80,
      enrollmentMode: "ASSIGNED",
      targetAudience: "AMBOS",
    },
  });
  const moduloVivo = await prisma.courseModule.upsert({
    where: { courseId_sortOrder: { courseId: cursoVivo.id, sortOrder: 1 } },
    update: {},
    create: { courseId: cursoVivo.id, title: "Contenido", sortOrder: 1, isRequired: true },
  });
  await prisma.lesson.upsert({
    where: { moduleId_sortOrder: { moduleId: moduloVivo.id, sortOrder: 1 } },
    update: {},
    create: {
      moduleId: moduloVivo.id,
      title: "Los cinco correctos en la administración de medicamentos",
      contentType: "TEXT",
      contentBody: "<p>Contenido de demostración: paciente, medicamento, dosis, vía y hora correctos.</p>",
      sortOrder: 1,
      isRequired: true,
      estimatedMinutes: 20,
    },
  });
  let quizVivo = await prisma.quiz.findFirst({ where: { courseId: cursoVivo.id, moduleId: null } });
  if (!quizVivo) {
    quizVivo = await prisma.quiz.create({
      data: {
        courseId: cursoVivo.id,
        moduleId: null,
        title: "Evaluación de conocimientos",
        passingScore: 80,
        maxAttempts: 10,
        sortOrder: 99,
      },
    });
    for (const [i, p] of PREGUNTAS.slice(0, 3).entries()) {
      const pregunta = await prisma.question.create({
        data: {
          quizId: quizVivo.id,
          type: p.opciones.length === 2 ? "TRUE_FALSE" : "SINGLE_CHOICE",
          statement: p.enunciado,
          score: 1,
          explanation: p.explicacion,
          sortOrder: i + 1,
        },
      });
      await prisma.questionOption.createMany({
        data: p.opciones.map((texto, j) => ({
          questionId: pregunta.id,
          text: texto,
          isCorrect: j === p.correcta,
          sortOrder: j + 1,
        })),
      });
    }
  }

  let actividadViva = await prisma.trainingActivity.findFirst({
    where: { planId: plan.id, title: `${MARCA} Jornada EN CURSO (recorrer en vivo)` },
  });
  if (!actividadViva) {
    actividadViva = await prisma.trainingActivity.create({
      data: {
        planId: plan.id,
        areaId: area.id,
        title: `${MARCA} Jornada EN CURSO (recorrer en vivo)`,
        type: "COURSE",
        courseId: cursoVivo.id,
        quarters: [Math.floor(HOY.getMonth() / 3) + 1],
        targetAudience: "AMBOS",
        isRequired: true,
        status: "OPEN",
        enabledAt: hace(1),
        modality: "VIRTUAL",
        objective: "Jornada abierta a propósito: sirve para recorrer el flujo completo en persona.",
        methodology: "Entrar, inscribirse bajo demanda, presentar el presaber y ver moverse los indicadores.",
        targetAudienceNote: "Personal de la dependencia de demostración",
        expectedAttendees: 2,
        responsibleUserId: admin.id,
        startDate: HOY,
      },
    });
    await prisma.trainingSession.create({
      data: {
        activityId: actividadViva.id,
        startsAt: new Date(HOY.getTime() + 2 * 3600000),
        endsAt: new Date(HOY.getTime() + 4 * 3600000),
        modality: "VIRTUAL",
        municipioId: municipio.id,
        meetingUrl: `https://campusvirtual.redsaludteforma.com/sala/${actividadViva.id}`,
      },
    });
  }

  console.log(`   ✔ Plan «${plan.title}»`);
  console.log(`   ✔ Capacitación «${actividad.title}» (se recorrerá entera hasta el cierre)`);
  console.log(`   ✔ Segunda línea sin contenido, para el indicador de cobertura`);
  console.log(`   ✔ Tercera línea EN CURSO, con presaber abierto para recorrerla en vivo`);

  // ---------------------------------------------------------------- 4 a 9
  const correctasDe = (n: number) => preguntasBD.slice(0, n);
  const incorrectasDe = (n: number) => preguntasBD.slice(n);

  for (const [i, p] of PERSONAS.entries()) {
    const u = usuarios[i];
    paso(4 + i, `RECORRIDO COMPLETO DE ${u.fullName}`);

    // --- inscripción (misma puerta que el QR y el cronograma)
    const inscripcion = await prisma.enrollment.upsert({
      where: { userId_courseId: { userId: u.id, courseId: curso.id } },
      update: {},
      create: { userId: u.id, courseId: curso.id, status: "ACTIVE", enrolledAt: hace(9), startedAt: hace(9) },
    });
    console.log(`   ✔ Inscrito en el curso`);

    // --- asistencia automática
    await prisma.trainingAttendance.upsert({
      where: { activityId_userId: { activityId: actividad.id, userId: u.id } },
      update: {},
      create: {
        activityId: actividad.id,
        userId: u.id,
        attended: true,
        registeredAt: hace(3, 4),
        source: "AUTOMATIC",
      },
    });
    console.log(`   ✔ Asistencia registrada (automática, al entrar a la jornada)`);

    // --- PRESABER
    const yaPre = await prisma.quizAttempt.findFirst({ where: { userId: u.id, quizId: quiz.id, moment: "PRESABER" } });
    if (!yaPre) {
      const aciertos = aciertosPara(p.presaber);
      const intento = await prisma.quizAttempt.create({
        data: {
          userId: u.id,
          quizId: quiz.id,
          enrollmentId: inscripcion.id,
          attemptNumber: 1,
          score: p.presaber,
          passed: p.presaber >= quiz.passingScore,
          startedAt: hace(4),
          finishedAt: hace(4),
          moment: "PRESABER",
        },
      });
      await prisma.quizAnswer.createMany({
        data: [
          ...correctasDe(aciertos).map((q) => ({
            attemptId: intento.id,
            questionId: q.id,
            selectedOptionIds: [q.options.find((o) => o.isCorrect)!.id],
            isCorrect: true,
            scoreObtained: q.score,
          })),
          ...incorrectasDe(aciertos).map((q) => ({
            attemptId: intento.id,
            questionId: q.id,
            selectedOptionIds: [q.options.find((o) => !o.isCorrect)!.id],
            isCorrect: false,
            scoreObtained: 0,
          })),
        ],
      });
    }
    console.log(`   ✔ PRESABER presentado: ${p.presaber} % (${aciertosPara(p.presaber)} de ${PREGUNTAS.length})`);

    // --- contenido consumido
    for (const l of lecciones) {
      await prisma.lessonProgress.upsert({
        where: { userId_lessonId: { userId: u.id, lessonId: l.id } },
        update: {},
        create: {
          userId: u.id,
          lessonId: l.id,
          enrollmentId: inscripcion.id,
          status: "COMPLETED",
          completedAt: hace(3, 3),
        },
      });
    }
    console.log(`   ✔ Contenido completado: ${lecciones.length} de ${lecciones.length} lecciones`);

    // --- tiempo conectado a la videollamada (dos tramos: se reconectó)
    const yaConexion = await prisma.callConnectionLog.findFirst({ where: { activityId: actividad.id, userId: u.id } });
    if (!yaConexion) {
      const primerTramo = Math.round(p.minutosEnLlamada * 0.7);
      const segundoTramo = p.minutosEnLlamada - primerTramo;
      await registrarConexionLlamada({
        activityId: actividad.id,
        userId: u.id,
        displayName: u.fullName,
        joinedAt: hace(3, 4),
        leftAt: new Date(hace(3, 4).getTime() + primerTramo * 60000),
      });
      await registrarConexionLlamada({
        activityId: actividad.id,
        userId: u.id,
        displayName: u.fullName,
        joinedAt: new Date(hace(3, 4).getTime() + (primerTramo + 3) * 60000),
        leftAt: new Date(hace(3, 4).getTime() + (primerTramo + 3 + segundoTramo) * 60000),
      });
    }
    console.log(`   ✔ Conectado a la videollamada: ${p.minutosEnLlamada} min en 2 tramos`);

    // --- POSTSABER
    const yaPost = await prisma.quizAttempt.findFirst({ where: { userId: u.id, quizId: quiz.id, moment: "POSTSABER" } });
    if (!yaPost) {
      const aciertos = aciertosPara(p.postsaber);
      const intento = await prisma.quizAttempt.create({
        data: {
          userId: u.id,
          quizId: quiz.id,
          enrollmentId: inscripcion.id,
          attemptNumber: 2,
          score: p.postsaber,
          passed: p.postsaber >= quiz.passingScore,
          startedAt: hace(3, 1),
          finishedAt: hace(3, 1),
          moment: "POSTSABER",
        },
      });
      await prisma.quizAnswer.createMany({
        data: [
          ...correctasDe(aciertos).map((q) => ({
            attemptId: intento.id,
            questionId: q.id,
            selectedOptionIds: [q.options.find((o) => o.isCorrect)!.id],
            isCorrect: true,
            scoreObtained: q.score,
          })),
          ...incorrectasDe(aciertos).map((q) => ({
            attemptId: intento.id,
            questionId: q.id,
            selectedOptionIds: [q.options.find((o) => !o.isCorrect)!.id],
            isCorrect: false,
            scoreObtained: 0,
          })),
        ],
      });
    }
    const mejora = Math.round(((p.postsaber - p.presaber) / p.presaber) * 100);
    console.log(`   ✔ POSTSABER presentado: ${p.postsaber} %  ->  mejora de ${mejora} pp`);

    // --- cierre del curso por el camino REAL de la aplicación
    const { certificateId } = await recalculateEnrollmentProgress(inscripcion.id);
    const final = await prisma.enrollment.findUniqueOrThrow({
      where: { id: inscripcion.id },
      select: { status: true, progressPercentage: true, finalScore: true },
    });
    console.log(`   ✔ Curso ${final.status} · avance ${final.progressPercentage} % · nota final ${final.finalScore} %`);
    if (certificateId) {
      const cert = await prisma.certificate.findUnique({
        where: { id: certificateId },
        select: { certificateCode: true },
      });
      console.log(`   ✔ Certificado emitido: ${cert?.certificateCode}`);
    }
  }

  // ---------------------------------------------------------------- 10
  paso(6, "CIERRE DE LA JORNADA E INFORME CONGELADO");
  await prisma.trainingActivity.update({
    where: { id: actividad.id },
    data: {
      status: "CLOSED",
      closedAt: hace(2),
      presaberOpenedAt: hace(5),
      presaberClosedAt: hace(3, 5),
      postsaberOpenedAt: hace(3, 2),
      postsaberClosedAt: hace(2, 1),
    },
  });
  const informe = await freezeActivityReport(actividad.id);
  console.log(`   ✔ Jornada CERRADA e informe congelado`);
  if (informe) {
    const ind = informe.indicadores;
    console.log(`     · personas en el informe: ${informe.personas?.length ?? 0}`);
    console.log(`     · asistentes ${ind.asistentes} · ciclo completo ${ind.completaronCiclo} · pre ${ind.promedioPre} % -> post ${ind.promedioPost} %`);
  }

  // ---------------------------------------------------------------- 11
  paso(7, "INDICADORES DEL PLAN, YA CALCULADOS");
  const { getPlanIndicators } = await import("../../lib/plan-indicadores");
  const ind = await getPlanIndicators(plan.id, null);
  if (ind) {
    console.log(`   Adherencia : ${ind.anual.adherencia.valor} pp  (${ind.anual.adherencia.personas} personas, ${ind.anual.adherencia.actividadesCerradas} jornada cerrada)`);
    console.log(`   Cobertura  : ${ind.anual.cobertura.valor} %  (${ind.anual.cobertura.conContenido} de ${ind.anual.cobertura.total} líneas con contenido)`);
    console.log(`   Asistencia : ${ind.anual.asistencia.valor} %  (${ind.anual.asistencia.asistentes} de ${ind.anual.asistencia.audiencia} convocatorias)`);
  }

  const { getCallConnectionSummaryForPlan } = await import("../../lib/call-connections");
  const conex = await getCallConnectionSummaryForPlan(plan.id, null);
  console.log(`   Conexiones : ${conex.totalTramos} tramos · ${conex.personasDistintas} personas · ${conex.duracionTotalMin} min en total`);

  // ---------------------------------------------------------------- resumen
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://campusvirtual.redsaludteforma.com";
  console.log(`\n${"═".repeat(64)}\nDÓNDE VERLO\n${"═".repeat(64)}`);
  console.log(`\nEntrar como cada persona (ven su propio recorrido):`);
  for (const p of PERSONAS) console.log(`   ${p.correo}   clave: ${CLAVE}`);
  console.log(`\nComo administrador o tutor:`);
  console.log(`   Plan            ${base}/admin/planes-capacitacion/${plan.id}`);
  console.log(`   Indicadores     ${base}/admin/planes-capacitacion/${plan.id}/indicadores`);
  console.log(`   Conexiones      ${base}/admin/planes-capacitacion/${plan.id}/conexiones`);
  console.log(`   Jornada cerrada ${base}/admin/planes-capacitacion/${plan.id}/actividades/${actividad.id}`);
  console.log(`   Jornada EN CURSO ${base}/admin/planes-capacitacion/${plan.id}/actividades/${actividadViva.id}`);
  console.log(`
Para RECORRER el flujo en persona: entrar como una de las dos personas,`);
  console.log(`ir a Mis capacitaciones -> «${plan.title}» -> «${actividadViva.title}»`);
  console.log(`y presentar el presaber. Los indicadores se mueven al instante.`);
  console.log(`\nPara borrar TODO este ejercicio:`);
  console.log(`   npx tsx --env-file=.env scripts/demo/borrar-demo.ts\n`);
}

main()
  .catch((e) => {
    console.error("FALLÓ:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
