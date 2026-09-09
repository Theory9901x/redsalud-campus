import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

/**
 * RESTABLECIMIENTO EN LOTE de contraseñas temporales para un listado de
 * documentos, para entregarlas en mano.
 *
 * Regla de cuidado: a quien ya inició sesión y fijó su propia contraseña
 * (mustChangePassword = false y lastLoginAt con valor) NO se le toca; se
 * reporta que conserva la suya. Al resto se le asigna una temporal legible
 * y sin cambio forzado (decisión de Talento Humano para personal poco
 * familiarizado con la plataforma).
 *
 * Uso: npx tsx --env-file=.env scripts/restablecer-claves-lote.ts [--dry] doc1 doc2 …
 * Salida: JSON por línea con documento, nombre, correo, clave y estado.
 */
function clave() {
  return `RedSalud${randomInt(1000, 9999)}*`;
}

async function main() {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const documentos = args.filter((a) => /^\d+$/.test(a));
  if (documentos.length === 0) throw new Error("Pasa los documentos como argumentos.");

  for (const doc of documentos) {
    const u = await prisma.user.findUnique({
      where: { documentNumber: doc },
      select: { id: true, fullName: true, email: true, username: true, lastLoginAt: true, mustChangePassword: true, department: true },
    });
    if (!u) {
      console.log(JSON.stringify({ documento: doc, estado: "NO EXISTE" }));
      continue;
    }
    const propia = u.lastLoginAt !== null && !u.mustChangePassword;
    if (propia) {
      console.log(
        JSON.stringify({
          documento: doc,
          nombre: u.fullName,
          usuario: u.email ?? u.username,
          clave: "",
          estado: "CONSERVA LA SUYA",
          nota: `Ya ingresó (${u.lastLoginAt!.toISOString().slice(0, 10)}) y fijó su contraseña`,
        })
      );
      continue;
    }
    const nueva = clave();
    if (!dry) {
      await prisma.user.update({
        where: { id: u.id },
        data: { passwordHash: await bcrypt.hash(nueva, 10), mustChangePassword: false, status: "ACTIVE" },
      });
    }
    console.log(
      JSON.stringify({
        documento: doc,
        nombre: u.fullName,
        usuario: u.email ?? u.username,
        clave: nueva,
        estado: dry ? "SIMULADO" : "TEMPORAL ASIGNADA",
        nota: u.lastLoginAt ? `Había ingresado el ${u.lastLoginAt.toISOString().slice(0, 10)} pero con temporal pendiente` : "Nunca ha ingresado",
      })
    );
  }
}

main().finally(() => prisma.$disconnect());
