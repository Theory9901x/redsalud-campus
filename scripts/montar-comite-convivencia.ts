import { prisma } from "../lib/prisma";
import type { CommitteeRole } from "@prisma/client";

/**
 * COMITÉ DE CONVIVENCIA LABORAL 2026-2028 (Resolución 084 del 30 de enero
 * de 2026). Convierte el plan que ya tiene la reunión del comité (con su
 * asistencia y conexiones) en el comité del módulo, y carga los
 * integrantes de la resolución por zona, cargo y rol, vinculando la
 * cuenta de cada uno por documento. Idempotente.
 */
const TITULO_PLAN_PREVIO = "Reunión comité convivencia laboral";
const TITULO = "Comité de Convivencia Laboral";

const RESUMEN =
  "Conformado mediante Resolución No. 084 del 30 de enero de 2026 para el periodo 2026-2028, en cumplimiento de la Ley 1010 de 2006, la Resolución 2646 de 2008 y la Resolución 3461 de 2025 del Ministerio del Trabajo. Red Salud Casanare E.S.E. designa comités por centro de trabajo -Zona Norte, Zona Centro, Zona Sur y Sede Administrativa- con representantes principales y suplentes del empleador y de los trabajadores en igual número. El comité previene, atiende y hace seguimiento a las situaciones que puedan constituir acoso laboral, bajo los principios de celeridad, eficacia, imparcialidad y confidencialidad; elige presidente y secretario entre sus integrantes, sesiona ordinariamente cada mes con la mitad más uno de sus integrantes y extraordinariamente cada vez que se recibe una queja.";

const FUNCIONES = [
  { n: 1, texto: "Recibir y dar trámite a las quejas presentadas en las que se describan situaciones que puedan constituir acoso laboral.", plazo: "5 días calendario" },
  { n: 2, texto: "Examinar de manera confidencial los casos específicos o puntuales en los que se formule queja o reclamo que pudieran tipificar conductas o circunstancias de acoso laboral.", plazo: "5 días calendario, ampliables 10 más con justificación escrita (máximo 15)" },
  { n: 3, texto: "Escuchar a las partes involucradas de manera individual sobre los hechos que dieron lugar a la queja.", plazo: "5 días calendario" },
  { n: 4, texto: "Adelantar reuniones para crear un espacio de diálogo entre las partes, promoviendo compromisos mutuos y formulando un plan de mejora concertado, garantizando la confidencialidad.", plazo: "Entre 5 días calendario después de escuchar a las partes, ampliables 10 más (máximo 15)" },
  { n: 5, texto: "Hacer seguimiento a los compromisos adquiridos por las partes involucradas en la queja, verificando su cumplimiento.", plazo: "Mensual" },
  { n: 6, texto: "Cuando no haya acuerdo, no se cumplan las recomendaciones o la conducta persista, remitir la queja a la Procuraduría General de la Nación o a las Personerías, según la circunscripción territorial.", plazo: "Máximo 15 días calendario una vez verificado el incumplimiento" },
  { n: 7, texto: "Presentar a la alta dirección las recomendaciones para el desarrollo efectivo de las medidas preventivas y correctivas del acoso laboral, con copia al trabajador.", plazo: "Entre 5 y máximo 10 días calendario" },
  { n: 8, texto: "Hacer seguimiento al cumplimiento de las recomendaciones dadas por el comité a Talento Humano y a Seguridad y Salud en el Trabajo.", plazo: "Mensual" },
  { n: 9, texto: "Elaborar informes trimestrales y un informe anual sobre la gestión del comité, con estadísticas de quejas, seguimiento de casos y recomendaciones, para la alta dirección.", plazo: "Trimestral y anual" },
  { n: 10, texto: "Presentar un informe anual de resultados de la gestión del comité y los informes requeridos por los organismos de control.", plazo: "Anual" },
];

type Integrante = { nombre: string; documento: string; cargo: string; rol: CommitteeRole; zona: string };
const PE: CommitteeRole = "PRINCIPAL_EMPLEADOR";
const SE: CommitteeRole = "SUPLENTE_EMPLEADOR";
const PT: CommitteeRole = "PRINCIPAL_TRABAJADORES";
const ST: CommitteeRole = "SUPLENTE_TRABAJADORES";

const INTEGRANTES: Integrante[] = [
  // Zona Norte
  { zona: "Zona Norte", nombre: "Mario Cruz Acosta", documento: "4214841", cargo: "Auxiliar administrativo", rol: PE },
  { zona: "Zona Norte", nombre: "Angela Astrid Vargas", documento: "23324442", cargo: "Auxiliar administrativo", rol: PE },
  { zona: "Zona Norte", nombre: "Alfredo Corredor", documento: "74085479", cargo: "Auxiliar de enfermería", rol: SE },
  { zona: "Zona Norte", nombre: "Mercedes Reyes", documento: "23790182", cargo: "Auxiliar administrativo", rol: SE },
  { zona: "Zona Norte", nombre: "Lidia Carlina Lemus", documento: "1057571030", cargo: "Auxiliar de enfermería", rol: PT },
  { zona: "Zona Norte", nombre: "Carlos Humberto Moreno", documento: "6965204", cargo: "Auxiliar de enfermería", rol: PT },
  { zona: "Zona Norte", nombre: "Johana Olmos", documento: "1115850537", cargo: "Auxiliar de enfermería", rol: ST },
  { zona: "Zona Norte", nombre: "Mónica Bermúdez Jara", documento: "1118648174", cargo: "Vacunador", rol: ST },
  // Zona Centro
  { zona: "Zona Centro", nombre: "Elvia Hernández", documento: "24191765", cargo: "Auxiliar de enfermería", rol: PE },
  { zona: "Zona Centro", nombre: "Antonio Olivarez", documento: "74849040", cargo: "Auxiliar administrativo", rol: PE },
  { zona: "Zona Centro", nombre: "María Rosario Hernández", documento: "23827370", cargo: "Auxiliar de odontología", rol: SE },
  { zona: "Zona Centro", nombre: "Neidy Yicela Rodríguez", documento: "52914309", cargo: "Auxiliar de odontología", rol: SE },
  { zona: "Zona Centro", nombre: "Homero Camacho Valcárcel", documento: "7361625", cargo: "Vacunador", rol: PT },
  { zona: "Zona Centro", nombre: "Casilda Betancourth Fuentes", documento: "23827642", cargo: "Auxiliar administrativo", rol: PT },
  { zona: "Zona Centro", nombre: "Olga Magnolia Sánchez", documento: "53103562", cargo: "Auxiliar de enfermería", rol: ST },
  { zona: "Zona Centro", nombre: "Marta Ibet Gómez", documento: "24144038", cargo: "Auxiliar", rol: ST },
  // Zona Sur
  { zona: "Zona Sur", nombre: "Sonia Milena Cristancho", documento: "46673037", cargo: "Bacterióloga", rol: PE },
  { zona: "Zona Sur", nombre: "Nixon Fauner Roa", documento: "74810233", cargo: "Auxiliar de la salud", rol: PE },
  { zona: "Zona Sur", nombre: "Adriana Marcela Romero", documento: "1116992238", cargo: "Auxiliar administrativo", rol: SE },
  { zona: "Zona Sur", nombre: "Dixi Milena Neira", documento: "33645826", cargo: "Auxiliar de la salud", rol: SE },
  { zona: "Zona Sur", nombre: "María del Mar Castillo", documento: "1143241300", cargo: "Médico", rol: PT },
  { zona: "Zona Sur", nombre: "Edgar Enrique Siachoque", documento: "79865331", cargo: "Odontólogo", rol: PT },
  { zona: "Zona Sur", nombre: "Edna Yisell Mendoza", documento: "23415770", cargo: "Auxiliar de enfermería", rol: ST },
  { zona: "Zona Sur", nombre: "Jhon Everth Acosta", documento: "80047300", cargo: "Conductor", rol: ST },
  // Sede Administrativa
  { zona: "Sede Administrativa", nombre: "Antenor Torres Ariza", documento: "91011608", cargo: "Subgerente Administrativo y Financiero", rol: PE },
  { zona: "Sede Administrativa", nombre: "Ana María González", documento: "33645529", cargo: "Subgerente de Prestación de Servicios", rol: PE },
  { zona: "Sede Administrativa", nombre: "Sandra Milena Galindo", documento: "40215232", cargo: "Profesional Universitario · Contabilidad", rol: SE },
  { zona: "Sede Administrativa", nombre: "Paola Andrea Pulgarín", documento: "33481157", cargo: "Directora de Zona Centro", rol: SE },
  { zona: "Sede Administrativa", nombre: "Wilmar Hernando Pérez", documento: "74814418", cargo: "Profesional especializado · Financiera", rol: PT },
  { zona: "Sede Administrativa", nombre: "Ledy Tatiana Leal", documento: "1121929515", cargo: "Técnico administrativo", rol: PT },
  { zona: "Sede Administrativa", nombre: "Yeimy Tatiana Merchán", documento: "1052386319", cargo: "Directora de Zona Norte", rol: ST },
  { zona: "Sede Administrativa", nombre: "Alejandra del Pilar Castellanos", documento: "1121859003", cargo: "Directora de Zona Sur", rol: ST },
];

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (!admin) throw new Error("Sin administrador.");

  // El plan que ya tiene la reunión celebrada (asistencia + conexiones) se
  // convierte en el comité; si no existe (otro entorno), se crea.
  let comite = await prisma.trainingPlan.findFirst({
    where: { OR: [{ kind: "COMITE", title: TITULO }, { title: TITULO_PLAN_PREVIO }] },
    select: { id: true },
  });
  const datos = {
    kind: "COMITE" as const,
    title: TITULO,
    year: 2026,
    status: "ACTIVE" as const,
    resolutionNumber: "084 de 2026",
    resolutionDate: new Date("2026-01-30T12:00:00"),
    periodLabel: "2026-2028",
    summary: RESUMEN,
    functions: FUNCIONES,
    description: "Comité de Convivencia Laboral · Resolución 084 del 30 de enero de 2026 · periodo 2026-2028.",
    targetDepartment: null,
  };
  if (comite) {
    await prisma.trainingPlan.update({ where: { id: comite.id }, data: datos });
    console.log("comité actualizado (plan existente convertido)");
  } else {
    comite = await prisma.trainingPlan.create({ data: { ...datos, tutorId: admin.id }, select: { id: true } });
    console.log("comité creado");
  }

  let vinculados = 0;
  for (let i = 0; i < INTEGRANTES.length; i++) {
    const it = INTEGRANTES[i];
    const usuario = await prisma.user.findUnique({ where: { documentNumber: it.documento }, select: { id: true, fullName: true } });
    if (usuario) vinculados++;
    const data = {
      userId: usuario?.id ?? null,
      fullName: usuario?.fullName ?? it.nombre,
      zone: it.zona,
      position: it.cargo,
      role: it.rol,
      sortOrder: i,
    };
    await prisma.committeeMember.upsert({
      where: { planId_documentNumber: { planId: comite.id, documentNumber: it.documento } },
      update: data,
      create: { planId: comite.id, documentNumber: it.documento, ...data },
    });
  }
  console.log(`integrantes: ${INTEGRANTES.length} · con cuenta vinculada: ${vinculados} · /admin/comites/${comite.id}`);
}

main().finally(() => prisma.$disconnect());
