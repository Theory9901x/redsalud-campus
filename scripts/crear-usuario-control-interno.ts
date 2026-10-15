import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { prisma } from "../lib/prisma";

/**
 * USUARIO DE CONTROL INTERNO: rol SEGUIMIENTO. Ve todo el panel
 * administrativo -planes, comités, reuniones, encuestas, métricas, informes y
 * exportaciones- pero no puede crear, editar ni eliminar nada (el proxy
 * rechaza toda escritura de este rol). Idempotente: si existe, actualiza
 * rol y contraseña.
 *
 * Uso: npx tsx --env-file=.env scripts/crear-usuario-control-interno.ts [contraseña]
 */
const EMAIL = "controlinterno@redsaludteforma.com";
const USERNAME = "control.interno";

async function main() {
  const clave = process.argv[2] ?? `ControlInt-${randomInt(1000, 9999)}*`;
  const passwordHash = await bcrypt.hash(clave, 10);
  const existente = await prisma.user.findFirst({ where: { OR: [{ email: EMAIL }, { username: USERNAME }] }, select: { id: true } });
  const datos = {
    fullName: "Control Interno · Seguimiento",
    email: EMAIL,
    username: USERNAME,
    role: "SEGUIMIENTO" as const,
    status: "ACTIVE" as const,
    personnelType: "ADMINISTRATIVO" as const,
    department: "Control Interno",
    position: "Seguimiento y control (solo lectura)",
    tipoVinculacion: "OTRO" as const,
    restrictedAdminSections: [],
    mustChangePassword: false,
    passwordHash,
  };
  if (existente) {
    await prisma.user.update({ where: { id: existente.id }, data: datos });
    console.log("usuario de Control Interno actualizado");
  } else {
    await prisma.user.create({ data: { ...datos, documentType: "CC", documentNumber: "CONTROL-INTERNO" } });
    console.log("usuario de Control Interno creado");
  }
  console.log(`acceso: ${EMAIL} (o usuario "${USERNAME}") · contraseña: ${clave} · rol SEGUIMIENTO (solo lectura)`);
}
main().finally(() => prisma.$disconnect());
