import { existsSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { correoConfigurado, enviarCorreo, plantillaCredenciales } from "../lib/correo";
import { nombrePropio } from "../components/training-plans/labels";

/**
 * ENVÍO MASIVO, UNO A UNO, de las credenciales del personal de planta.
 *
 * Entrada: JSON [{ documento, clave }] con la contraseña temporal entregada a
 * cada persona (sale de «Base de datos de credenciales»). Nada más: el
 * nombre y el correo se toman de la plataforma, que tiene los correos
 * actualizados.
 *
 * Por cada documento se decide:
 *   CREDENCIALES  la clave del archivo sigue sirviendo (se comprueba contra el
 *                 hash) → correo con usuario + contraseña.
 *   SOLO_ACCESO   la persona ya ingresó y cambió su clave → correo con su
 *                 usuario y cómo recuperarla; la clave vieja NO se manda.
 *   CLAVE_NUEVA   nunca ha ingresado pero la clave del archivo ya no es la
 *                 suya (se la restablecieron después). Solo con
 *                 --regenerar-desconocidas: se le asigna una temporal nueva
 *                 y se le envía; sin la bandera queda OMITIDO.
 *   OMITIDO       no existe, no es de planta, está inactiva, es admin o no
 *                 tiene correo real (los «.sin-correo@»): se entrega a mano.
 *
 * Uso (en el servidor, desde /opt/redsalud/current):
 *   npx tsx --env-file=.env scripts/enviar-credenciales-planta.ts --archivo=RUTA.json            # simulación, no envía
 *   npx tsx --env-file=.env scripts/enviar-credenciales-planta.ts --archivo=RUTA.json --prueba=correo@x.com
 *        un solo correo de muestra, con datos ficticios, a esa dirección
 *   npx tsx --env-file=.env scripts/enviar-credenciales-planta.ts --archivo=RUTA.json --enviar [--limite=N] [--pausa=6000] [--sin-solo-acceso] [--regenerar-desconocidas]
 *
 * Retomable: cada envío queda en registro.jsonl (junto al JSON de entrada, sin
 * contraseñas); al volver a correr se salta a quien ya figura como ENVIADO.
 * Al final escribe informe.json con el estado de cada persona.
 */

type Entrada = { documento: string; clave: string };
type Tipo = "CREDENCIALES" | "SOLO_ACCESO" | "CLAVE_NUEVA" | "OMITIDO";
type Fila = { documento: string; nombre: string; correo: string; tipo: Tipo; motivo: string; estado?: string };

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=").slice(1).join("=");
const bandera = (n: string) => process.argv.includes(`--${n}`);
const CORREO_VALIDO = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
/** 10 caracteres sin los que se confunden al leerlos (0/O, 1/l/I), como las del archivo de credenciales. */
const ALFABETO = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const claveTemporal = () => Array.from({ length: 10 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const archivo = arg("archivo");
  if (!archivo || !existsSync(archivo)) throw new Error("Falta --archivo=RUTA.json (o no existe).");
  const enviar = bandera("enviar");
  const prueba = arg("prueba");
  const limite = Number(arg("limite") ?? Infinity);
  const pausa = Number(arg("pausa") ?? 15000);
  const conSoloAcceso = !bandera("sin-solo-acceso");
  const regenerar = bandera("regenerar-desconocidas");
  const registro = join(dirname(archivo), "registro.jsonl");

  if ((enviar || prueba) && !correoConfigurado()) throw new Error("SMTP sin configurar (SMTP_HOST, SMTP_USER, SMTP_PASSWORD en .env). No se envía nada.");

  if (prueba) {
    const { asunto, texto, html } = plantillaCredenciales({ nombre: "Funcionario de Prueba", usuario: "funcionario.prueba@correo.com", clave: "Ejemplo1234" });
    const ok = await enviarCorreo({ para: prueba, asunto: `[MUESTRA] ${asunto}`, texto, html });
    console.log(ok ? `Muestra enviada a ${prueba}.` : `No se pudo enviar la muestra a ${prueba} (ver error arriba).`);
    return;
  }

  const entradas: Entrada[] = JSON.parse(readFileSync(archivo, "utf8"));
  const yaEnviados = new Set<string>();
  if (existsSync(registro)) {
    for (const l of readFileSync(registro, "utf8").split("\n")) {
      if (!l.trim()) continue;
      const r = JSON.parse(l);
      if (r.estado === "ENVIADO") yaEnviados.add(r.documento);
    }
  }

  const usuarios = await prisma.user.findMany({
    where: { documentNumber: { in: entradas.map((e) => e.documento) } },
    select: { id: true, documentNumber: true, fullName: true, email: true, username: true, role: true, status: true, tipoVinculacion: true, passwordHash: true, lastLoginAt: true },
  });
  const porDoc = new Map(usuarios.map((u) => [u.documentNumber, u]));

  const filas: (Fila & { clave: string | null; userId?: string })[] = [];
  for (const e of entradas) {
    const u = porDoc.get(e.documento);
    const base = { documento: e.documento, nombre: u ? nombrePropio(u.fullName) : "", correo: u?.email ?? "", clave: null };
    const omitir = (motivo: string) => filas.push({ ...base, tipo: "OMITIDO", motivo });
    if (!u) { omitir("No existe en la plataforma"); continue; }
    if (u.role === "ADMIN") { omitir("Es administrador"); continue; }
    if (u.tipoVinculacion === "CONTRATO_PRESTACION") { omitir("No es de planta (contratista)"); continue; }
    if (u.status !== "ACTIVE") { omitir(`Cuenta ${u.status === "BLOCKED" ? "bloqueada" : "inactiva"}`); continue; }
    if (!u.email || u.email.includes(".sin-correo@") || !CORREO_VALIDO.test(u.email)) {
      omitir(`Sin correo real${u.username ? ` (entra con el usuario ${u.username})` : ""}: entregar a mano`);
      continue;
    }
    const vigente = await bcrypt.compare(e.clave, u.passwordHash);
    if (vigente) filas.push({ ...base, clave: e.clave, tipo: "CREDENCIALES", motivo: "La clave del archivo sigue vigente" });
    else if (!u.lastLoginAt)
      filas.push(
        regenerar
          ? { ...base, userId: u.id, tipo: "CLAVE_NUEVA", motivo: "Nunca ingresó y la clave del archivo ya no es la suya: se le asigna una temporal nueva" }
          : { ...base, tipo: "OMITIDO", motivo: "Nunca ingresó y la clave del archivo ya no es la suya (usar --regenerar-desconocidas)" }
      );
    else if (conSoloAcceso) filas.push({ ...base, tipo: "SOLO_ACCESO", motivo: "Ya ingresó y cambió su clave: se le envía el usuario y cómo recuperarla" });
    else filas.push({ ...base, tipo: "OMITIDO", motivo: "Ya cambió su clave" });
  }

  const cuenta = (t: Tipo) => filas.filter((f) => f.tipo === t).length;
  console.log(`\nEntradas: ${entradas.length} · CREDENCIALES: ${cuenta("CREDENCIALES")} · CLAVE_NUEVA: ${cuenta("CLAVE_NUEVA")} · SOLO_ACCESO: ${cuenta("SOLO_ACCESO")} · OMITIDOS: ${cuenta("OMITIDO")} · ya enviados antes: ${yaEnviados.size}`);
  for (const f of filas.filter((f) => f.tipo === "OMITIDO")) console.log(`  OMITIDO  ${f.documento}  ${f.nombre}  · ${f.motivo}`);

  const pendientes = filas.filter((f) => f.tipo !== "OMITIDO" && !yaEnviados.has(f.documento));
  if (!enviar) {
    console.log(`\nSIMULACIÓN: se enviarían ${pendientes.length} correos (pausa ${pausa / 1000}s → ~${Math.ceil((pendientes.length * pausa) / 60000)} min). Nada se envió.`);
  } else {
    let n = 0;
    for (const f of pendientes) {
      if (n >= limite) break;
      if (f.tipo === "CLAVE_NUEVA" && f.userId) {
        // Sin cambio forzado, como el resto del lote (decisión de Talento Humano).
        f.clave = claveTemporal();
        await prisma.user.update({ where: { id: f.userId }, data: { passwordHash: await bcrypt.hash(f.clave, 10), mustChangePassword: false } });
      }
      const { asunto, texto, html } = plantillaCredenciales({ nombre: f.nombre, usuario: f.correo, clave: f.clave });
      const ok = await enviarCorreo({ para: f.correo, asunto, texto, html });
      f.estado = ok ? "ENVIADO" : "FALLÓ";
      appendFileSync(registro, JSON.stringify({ documento: f.documento, nombre: f.nombre, correo: f.correo, tipo: f.tipo, estado: f.estado, fecha: new Date().toISOString() }) + "\n");
      n++;
      console.log(`[${n}/${Math.min(pendientes.length, limite)}] ${f.estado}  ${f.correo}  (${f.tipo})`);
      // Gmail corta por cupo diario: seguir solo acumula rechazos. Se para y se retoma otro día (no repite a nadie).
      if (!ok) {
        console.log("\nEl servidor de correo rechazó el envío (probable cupo diario). Se detiene; retomar más tarde con el mismo comando.");
        break;
      }
      await esperar(pausa);
    }
  }

  for (const f of filas) if (!f.estado) f.estado = yaEnviados.has(f.documento) ? "ENVIADO (antes)" : f.tipo === "OMITIDO" ? "NO SE ENVÍA" : enviar ? "PENDIENTE" : "SIMULADO";
  writeFileSync(
    join(dirname(archivo), "informe.json"),
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    JSON.stringify(filas.map(({ clave: _c, userId: _u, ...resto }) => resto), null, 1)
  );
  console.log(`\nInforme: ${join(dirname(archivo), "informe.json")}`);
}

main().finally(() => prisma.$disconnect());
