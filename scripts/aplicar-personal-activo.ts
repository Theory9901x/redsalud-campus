import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { registrarAuditoria } from "../lib/audit";
import { nombrePropio } from "../components/training-plans/labels";

/**
 * Aplica el listado «PERSONAL ACTIVO» de Talento Humano a la plataforma:
 *
 *   1. Corrige el correo de quien ya tiene cuenta y figura con otro (el
 *      correo ES el usuario de ingreso). Si el correo nuevo ya es de otra
 *      cuenta que no cambia, se reporta como CONFLICTO y no se toca. Los
 *      intercambios (A toma el de B, B pasa a otro) se resuelven en orden.
 *   2. Crea la cuenta de quien no existe: estudiante, activo, TEMPORAL y
 *      ASISTENCIAL (el ingreso de esta fecha es la cohorte de SSO), sin cambio
 *      forzado de clave, con una clave inservible: la temporal real la asigna
 *      y la envía enviar-credenciales-planta.ts (--regenerar-desconocidas).
 *      Los documentos creados se agregan a --claves para que entren al envío.
 *
 * Uso: npx tsx --env-file=.env scripts/aplicar-personal-activo.ts --personal=RUTA.json --claves=RUTA.json [--aplicar]
 * Entrada --personal: [{ documento, nombre, correo, celular }]
 */

type Persona = { documento: string; nombre: string; correo: string; celular: string | null };
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=");
const CORREO_VALIDO = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

async function main() {
  const aplicar = process.argv.includes("--aplicar");
  const rutaPersonal = arg("personal");
  const rutaClaves = arg("claves");
  if (!rutaPersonal || !rutaClaves) throw new Error("Faltan --personal=RUTA.json y --claves=RUTA.json");
  const personal: Persona[] = JSON.parse(readFileSync(rutaPersonal, "utf8"));
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN", restrictedAdminSections: { isEmpty: true } }, orderBy: { createdAt: "asc" }, select: { id: true } });

  const todos = await prisma.user.findMany({ select: { id: true, documentNumber: true, email: true, fullName: true } });
  const porDoc = new Map(todos.map((u) => [u.documentNumber, u]));
  // Dueño actual de cada correo (en minúsculas): se va actualizando a medida que se aplican cambios.
  const dueno = new Map(todos.filter((u) => u.email).map((u) => [u.email!.toLowerCase(), u.documentNumber]));

  // ── 1. Correos ──
  let pendientes = personal
    .map((p) => ({ p, u: porDoc.get(p.documento), nuevo: p.correo.trim().toLowerCase() }))
    .filter((x) => x.u && CORREO_VALIDO.test(x.nuevo) && x.nuevo !== (x.u.email ?? "").toLowerCase());
  const conflictos: string[] = [];
  let corregidos = 0;
  let avance = true;
  while (pendientes.length && avance) {
    avance = false;
    const siguen: typeof pendientes = [];
    for (const x of pendientes) {
      const ocupadoPor = dueno.get(x.nuevo);
      if (ocupadoPor && ocupadoPor !== x.p.documento) {
        siguen.push(x);
        continue;
      }
      const anterior = x.u!.email;
      if (aplicar) {
        await prisma.user.update({ where: { id: x.u!.id }, data: { email: x.nuevo } });
        await registrarAuditoria({ userId: admin?.id, action: "UPDATE", entity: "User", entityId: x.u!.id, description: `Correo corregido según Personal activo de Talento Humano: ${anterior ?? "—"} → ${x.nuevo}` });
      }
      if (anterior) dueno.delete(anterior.toLowerCase());
      dueno.set(x.nuevo, x.p.documento);
      corregidos++;
      avance = true;
      console.log(`CORREO   ${x.p.documento}  ${nombrePropio(x.u!.fullName)}: ${anterior ?? "—"} → ${x.nuevo}`);
    }
    pendientes = siguen;
  }
  for (const x of pendientes) {
    const otro = porDoc.get(dueno.get(x.nuevo)!);
    const msg = `CONFLICTO ${x.p.documento}  ${nombrePropio(x.u!.fullName)}: ${x.nuevo} ya es de ${otro?.fullName ?? "otra cuenta"} (doc. ${otro?.documentNumber}); se deja ${x.u!.email}`;
    conflictos.push(msg);
    console.log(msg);
  }

  // ── 2. Cuentas nuevas ──
  const nuevos = personal.filter((p) => !porDoc.has(p.documento));
  const creados: string[] = [];
  for (const p of nuevos) {
    const correo = p.correo.trim().toLowerCase();
    if (!CORREO_VALIDO.test(correo) || dueno.has(correo)) {
      console.log(`NO CREADO ${p.documento}  ${p.nombre}: correo inválido o ya usado (${correo})`);
      continue;
    }
    if (aplicar) {
      await prisma.user.create({
        data: {
          fullName: nombrePropio(p.nombre.trim()),
          documentType: "CC",
          documentNumber: p.documento,
          email: correo,
          phone: p.celular || null,
          personnelType: "ASISTENCIAL",
          tipoVinculacion: "TEMPORAL",
          origenRegistro: "IMPORTACION",
          provisionedAt: new Date(),
          provisionedBy: admin?.id ?? null,
          role: "STUDENT",
          status: "ACTIVE",
          mustChangePassword: false,
          passwordHash: await bcrypt.hash(randomBytes(24).toString("base64"), 10),
        },
      });
    }
    dueno.set(correo, p.documento);
    creados.push(p.documento);
    console.log(`NUEVO    ${p.documento}  ${nombrePropio(p.nombre.trim())}  ${correo}`);
  }

  if (aplicar && creados.length) {
    const claves: { documento: string; clave: string }[] = JSON.parse(readFileSync(rutaClaves, "utf8"));
    const ya = new Set(claves.map((c) => c.documento));
    for (const d of creados) if (!ya.has(d)) claves.push({ documento: d, clave: "" });
    writeFileSync(rutaClaves, JSON.stringify(claves));
  }

  console.log(`\n${aplicar ? "APLICADO" : "SIMULACIÓN (nada cambió)"} · correos corregidos: ${corregidos} · conflictos: ${conflictos.length} · cuentas nuevas: ${creados.length}`);
}

main().finally(() => prisma.$disconnect());
