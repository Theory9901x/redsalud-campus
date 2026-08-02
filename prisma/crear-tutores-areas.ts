/**
 * Crea el usuario TUTOR de cada área del plan de capacitaciones.
 *
 * Hasta ahora el responsable de cada capacitación era un texto tomado del
 * plan ("Profesional Lider PAI", "Coordinacion SIAU"): describía un cargo,
 * pero no correspondía a nadie que pudiera entrar a la plataforma. Estas
 * cuentas son las que permiten que cada área suba su propio material, arme
 * su evaluación y cierre sus jornadas sin pasar por el administrador.
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
 *  - Nacen con contraseña temporal y obligación de cambiarla en el primer
 *    ingreso, así que la contraseña que imprime este script deja de servir
 *    en cuanto el área entra.
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
  /** Nombre exacto del área en el plan. */
  area: string;
  /** Cómo se muestra la cuenta en la plataforma. */
  nombre: string;
  usuario: string;
  /** Responsable según el plan, tal cual lo nombra el documento. */
  cargo: string;
};

const CUENTAS: CuentaArea[] = [
  { area: "CALIDAD - IAAS- PROA -PMMHM", nombre: "Calidad · IAAS, PROA y Higiene de Manos", usuario: "calidad.iaas", cargo: "Profesional líder del programa" },
  { area: "CALIDAD - SEGURIDAD DEL PACIENTE", nombre: "Calidad · Seguridad del Paciente", usuario: "calidad.seguridad", cargo: "Profesional líder del programa" },
  { area: "RUTAS INTEGRALES - PAI", nombre: "Rutas Integrales · PAI", usuario: "rutas.pai", cargo: "Profesional líder PAI" },
  { area: "ATENCION AL USUARIO", nombre: "Atención al Usuario · SIAU", usuario: "siau", cargo: "Coordinación SIAU" },
  { area: "RUTAS INTEGRALES - RIAMP", nombre: "Rutas Integrales · Materno Perinatal", usuario: "rutas.riamp", cargo: "Profesional líder Ruta Materno Perinatal" },
  { area: "RUTAS INTEGRALES - PMS", nombre: "Rutas Integrales · Promoción y Mantenimiento", usuario: "rutas.pms", cargo: "Líder Ruta PMS" },
  { area: "RUTAS INTEGRALES - PRECURSORAS", nombre: "Rutas Integrales · Precursoras", usuario: "rutas.precursoras", cargo: "Líder Ruta PMS" },
  { area: "RUTAS INTEGRALES - SALUD ORAL", nombre: "Rutas Integrales · Salud Oral", usuario: "rutas.salud.oral", cargo: "Líder Ruta PMS" },
  { area: "SERVICIOS FARMACEUTICOS", nombre: "Servicios Farmacéuticos", usuario: "farmacia", cargo: "Regentes zonales de farmacia" },
  { area: "MANTENIMIENTO - AMBIENTAL", nombre: "Mantenimiento · Ambiental", usuario: "ambiental", cargo: "Profesional ambiental" },
  { area: "SEGURIDAD Y SALUD EN EL TRABAJO", nombre: "Seguridad y Salud en el Trabajo", usuario: "sst", cargo: "Profesional SG-SST" },
  { area: "SALUD PUBLICA", nombre: "Salud Pública", usuario: "salud.publica", cargo: "Profesional salud pública" },
  { area: "TALENTO HUMANO", nombre: "Talento Humano", usuario: "talento.humano", cargo: "Oficina de Talento Humano" },
  { area: "Talento Humano -Personal de carrera administrativa", nombre: "Talento Humano · Evaluación del Desempeño", usuario: "talento.humano.edl", cargo: "Talento Humano — evaluadores y evaluados" },
];

async function main() {
  const admin = await prisma.user.findFirstOrThrow({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  const hash = await bcrypt.hash(CLAVE_TEMPORAL, 10);
  let creados = 0;
  let existentes = 0;

  for (const c of CUENTAS) {
    const area = await prisma.trainingArea.findUnique({ where: { name: c.area }, select: { id: true, tutorId: true } });
    if (!area) {
      console.log(`⚠ El área «${c.area}» no está en el plan. Se salta.`);
      continue;
    }

    // El documento identifica la CUENTA DE ÁREA. No es una cédula ni lo
    // aparenta: quien lo vea en el listado tiene que notar que detrás no hay
    // una persona todavía.
    const documento = `AREA-${c.usuario.toUpperCase().replace(/\./g, "-")}`;

    const yaEsta = await prisma.user.findUnique({ where: { username: c.usuario }, select: { id: true } });

    const tutor =
      yaEsta ??
      (await prisma.user.create({
        data: {
          fullName: c.nombre,
          documentType: "CC",
          documentNumber: documento,
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
      }));

    if (yaEsta) {
      existentes += 1;
    } else {
      creados += 1;
      await registrarAuditoria({
        userId: admin.id,
        action: "CREATE",
        entity: "User",
        entityId: tutor.id,
        description: `Creó la cuenta de área «${c.nombre}» como tutor del plan de capacitaciones.`,
      });
    }

    await prisma.trainingArea.update({ where: { id: area.id }, data: { tutorId: tutor.id } });

    // El responsable de cada capacitación del área deja de ser solo un texto.
    const actividades = await prisma.trainingActivity.updateMany({
      where: { areaId: area.id, responsibleUserId: null },
      data: { responsibleUserId: tutor.id },
    });

    console.log(
      `${yaEsta ? "=" : "+"} ${c.usuario.padEnd(20)} ${c.nombre.slice(0, 44).padEnd(44)} ${actividades.count} capacitaciones`
    );
  }

  console.log(`\nCuentas nuevas: ${creados} · ya existían: ${existentes}`);
  if (creados > 0) {
    console.log(`Contraseña temporal para las nuevas: ${CLAVE_TEMPORAL}`);
    console.log("Entran con su nombre de usuario y deben cambiarla en el primer ingreso.");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("FALLÓ:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
