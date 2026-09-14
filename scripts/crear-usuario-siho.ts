import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import type { AdminSection } from "@prisma/client";

/**
 * USUARIO SIHO: administrador con acceso ÚNICAMENTE al módulo de encuestas
 * y su centro de datos (sección ENCUESTAS); todas las demás secciones de
 * administración quedan restringidas. Idempotente: si existe, actualiza
 * restricciones y contraseña.
 *
 * Uso: npx tsx --env-file=.env scripts/crear-usuario-siho.ts [contraseña]
 */
const EMAIL = "siho@redsaludteforma.com";
const USERNAME = "siho";

async function main() {
  const clave = process.argv[2] ?? "Siho2026*";
  const restringidas: AdminSection[] = ["USUARIOS", "CURSOS", "PLANES_CAPACITACION", "INSCRIPCIONES", "CERTIFICADOS", "NOTIFICACIONES", "REPORTES", "CONFIGURACION"];
  const passwordHash = await bcrypt.hash(clave, 10);
  const existente = await prisma.user.findFirst({ where: { OR: [{ email: EMAIL }, { username: USERNAME }] }, select: { id: true } });
  const datos = {
    fullName: "SIAU · Atención al Usuario (SIHO)",
    email: EMAIL,
    username: USERNAME,
    role: "ADMIN" as const,
    status: "ACTIVE" as const,
    personnelType: "ADMINISTRATIVO" as const,
    department: "SIAU",
    position: "Gestión de encuestas de satisfacción",
    tipoVinculacion: "OTRO" as const,
    restrictedAdminSections: restringidas,
    mustChangePassword: false,
    passwordHash,
  };
  if (existente) {
    await prisma.user.update({ where: { id: existente.id }, data: datos });
    console.log("usuario SIHO actualizado");
  } else {
    await prisma.user.create({ data: { ...datos, documentType: "CC", documentNumber: "SIHO-2026" } });
    console.log("usuario SIHO creado");
  }
  console.log(`acceso: ${EMAIL} (o usuario "${USERNAME}") · contraseña: ${clave} · solo Encuestas y Centro de datos SIAU`);
}
main().finally(() => prisma.$disconnect());
