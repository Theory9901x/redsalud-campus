import bcrypt from "bcryptjs";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { prisma } from "../lib/prisma";

/**
 * Clave TEMPORAL para verificar la interfaz con un navegador automatizado
 * sin conocer la clave real de nadie. Guarda el hash original en un archivo
 * y lo devuelve tal cual; se niega a poner una segunda clave temporal si la
 * anterior no se restauró (así nunca se pierde el hash original).
 *
 *   npx tsx --env-file=.env scripts/clave-temporal-verificacion.ts poner <email> <clave>
 *   npx tsx --env-file=.env scripts/clave-temporal-verificacion.ts restaurar <email>
 */
const RESPALDO = (email: string) => `/tmp/clave-original-${email.replace(/[^a-z0-9]/gi, "_")}.json`;

async function main() {
  const [modo, email, clave] = process.argv.slice(2);
  if (!modo || !email) throw new Error("uso: poner <email> <clave> | restaurar <email>");
  const usuario = await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true, passwordHash: true, mustChangePassword: true } });
  const archivo = RESPALDO(email);
  if (modo === "poner") {
    if (!clave) throw new Error("falta la clave temporal");
    if (existsSync(archivo)) throw new Error(`ya hay una clave temporal puesta para ${email}; restaura primero`);
    writeFileSync(archivo, JSON.stringify({ hash: usuario.passwordHash, mustChangePassword: usuario.mustChangePassword }));
    await prisma.user.update({ where: { id: usuario.id }, data: { passwordHash: await bcrypt.hash(clave, 10), mustChangePassword: false } });
    console.log(`clave temporal puesta a ${email}`);
  } else if (modo === "restaurar") {
    const g = JSON.parse(readFileSync(archivo, "utf8")) as { hash: string | null; mustChangePassword: boolean };
    await prisma.user.update({ where: { id: usuario.id }, data: { passwordHash: g.hash, mustChangePassword: g.mustChangePassword } });
    unlinkSync(archivo);
    console.log(`clave original restaurada a ${email}`);
  } else throw new Error("modo desconocido");
}
main().finally(() => prisma.$disconnect());
