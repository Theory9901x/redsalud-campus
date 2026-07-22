/**
 * Importador del plan de cargos (Fase 7.2).
 *
 *   npx tsx --env-file=.env prisma/import-plan-cargos.ts <ruta.xlsx> [--commit]
 *
 * Sin --commit corre en DRY-RUN: reporta altas, actualizaciones y filas con
 * problema SIN escribir nada. Es idempotente por documento: re-ejecutarlo
 * actualiza en vez de duplicar.
 *
 * Reglas acordadas con Talento Humano:
 *  - El grupo poblacional sale de la columna NIVEL tal como viene en el
 *    archivo (ASIS = asistencial, el resto administrativo). No se infiere del
 *    nombre del cargo.
 *  - La modalidad sale de TIPO NOM según la leyenda del propio archivo.
 *  - Todo el que está en el plan de cargos es personal de planta.
 *  - Si un correo viene repetido, el segundo usa un usuario nombre.apellido.
 */
import { readFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";
import { PrismaClient, type PersonnelType, type TipoVinculacion } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const DOMINIO_INSTITUCIONAL = "redsaludcasanare.gov.co";

// Índices de columna del archivo (fila 1 = encabezados, datos desde la 2).
const COL = {
  nivel: 0,
  tipoNom: 1,
  fechaIngreso: 4,
  documento: 7,
  apellido1: 8,
  apellido2: 9,
  nombre1: 10,
  nombre2: 11,
  municipio: 12,
  celular: 13,
  cargo: 14,
  correo: 15,
} as const;

const VINCULACION_POR_CODIGO: Record<string, TipoVinculacion> = {
  KA: "CARRERA_ADMINISTRATIVA",
  PRO: "PROVISIONALIDAD",
  TEM: "TEMPORAL",
  "T.O": "TRABAJADOR_OFICIAL",
  LNR: "LIBRE_NOMBRAMIENTO",
  "P.F": "PERIODO_FIJO",
};

const clean = (v: unknown) => (v === null || v === undefined ? "" : String(v).trim());
/** Quita tildes y normaliza para comparar municipios ("NUNCHIA" ≈ "Nunchía"). */
const norm = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

/** Contraseña legible: sin caracteres ambiguos (l/1/O/0/I). */
function generarPassword(longitud = 10) {
  const alfabeto = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < longitud; i++) out += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  return out;
}

/** Usuario derivado de nombre.apellido, sin tildes ni espacios. */
function usuarioDesdeNombre(nombre: string, apellido: string) {
  const parte = (v: string) =>
    v
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z]/g, "");
  return `${parte(nombre)}.${parte(apellido)}`;
}

type FilaProcesada = {
  fila: number;
  documento: string;
  fullName: string;
  email: string;
  username: string | null;
  telefono: string | null;
  cargoNombre: string;
  municipioNombre: string;
  personnelType: PersonnelType;
  tipoVinculacion: TipoVinculacion;
  fechaIngreso: Date | null;
};

async function main() {
  const rutaArchivo = process.argv[2];
  const commit = process.argv.includes("--commit");
  if (!rutaArchivo) {
    console.error("Uso: tsx prisma/import-plan-cargos.ts <ruta.xlsx> [--commit]");
    process.exit(1);
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

  const wb = XLSX.read(readFileSync(rutaArchivo));
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], {
    header: 1,
    defval: null,
    raw: false,
  });

  const municipios = await prisma.municipio.findMany();
  const municipioPorNombre = new Map(municipios.map((m) => [norm(m.nombre), m]));
  // El archivo escribe algunos municipios sin el artículo; se mapean al
  // nombre oficial en vez de rechazar la fila.
  const ALIAS: Record<string, string> = { SALINA: "LA SALINA" };
  for (const [alias, oficial] of Object.entries(ALIAS)) {
    const m = municipioPorNombre.get(oficial);
    if (m) municipioPorNombre.set(alias, m);
  }

  const procesadas: FilaProcesada[] = [];
  const errores: { fila: number; documento: string; motivo: string }[] = [];
  const correosVistos = new Map<string, string>(); // correo -> documento
  const usuariosVistos = new Set<string>();

  for (let i = 2; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const documento = clean(r[COL.documento]).replace(/[.,\s]/g, "");
    // Solo filas de personas: la leyenda del final del archivo no tiene documento.
    if (!/^\d{5,}$/.test(documento)) continue;

    const filaNum = i + 1;
    const apellidos = [clean(r[COL.apellido1]), clean(r[COL.apellido2])].filter(Boolean).join(" ");
    const nombres = [clean(r[COL.nombre1]), clean(r[COL.nombre2])].filter(Boolean).join(" ");
    const fullName = `${nombres} ${apellidos}`.replace(/\s+/g, " ").trim();

    const cargoNombre = clean(r[COL.cargo]).toUpperCase();
    const municipioNombre = clean(r[COL.municipio]);
    const nivel = clean(r[COL.nivel]).toUpperCase();
    const codigoTipo = clean(r[COL.tipoNom]).toUpperCase();

    if (!fullName) {
      errores.push({ fila: filaNum, documento, motivo: "Sin nombre ni apellidos" });
      continue;
    }
    if (!cargoNombre) {
      errores.push({ fila: filaNum, documento, motivo: "Sin cargo" });
      continue;
    }
    if (!municipioPorNombre.has(norm(municipioNombre))) {
      errores.push({ fila: filaNum, documento, motivo: `Municipio no reconocido: "${municipioNombre}"` });
      continue;
    }
    const tipoVinculacion = VINCULACION_POR_CODIGO[codigoTipo];
    if (!tipoVinculacion) {
      errores.push({ fila: filaNum, documento, motivo: `TIPO NOM no reconocido: "${codigoTipo}"` });
      continue;
    }

    // Grupo poblacional según la columna NIVEL del archivo, sin interpretar el cargo.
    const personnelType: PersonnelType = nivel === "ASIS" ? "ASISTENCIAL" : "ADMINISTRATIVO";

    // Correo: se toma el primero si la celda trae varios separados por ; o espacios.
    let email = clean(r[COL.correo]).split(/[;,\s]+/).filter(Boolean)[0]?.toLowerCase() ?? "";
    let username: string | null = null;
    const valido = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email);
    if (!valido || correosVistos.has(email)) {
      // Sin correo usable o repetido: el acceso es un usuario nombre.apellido
      // (sin @). El correo se deja con un valor único e inutilizable para no
      // chocar con la restricción unique ni parecer un correo real.
      const base = usuarioDesdeNombre(clean(r[COL.nombre1]), clean(r[COL.apellido1]));
      username = base;
      let n = 2;
      while (usuariosVistos.has(username)) username = `${base}${n++}`;
      usuariosVistos.add(username);
      email = `${username}.sin-correo@${DOMINIO_INSTITUCIONAL}`;
    }
    correosVistos.set(email, documento);

    const fechaTexto = clean(r[COL.fechaIngreso]);
    const fecha = fechaTexto ? new Date(fechaTexto) : null;

    procesadas.push({
      fila: filaNum,
      documento,
      fullName,
      email,
      username,
      telefono: clean(r[COL.celular]) || null,
      cargoNombre,
      municipioNombre,
      personnelType,
      tipoVinculacion,
      fechaIngreso: fecha && !Number.isNaN(fecha.getTime()) ? fecha : null,
    });
  }

  // ---- Reporte ----
  const existentes = await prisma.user.findMany({
    where: { documentNumber: { in: procesadas.map((p) => p.documento) } },
    select: { documentNumber: true },
  });
  const yaExisten = new Set(existentes.map((e) => e.documentNumber));
  const altas = procesadas.filter((p) => !yaExisten.has(p.documento));
  const actualizaciones = procesadas.filter((p) => yaExisten.has(p.documento));

  const cargosUnicos = new Map<string, PersonnelType>();
  for (const p of procesadas) if (!cargosUnicos.has(p.cargoNombre)) cargosUnicos.set(p.cargoNombre, p.personnelType);

  console.log(`\n${commit ? "=== IMPORTACIÓN REAL ===" : "=== DRY-RUN (no se escribe nada) ==="}`);
  console.log(`Filas de personas procesadas: ${procesadas.length}`);
  console.log(`  altas nuevas:      ${altas.length}`);
  console.log(`  actualizaciones:   ${actualizaciones.length}`);
  console.log(`  filas con error:   ${errores.length}`);
  console.log(`  usuarios asignados: ${procesadas.filter((p) => p.username).length}`);
  console.log(`\nGrupo poblacional (según columna NIVEL):`);
  console.log(`  ASISTENCIAL:    ${procesadas.filter((p) => p.personnelType === "ASISTENCIAL").length}`);
  console.log(`  ADMINISTRATIVO: ${procesadas.filter((p) => p.personnelType === "ADMINISTRATIVO").length}`);
  console.log(`\nModalidad de vinculación:`);
  for (const [tipo, n] of Object.entries(
    procesadas.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.tipoVinculacion]: (acc[p.tipoVinculacion] ?? 0) + 1 }), {})
  )) console.log(`  ${tipo}: ${n}`);
  console.log(`\nCargos distintos a sembrar: ${cargosUnicos.size}`);

  if (procesadas.some((p) => p.username)) {
    console.log(`\nEntran con USUARIO en vez de correo (su correo no era usable o estaba repetido):`);
    procesadas
      .filter((p) => p.username)
      .forEach((p) => console.log(`  fila ${p.fila}: ${p.fullName} -> usuario "${p.username}"`));
  }
  if (errores.length > 0) {
    console.log(`\nFilas con error (no se importan):`);
    errores.forEach((e) => console.log(`  fila ${e.fila} doc ${e.documento || "—"}: ${e.motivo}`));
  }

  if (!commit) {
    console.log(`\nNada fue escrito. Repite con --commit para aplicar.`);
    await prisma.$disconnect();
    return;
  }

  // ---- Escritura ----
  for (const [nombre, personnelType] of cargosUnicos) {
    await prisma.cargo.upsert({ where: { nombre }, update: {}, create: { nombre, personnelType } });
  }
  const cargos = await prisma.cargo.findMany();
  const cargoPorNombre = new Map(cargos.map((c) => [c.nombre, c]));

  const credenciales: string[] = ["documento,nombre,cargo,municipio,grupo,usuario_o_correo,contrasena_temporal"];
  let creados = 0;
  let actualizados = 0;

  for (const p of procesadas) {
    const municipio = municipioPorNombre.get(norm(p.municipioNombre))!;
    const cargo = cargoPorNombre.get(p.cargoNombre)!;
    const datosComunes = {
      fullName: p.fullName,
      email: p.email,
      username: p.username,
      phone: p.telefono,
      position: p.cargoNombre,
      personnelType: p.personnelType,
      municipioId: municipio.id,
      cargoId: cargo.id,
      tipoVinculacion: p.tipoVinculacion,
      origenRegistro: "IMPORTACION" as const,
      provisionedAt: new Date(),
    };

    if (yaExisten.has(p.documento)) {
      // Idempotente: actualiza los datos del plan de cargos, NO toca la
      // contraseña de alguien que ya pudo haber ingresado y cambiado la suya.
      await prisma.user.update({ where: { documentNumber: p.documento }, data: datosComunes });
      actualizados++;
      continue;
    }

    const passwordTemporal = generarPassword();
    await prisma.user.create({
      data: {
        ...datosComunes,
        documentType: "CC",
        documentNumber: p.documento,
        passwordHash: await bcrypt.hash(passwordTemporal, 10),
        role: "STUDENT",
        status: "ACTIVE",
        mustChangePassword: true,
      },
    });
    creados++;
    const csv = (v: string) => `"${v.replace(/"/g, '""')}"`;
    credenciales.push(
      [p.documento, p.fullName, p.cargoNombre, p.municipioNombre, p.personnelType, p.username ?? p.email, passwordTemporal]
        .map((v) => csv(String(v)))
        .join(",")
    );
  }

  const { writeFileSync } = await import("node:fs");
  const salida = `credenciales-${new Date().toISOString().slice(0, 10)}.csv`;
  writeFileSync(salida, credenciales.join("\n"), "utf8");

  console.log(`\nCreados: ${creados} | Actualizados: ${actualizados}`);
  console.log(`Paquete de credenciales: ${salida}`);
  console.log(`ATENCIÓN: solo se guarda el hash. Este archivo es la ÚNICA copia`);
  console.log(`de las contraseñas en claro; guárdalo y repártelo antes de borrarlo.`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
