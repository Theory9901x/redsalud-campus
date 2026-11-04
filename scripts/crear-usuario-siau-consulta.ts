import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import type { AdminSection, UserStatus } from "@prisma/client";

/**
 * CUENTA DE CONSULTA SIAU (siau.municipios): solo ve y descarga la
 * información de las encuestas. Es SEGUIMIENTO (solo lectura: el proxy
 * rechaza cualquier escritura) con todas las secciones del panel
 * restringidas menos ENCUESTAS, así que entra directo al módulo de
 * encuestas y su Centro de datos SIAU. No es el principal de SIAU (siho),
 * que sí edita.
 *
 * Idempotente: si existe, actualiza permisos, estado y contraseña.
 * Uso: npx tsx --env-file=.env scripts/crear-usuario-siau-consulta.ts <contraseña> [activo|inactivo]
 */
const USERNAME = "siau.municipios";
const DOCUMENTO = "SIAU-MUNICIPIOS";

async function main() {
  const clave = process.argv[2];
  if (!clave) throw new Error("Falta la contraseña.");
  const status: UserStatus = process.argv[3] === "inactivo" ? "INACTIVE" : "ACTIVE";
  const restringidas: AdminSection[] = ["USUARIOS", "CURSOS", "PLANES_CAPACITACION", "REUNIONES", "INSCRIPCIONES", "CERTIFICADOS", "NOTIFICACIONES", "REPORTES", "CONFIGURACION"];
  const datos = {
    fullName: "SIAU · Consulta municipios",
    username: USERNAME,
    role: "SEGUIMIENTO" as const,
    status,
    personnelType: "ADMINISTRATIVO" as const,
    department: "SIAU",
    position: "Consulta y descarga de encuestas SIAU",
    tipoVinculacion: "OTRO" as const,
    restrictedAdminSections: restringidas,
    mustChangePassword: false,
    excludeFromAttendance: true,
    passwordHash: await bcrypt.hash(clave, 10),
  };
  const existente = await prisma.user.findFirst({ where: { OR: [{ username: USERNAME }, { documentNumber: DOCUMENTO }] }, select: { id: true } });
  if (existente) {
    await prisma.user.update({ where: { id: existente.id }, data: datos });
    console.log(`usuario ${USERNAME} actualizado · ${status}`);
  } else {
    await prisma.user.create({ data: { ...datos, documentType: "CC", documentNumber: DOCUMENTO } });
    console.log(`usuario ${USERNAME} creado · ${status}`);
  }
}
main().finally(() => prisma.$disconnect());
