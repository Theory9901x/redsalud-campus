/**
 * Crea el usuario TUTOR de cada área del plan de capacitaciones, y reconcilia
 * las áreas con la estructura real del plan.
 *
 * Hasta ahora el responsable de cada capacitación era un texto tomado del
 * plan ("Profesional Lider PAI", "Coordinacion SIAU"): describía un cargo,
 * pero no correspondía a nadie que pudiera entrar a la plataforma. Estas
 * cuentas son las que permiten que cada área suba su propio material, arme
 * su evaluación y cierre sus jornadas sin pasar por el administrador.
 *
 * Hay UNA cuenta por ÁREA, no por programa. El plan escribe "CALIDAD -
 * SEGURIDAD DEL PACIENTE" y "CALIDAD - IAAS- PROA -PMMHM" en celdas
 * distintas, pero eso no son dos calidades: es un área con dos programas y
 * una sola responsable. Lo mismo con las cinco rutas integrales.
 *
 *   node --env-file=.env node_modules/tsx/dist/cli.mjs prisma/crear-tutores-areas.ts
 *
 * Dos cosas deliberadas:
 *
 *  - Son cuentas DE ÁREA, no de persona. Por eso el identificador no es una
 *    cédula inventada sino un código de área visible como tal, y por eso no
 *    llevan correo: no tengo los correos institucionales y ponerlos a dedo
 *    haría que los avisos se fueran a direcciones que no existen. Entran con
 *    su nombre de usuario.
 *  - Nacen con contraseña temporal marcada para cambio obligatorio.
 *
 * Cuando Talento Humano diga qué persona responde por cada área, se cambia
 * el nombre y el documento de la cuenta; no hay que rehacer nada.
 */
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { registrarAuditoria } from "../lib/audit";

/** Contraseña temporal común: se entrega al área y se cambia al primer ingreso. */
const CLAVE_TEMPORAL = "RedSalud2026*";

type CuentaArea = {
  /** Nombre canónico del área, igual que en TrainingArea. */
  area: string;
  nombre: string;
  usuario: string;
  /** Responsable según el plan, tal cual lo nombra el documento. */
  cargo: string;
  /**
   * Cuentas de una versión anterior que se crearon por programa y ahora
   * sobran. La primera que exista se renombra a esta; las demás se eliminan
   * si ya no las referencia nada.
   */
  reemplaza?: string[];
};

const CUENTAS: CuentaArea[] = [
  {
    area: "Calidad",
    nombre: "Calidad",
    usuario: "calidad",
    cargo: "Profesional líder de Calidad",
    reemplaza: ["calidad.iaas", "calidad.seguridad"],
  },
  {
    area: "Rutas Integrales",
    nombre: "Rutas Integrales de Atención",
    usuario: "rutas.integrales",
    cargo: "Profesional líder de Rutas Integrales",
    reemplaza: ["rutas.pai", "rutas.riamp", "rutas.pms", "rutas.precursoras", "rutas.salud.oral"],
  },
  { area: "Atención al Usuario", nombre: "Atención al Usuario · SIAU", usuario: "siau", cargo: "Coordinación SIAU" },
  { area: "Servicios Farmacéuticos", nombre: "Servicios Farmacéuticos", usuario: "farmacia", cargo: "Regentes zonales de farmacia" },
  { area: "Mantenimiento", nombre: "Mantenimiento", usuario: "mantenimiento", cargo: "Profesional ambiental", reemplaza: ["ambiental"] },
  { area: "Seguridad y Salud en el Trabajo", nombre: "Seguridad y Salud en el Trabajo", usuario: "sst", cargo: "Profesional SG-SST" },
  { area: "Salud Pública", nombre: "Salud Pública", usuario: "salud.publica", cargo: "Profesional de salud pública" },
  {
    area: "Talento Humano",
    nombre: "Talento Humano",
    usuario: "talento.humano",
    cargo: "Oficina de Talento Humano",
    reemplaza: ["talento.humano.edl"],
  },
];

/** El documento identifica la CUENTA DE ÁREA; no es una cédula ni lo aparenta. */
const documentoDe = (usuario: string) => `AREA-${usuario.toUpperCase().replace(/\./g, "-")}`;

async function main() {
  const admin = await prisma.user.findFirstOrThrow({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  const hash = await bcrypt.hash(CLAVE_TEMPORAL, 10);
  let creados = 0;
  const sobrantes: string[] = [];

  for (const c of CUENTAS) {
    const area = await prisma.trainingArea.findUnique({ where: { name: c.area }, select: { id: true } });
    if (!area) {
      console.log(`⚠ El área «${c.area}» no está en el plan. Se salta.`);
      continue;
    }

    let tutor = await prisma.user.findUnique({ where: { username: c.usuario }, select: { id: true } });
    let accion = tutor ? "=" : "+";

    // Reutiliza una cuenta por programa de la versión anterior en vez de
    // crear una nueva y dejar la vieja huérfana: así lo que ya colgaba de
    // ella (cursos, material subido) sigue colgando de quien corresponde.
    if (!tutor && c.reemplaza) {
      for (const viejo of c.reemplaza) {
        const previo = await prisma.user.findUnique({ where: { username: viejo }, select: { id: true } });
        if (!previo) continue;
        tutor = await prisma.user.update({
          where: { id: previo.id },
          data: { username: c.usuario, documentNumber: documentoDe(c.usuario), fullName: c.nombre, position: c.cargo, department: c.area },
        });
        accion = "~";
        break;
      }
    }

    if (!tutor) {
      tutor = await prisma.user.create({
        data: {
          fullName: c.nombre,
          documentType: "CC",
          documentNumber: documentoDe(c.usuario),
          username: c.usuario,
          email: null,
          position: c.cargo,
          department: c.area,
          role: "TUTOR",
          status: "ACTIVE",
          passwordHash: hash,
          mustChangePassword: true,
          personnelType: "ADMINISTRATIVO",
          tipoVinculacion: "OTRO",
          origenRegistro: "IMPORTACION",
          provisionedAt: new Date(),
          provisionedBy: admin.id,
        },
      });
      creados += 1;
      await registrarAuditoria({
        userId: admin.id,
        action: "CREATE",
        entity: "User",
        entityId: tutor.id,
        description: `Creó la cuenta de área «${c.nombre}» como tutor del plan de capacitaciones.`,
      });
    } else if (accion === "=") {
      await prisma.user.update({ where: { id: tutor.id }, data: { fullName: c.nombre, position: c.cargo, department: c.area } });
    }

    await prisma.trainingArea.update({ where: { id: area.id }, data: { tutorId: tutor.id } });

    // El responsable de cada capacitación del área deja de ser solo un texto.
    // Se reasignan TODAS, no solo las que estén sin responsable: si el área se
    // consolidó, las que apuntaban a la cuenta de un programa tienen que pasar
    // a la del área.
    const actividades = await prisma.trainingActivity.updateMany({
      where: { areaId: area.id },
      data: { responsibleUserId: tutor.id },
    });

    if (c.reemplaza) sobrantes.push(...c.reemplaza.filter((u) => u !== c.usuario));

    console.log(`${accion} ${c.usuario.padEnd(18)} ${c.nombre.slice(0, 36).padEnd(36)} ${String(actividades.count).padStart(2)} capacitaciones`);
  }

  // ---- Limpieza de las cuentas por programa que quedaron sin uso ---------
  let borradas = 0;
  for (const usuario of sobrantes) {
    const u = await prisma.user.findUnique({
      where: { username: usuario },
      select: {
        id: true,
        fullName: true,
        _count: {
          select: { coursesTutored: true, trainingAreasLed: true, trainingActivitiesResponsible: true, mediaUploads: true, enrollments: true },
        },
      },
    });
    if (!u) continue;

    const referencias = Object.values(u._count).reduce((a, b) => a + b, 0);
    if (referencias > 0) {
      console.log(`⚠ «${u.fullName}» todavía tiene ${referencias} referencias; no se borra.`);
      continue;
    }
    await prisma.user.delete({ where: { id: u.id } });
    borradas += 1;
  }

  const sinTutor = await prisma.trainingArea.count({ where: { tutorId: null } });
  console.log(`\nCuentas nuevas: ${creados} · cuentas por programa retiradas: ${borradas} · áreas sin tutor: ${sinTutor}`);
  if (creados > 0) {
    console.log(`Contraseña temporal para las nuevas: ${CLAVE_TEMPORAL}`);
    console.log("Entran con su nombre de usuario.");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("FALLÓ:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
