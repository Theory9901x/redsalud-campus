import { prisma } from "../lib/prisma";
import type { ConfigPregunta, OpcionPregunta } from "../lib/encuestas/tipos";
import type { SurveyQuestionType } from "@prisma/client";

/**
 * ENCUESTA DE ATENCIÓN AL USUARIO (SIAU) — formato PM-7-SIAU-PR-02 V.1,
 * Resolución 0256 de 2016. Se monta DENTRO del módulo de encuestas, con
 * el contenido LITERAL del formato Word: enunciados, opciones y su orden
 * no se tocan. La única adición aprobada es "No aplica" por perfil en P2.
 *
 * Cada paso del formato es un bloque (página) y P2 son 13 preguntas de
 * una sola elección -una por perfil- para que la tabulación, el PDF y el
 * CSV existentes desagreguen por perfil sin ningún tipo nuevo.
 *
 * Idempotente: si la encuesta existe (por slug) se reescriben bloques y
 * preguntas EN SITIO por `sortOrder`, así las respuestas ya guardadas
 * siguen colgando de la misma pregunta.
 */
const SLUG = "encuesta-siau";
const CODE = "PM-7-SIAU-PR-02";
const VERSION = "V.1";

const BIENVENIDA =
  "Estimado usuario/acudiente, para Red Salud Casanare E.S.E., su opinión es la base de nuestra mejora continua. Le solicitamos diligenciar este cuestionario de manera transparente; le tomará menos de 3 minutos. Su respuesta es estrictamente confidencial.";
const HABEAS =
  "¿Autoriza de manera libre y expresa a Red Salud Casanare E.S.E. para realizar el tratamiento de los datos recolectados en este formulario con fines exclusivamente de evaluación de calidad? (Control de Habeas Data – Ley 1581 de 2012)";

const MUNICIPIOS = [
  "Yopal", "Aguazul", "Chámeza", "Hato Corozal", "La Salina", "Maní", "Monterrey", "Nunchía", "Orocué",
  "Paz de Ariporo", "Pore", "Recetor", "Sabanalarga", "Sácama", "San Luis de Palenque", "Támara", "Tauramena",
  "Trinidad", "Villanueva", "Otro",
];

/** EPS y regímenes que atiende la red en Casanare. Siempre desplegable. */
const EPS = [
  "Nueva EPS",
  "Capresoca EPS",
  "EPS Sanitas",
  "Salud Total EPS",
  "Famisanar EPS",
  "Coosalud EPS",
  "Asmet Salud EPS",
  "Compensar EPS",
  "Aliansalud EPS",
  "SOS EPS",
  "Magisterio (FOMAG)",
  "Fuerzas Militares / Policía Nacional",
  "Ecopetrol",
  "Universidad (régimen especial)",
  "Particular / sin afiliación",
  "Otra",
];

const SERVICIOS: OpcionPregunta[] = [
  { id: "urgencias", texto: "Urgencias", icono: "Siren" },
  { id: "hospitalizacion", texto: "Hospitalización", icono: "BedDouble" },
  { id: "medicina-general", texto: "Medicina General", icono: "Stethoscope" },
  { id: "laboratorio", texto: "Laboratorio Clínico", icono: "FlaskConical" },
  { id: "odontologia", texto: "Odontología", icono: "Smile" },
  { id: "pyp", texto: "Promoción y Prevención (PyP)", icono: "HeartPulse" },
  { id: "vacunacion", texto: "Vacunación", icono: "Syringe" },
  { id: "farmacia", texto: "Farmacia", icono: "Pill" },
  { id: "especializada", texto: "Medicina Especializada", icono: "UserRound" },
  { id: "otro", texto: "Otro", icono: "MoreHorizontal" },
];

const ESCALA_EBRM: OpcionPregunta[] = [
  { id: "E", texto: "Excelente", tono: "exc" },
  { id: "B", texto: "Bueno", tono: "bue" },
  { id: "R", texto: "Regular", tono: "reg" },
  { id: "M", texto: "Malo", tono: "mal" },
];
const ESCALA_EBRM_NA: OpcionPregunta[] = [...ESCALA_EBRM, { id: "NA", texto: "No aplica", tono: "na" }];

/** Perfiles de P2 en el orden literal del formato, con los servicios en que atienden. */
const PERFILES: { nombre: string; servicios?: string[]; transversal?: boolean }[] = [
  { nombre: "Odontólogo", servicios: ["Odontología"] },
  { nombre: "Enfermería", servicios: ["Urgencias", "Hospitalización", "Promoción y Prevención (PyP)", "Vacunación"] },
  { nombre: "Medico", servicios: ["Urgencias", "Hospitalización", "Medicina General"] },
  {
    nombre: "Auxiliar de enfermería",
    servicios: ["Urgencias", "Hospitalización", "Medicina General", "Odontología", "Promoción y Prevención (PyP)", "Vacunación", "Farmacia"],
  },
  { nombre: "Bacteriólogo", servicios: ["Laboratorio Clínico"] },
  { nombre: "Pediatra", servicios: ["Medicina Especializada"] },
  { nombre: "Ginecólogo", servicios: ["Medicina Especializada"] },
  { nombre: "Medicina familiar", servicios: ["Promoción y Prevención (PyP)", "Medicina Especializada"] },
  { nombre: "Nutricionista", servicios: ["Hospitalización", "Promoción y Prevención (PyP)", "Medicina Especializada"] },
  { nombre: "Psicólogo", servicios: ["Hospitalización", "Promoción y Prevención (PyP)", "Medicina Especializada"] },
  { nombre: "Facturadores", transversal: true },
  { nombre: "Vigilante/Portero", transversal: true },
  { nombre: "Servicios generales", transversal: true },
];

type Pregunta = { type: SurveyQuestionType; prompt: string; description?: string; isRequired: boolean; config: ConfigPregunta };
type Bloque = { title: string; description?: string; questions: Pregunta[] };

function idDe(texto: string) {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .trim()
    .replace(/ +/g, "-");
}

const BLOQUES: Bloque[] = [
  {
    title: "Bienvenida",
    description: BIENVENIDA,
    questions: [
      {
        type: "YES_NO",
        prompt: HABEAS,
        isRequired: true,
        config: {
          estilo: "habeas",
          opciones: [
            { id: "si", texto: "Sí autorizo", tono: "exc" },
            { id: "no", texto: "NO autorizo", tono: "na" },
          ],
        },
      },
    ],
  },
  {
    title: "Datos generales",
    description: "Solo el sexo es obligatorio. Los demás datos son opcionales y confidenciales.",
    questions: [
      { type: "DATE", prompt: "Fecha", isRequired: false, config: { rol: "fecha" } },
      { type: "SHORT_TEXT", prompt: "Nombre", isRequired: false, config: { rol: "nombre" } },
      {
        type: "SINGLE_CHOICE",
        prompt: "Sexo",
        isRequired: true,
        config: { estilo: "sexo", opciones: [{ id: "M", texto: "M" }, { id: "F", texto: "F" }] },
      },
      { type: "SHORT_TEXT", prompt: "Teléfono", isRequired: false, config: { rol: "telefono" } },
      {
        type: "SINGLE_CHOICE",
        prompt: "EPS",
        isRequired: false,
        config: { estilo: "selector", rol: "eps", opciones: EPS.map((e) => ({ id: idDe(e), texto: e })) },
      },
      {
        type: "SINGLE_CHOICE",
        prompt: "Municipio",
        isRequired: false,
        config: { estilo: "selector", rol: "municipio", opciones: MUNICIPIOS.map((m) => ({ id: idDe(m), texto: m })) },
      },
    ],
  },
  {
    title: "Pregunta 1",
    questions: [
      { type: "SINGLE_CHOICE", prompt: "1: Servicio que utilizó hoy", isRequired: true, config: { estilo: "servicios", opciones: SERVICIOS } },
      { type: "SHORT_TEXT", prompt: "¿Cuál?", isRequired: false, config: { rol: "otro" } },
    ],
  },
  {
    title: "Pregunta 2",
    description:
      "2: ¿Cómo califica la amabilidad, el trato digno y el respeto recibido por parte del personal de la institución? (E) Excelente, (B) Bueno, (R) Regular, (M) Malo",
    questions: PERFILES.map((p) => ({
      type: "SINGLE_CHOICE" as SurveyQuestionType,
      prompt: p.nombre,
      isRequired: false,
      config: { estilo: "matriz", opciones: ESCALA_EBRM_NA, servicios: p.servicios, transversal: p.transversal },
    })),
  },
  {
    title: "Pregunta 3",
    questions: [
      {
        type: "SINGLE_CHOICE",
        prompt: "3: ¿Cómo califica el respeto hacia su intimidad, confidencialidad e información médica durante su atención?",
        isRequired: true,
        config: {
          estilo: "caritas",
          autoAvanzar: true,
          opciones: [
            { ...ESCALA_EBRM[0], ayuda: "Siempre he sentido respeto y total privacidad en mi atención." },
            { ...ESCALA_EBRM[1], ayuda: "En general, he sentido respeto y adecuada confidencialidad." },
            { ...ESCALA_EBRM[2], ayuda: "En algunas ocasiones no he sentido total privacidad." },
            { ...ESCALA_EBRM[3], ayuda: "He sentido poco respeto o falta de confidencialidad en mi atención." },
          ],
        },
      },
    ],
  },
  {
    title: "Pregunta 4",
    questions: [
      {
        type: "SINGLE_CHOICE",
        prompt: "4: ¿Cómo califica las condiciones de limpieza y comodidad de las instalaciones?",
        isRequired: true,
        config: {
          estilo: "caritas",
          autoAvanzar: true,
          opciones: [
            { ...ESCALA_EBRM[0], ayuda: "Instalaciones muy limpias, ordenadas y cómodas." },
            { ...ESCALA_EBRM[1], ayuda: "En general limpias y cómodas." },
            { ...ESCALA_EBRM[2], ayuda: "Podrían estar más limpias o ser más cómodas." },
            { ...ESCALA_EBRM[3], ayuda: "Las encontré sucias o incómodas." },
          ],
        },
      },
    ],
  },
  {
    title: "Pregunta 5",
    questions: [
      {
        type: "SINGLE_CHOICE",
        prompt: "5: ¿Cómo calificaría su experiencia global respecto a los servicios de salud que ha recibido a través de esta IPS?",
        isRequired: true,
        config: {
          estilo: "tarjetas",
          autoAvanzar: true,
          opciones: [
            { id: "buena", texto: "Buena", tono: "bue" },
            { id: "muy-buena", texto: "Muy Buena", tono: "exc" },
            { id: "no-aplica", texto: "No Aplica", tono: "na" },
            { id: "regular", texto: "Regular", tono: "reg" },
            { id: "mala", texto: "Mala", tono: "mal" },
            { id: "muy-mala", texto: "Muy Mala", tono: "muymal" },
            { id: "no-responde", texto: "No Responde", tono: "na" },
            { id: "en-blanco", texto: "En Blanco", tono: "na" },
          ],
        },
      },
    ],
  },
  {
    title: "Pregunta 6",
    questions: [
      {
        type: "SINGLE_CHOICE",
        prompt: "6: ¿Usted recomendaría esta IPS a sus familiares o amigos?",
        isRequired: true,
        config: {
          estilo: "tarjetas",
          autoAvanzar: true,
          opciones: [
            { id: "def-no", texto: "Definitivamente No", tono: "muymal" },
            { id: "no-aplica", texto: "No Aplica", tono: "na" },
            { id: "prob-no", texto: "Probablemente No", tono: "mal" },
            { id: "en-blanco", texto: "En Blanco", tono: "na" },
            { id: "def-si", texto: "Definitivamente Si", tono: "exc" },
            { id: "no-responde", texto: "No Responde", tono: "na" },
            { id: "prob-si", texto: "Probablemente Si", tono: "bue" },
          ],
        },
      },
    ],
  },
  {
    title: "Pregunta 7",
    questions: [
      {
        type: "SINGLE_CHOICE",
        prompt:
          "7: ¿El personal de salud le explicó su diagnóstico, tratamiento o recomendaciones de una manera clara que le permitiera tomar decisiones sobre su cuidado en salud?",
        isRequired: true,
        config: {
          estilo: "semaforo",
          autoAvanzar: true,
          opciones: [
            { id: "si-claro", texto: "Sí, siempre me informaron con claridad.", tono: "exc" },
            { id: "dudas", texto: "Me informaron, pero me quedaron dudas.", tono: "reg" },
            { id: "no-claro", texto: "No me dieron información clara sobre mi estado.", tono: "mal" },
          ],
        },
      },
    ],
  },
  {
    title: "Pregunta 8",
    questions: [
      {
        type: "SINGLE_CHOICE",
        prompt: "8: Durante su permanencia en la institución, ¿dirigió un trato respetuoso y amable al personal de la IPS?",
        isRequired: true,
        config: {
          estilo: "semaforo",
          autoAvanzar: true,
          opciones: [
            { id: "si-respeto", texto: "Sí, mantuve un trato respetuoso.", tono: "exc" },
            { id: "inconveniente", texto: "Tuve algún inconveniente con el personal.", tono: "reg" },
            { id: "sin-normas", texto: "No me explicaron las normas de la institución.", tono: "mal" },
          ],
        },
      },
    ],
  },
  {
    title: "Pregunta 9",
    questions: [
      {
        type: "LONG_TEXT",
        prompt: "9: ¿Qué sugerencias o comentarios específicos nos daría para mejorar nuestros servicios?",
        isRequired: false,
        config: { maxLen: 600 },
      },
    ],
  },
];

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (!admin) throw new Error("No hay administrador para firmar la creación.");

  const datosEncuesta = {
    title: "Encuesta de Atención al Usuario",
    description: BIENVENIDA,
    audience: "EXTERNO" as const,
    status: "PUBLISHED" as const,
    themeColor: "#0f8b8d",
    estimatedMinutes: 3,
    allowMultipleResponses: true,
    requireLogin: false,
    thankYouMessage: "Gracias por su tiempo. Su opinión es la base de la mejora continua de Red Salud Casanare E.S.E.",
  };

  // Se busca por CÓDIGO (no por slug) para poder renombrar el enlace sin duplicar la encuesta.
  let encuesta = await prisma.survey.findUnique({ where: { code: `${CODE} ${VERSION}` }, select: { id: true } });
  if (!encuesta) {
    encuesta = await prisma.survey.create({
      data: { ...datosEncuesta, code: `${CODE} ${VERSION}`, slug: SLUG, createdBy: admin.id, publishedAt: new Date() },
      select: { id: true },
    });
    console.log("encuesta creada");
  } else {
    await prisma.survey.update({ where: { id: encuesta.id }, data: { ...datosEncuesta, slug: SLUG } });
    console.log("encuesta ya existía: datos refrescados");
  }

  for (let i = 0; i < BLOQUES.length; i++) {
    const b = BLOQUES[i];
    const pagina = await prisma.surveyPage.upsert({
      where: { surveyId_sortOrder: { surveyId: encuesta.id, sortOrder: i + 1 } },
      update: { title: b.title, description: b.description ?? null },
      create: { surveyId: encuesta.id, sortOrder: i + 1, title: b.title, description: b.description ?? null },
      select: { id: true },
    });
    for (let j = 0; j < b.questions.length; j++) {
      const q = b.questions[j];
      const datos = {
        type: q.type,
        prompt: q.prompt,
        description: q.description ?? null,
        isRequired: q.isRequired,
        config: q.config as object,
      };
      await prisma.surveyQuestion.upsert({
        where: { pageId_sortOrder: { pageId: pagina.id, sortOrder: j + 1 } },
        update: datos,
        create: { pageId: pagina.id, sortOrder: j + 1, ...datos },
      });
    }
    await prisma.surveyQuestion.deleteMany({ where: { pageId: pagina.id, sortOrder: { gt: b.questions.length } } });
  }
  await prisma.surveyPage.deleteMany({ where: { surveyId: encuesta.id, sortOrder: { gt: BLOQUES.length } } });

  const total = BLOQUES.reduce((s, b) => s + b.questions.length, 0);
  console.log(`listo · ${BLOQUES.length} bloques · ${total} preguntas · /e/${SLUG}`);
}

main().finally(() => prisma.$disconnect());
