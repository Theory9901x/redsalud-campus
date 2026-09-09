import { randomInt } from "node:crypto";
import { writeFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

/**
 * PROVISIÓN DE CONTRATISTAS (lote de septiembre de 2026).
 *
 * Contrasta cada persona contra el padrón por documento y por correo:
 *  - Si ya existe (personal de planta o cuenta previa) NO se toca: se
 *    reporta con su correo actual, sin contraseña.
 *  - Si no existe, se crea como estudiante contratista con contraseña
 *    temporal legible, y queda en el informe.
 *
 * Genera un Markdown con el resultado (lo que se entrega a Talento Humano).
 * Uso: npx tsx --env-file=.env scripts/provisionar-contratistas.ts [--dry]
 */
type Fila = { zona: string; nombre: string; documento: string; correo: string };

const LOTE: Fila[] = [
  { zona: "Zona Norte", nombre: "MARIO CRUZ ACOSTA", documento: "4214841", correo: "ipspore@gmail.com" },
  { zona: "Zona Norte", nombre: "ANGELA ASTRID VARGAS ESTEPA", documento: "23324442", correo: "valeryzaray923@gmail.com" },
  { zona: "Zona Norte", nombre: "ALFREDO CORREDOR ROBAYO", documento: "74085479", correo: "alfredcorredorrobayo@gmail.com" },
  { zona: "Zona Norte", nombre: "MERCEDES REYES", documento: "23790182", correo: "mercedesreyes.h@hotmail.com" },
  { zona: "Zona Norte", nombre: "LIDIA CARLINA LEMUS", documento: "1057571030", correo: "lidialigu@hotmail.com" },
  { zona: "Zona Norte", nombre: "CARLOS HUMBERTO MORENO", documento: "696520", correo: "clichemoreno81@hotmail.com" },
  { zona: "Zona Norte", nombre: "JOHANA GLORIA OLMOS HERNANDEZ", documento: "1115850537", correo: "gloolmosh01-@hotmail.com" },
  { zona: "Zona Norte", nombre: "MONICA ALEXANDRA BERMUDEZ JARA", documento: "1118648174", correo: "bermudezmonica2010@hotmail.com" },
  { zona: "Zona Centro", nombre: "ELVIA PATRICIA HERNANDEZ BETANCOURT", documento: "24191765", correo: "patty-1383@hotmail.com" },
  { zona: "Zona Centro", nombre: "ANTONIO OLIVARES ACOSTA", documento: "74849040", correo: "acostacolacho@hotmail.com" },
  { zona: "Zona Centro", nombre: "MARIA ROSARIO HERNANDEZ MONGUI", documento: "23827370", correo: "odontologianunchia@gmail.com" },
  { zona: "Zona Centro", nombre: "NEIDY GISELLA RODRIGUEZ VALBUENA", documento: "52914309", correo: "gisellarodriguez@hotmail.com" },
  { zona: "Zona Centro", nombre: "HOMERO CAMACHO VALCARCEL", documento: "7361625", correo: "homero.22camacho25@gmail.com" },
  { zona: "Zona Centro", nombre: "CASILDA BETANCOURT FUENTES", documento: "23827642", correo: "casilbetancourt1@hotmail.com" },
  { zona: "Zona Centro", nombre: "OLGA MAGNOLIA SANCHEZ RIAÑO", documento: "53103562", correo: "omsr1@hotmail.com" },
  { zona: "Zona Centro", nombre: "IBET MARTA GOMEZ SARMIENTO", documento: "24144038", correo: "mgomezsarmiento@yahoo.es" },
  { zona: "Zona Sur", nombre: "SONIA MILENA CRISTANCHO BARAJAS", documento: "46673037", correo: "smile.cristancho07@gmail.com" },
  { zona: "Zona Sur", nombre: "NIXON FAUNER ROA AGUIRRE", documento: "74810233", correo: "nixonroaguirre@hotmail.com" },
  { zona: "Zona Sur", nombre: "ADRIANA MARCELA ROMERO VARGAS", documento: "1116992238", correo: "adrianamarcelaromerovargas@gmail.com" },
  { zona: "Zona Sur", nombre: "DIXI MILENA NEIRA PULIDO", documento: "33645826", correo: "milenapulido28@hotmail.com" },
  { zona: "Zona Sur", nombre: "MARIA DEL MAR CASTILLO RUEDA", documento: "1143241300", correo: "mariadelmar.castillo10@hotmail.com" },
  { zona: "Zona Sur", nombre: "EDGAR ENRIQUE SIACHOQUE MONTAÑO", documento: "79865331", correo: "enrique.siachoque88@gmail.com" },
  { zona: "Sin zona en el listado", nombre: "JHON EVERTH ACOSTA HUERTAS", documento: "80047300", correo: "johnacosta_16@hotmail.com" },
  { zona: "Administrativa", nombre: "ANTENOR TORRES ARIZA", documento: "91011608", correo: "antenor01@yahoo.com" },
  { zona: "Administrativa", nombre: "ANA MARIA GONZALEZ CHAPARRO", documento: "33645529", correo: "anamariasaludpublica@gmail.com" },
  { zona: "Administrativa", nombre: "SANDRA MILENA GALINDO FERNANDEZ", documento: "40215232", correo: "contabilidad2013.sg@gmail.com" },
  { zona: "Administrativa", nombre: "PAULA ANDREA PULGARIN TARACHE", documento: "33481157", correo: "pulgarina2@hotmail.com" },
  { zona: "Administrativa", nombre: "WILMAR HERNANDO PEREZ SAENZ", documento: "74814418", correo: "wipesa80@hotmail.com" },
  { zona: "Administrativa", nombre: "LEIDY TATIANA LEAL MERCHAN", documento: "1121929515", correo: "leydileal.95@gmail.com" },
  { zona: "Administrativa", nombre: "YEIMY TATIANA MERCHAN", documento: "1052386319", correo: "yeita04@gmail.com" },
  { zona: "Administrativa", nombre: "ALEJANDRA DEL PILAR CASTELLANOS CANO", documento: "1121859003", correo: "alecas1207@gmail.com" },
];

/** Contraseña temporal legible: RedSalud + 4 dígitos + símbolo. Cumple el mínimo de 8. */
function contrasena() {
  return `RedSalud${randomInt(1000, 9999)}*`;
}

function nombrePropio(s: string) {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((p) => (p.length > 2 || ["de", "del"].includes(p) === false ? p.charAt(0).toUpperCase() + p.slice(1) : p))
    .join(" ")
    .replace(/\bDe\b/g, "de")
    .replace(/\bDel\b/g, "del");
}

async function main() {
  const dry = process.argv.includes("--dry");
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });

  type Resultado = Fila & { estado: "YA EXISTÍA" | "CREADO" | "CONFLICTO"; usuario: string; clave: string; nota: string };
  const resultados: Resultado[] = [];

  for (const f of LOTE) {
    const correo = f.correo.trim().toLowerCase();
    const porDocumento = await prisma.user.findUnique({
      where: { documentNumber: f.documento },
      select: { id: true, email: true, username: true, fullName: true, tipoVinculacion: true },
    });
    const porCorreo = await prisma.user.findUnique({ where: { email: correo }, select: { id: true, documentNumber: true, fullName: true } });

    if (porDocumento) {
      resultados.push({
        ...f,
        estado: "YA EXISTÍA",
        usuario: porDocumento.email ?? porDocumento.username ?? "—",
        clave: "(la que ya tiene)",
        nota: `Registrado como ${porDocumento.fullName} · ${porDocumento.tipoVinculacion}`,
      });
      continue;
    }
    if (porCorreo) {
      resultados.push({
        ...f,
        estado: "CONFLICTO",
        usuario: correo,
        clave: "—",
        nota: `El correo ya pertenece a ${porCorreo.fullName} (doc. ${porCorreo.documentNumber}); no se creó`,
      });
      continue;
    }

    const clave = contrasena();
    if (!dry) {
      await prisma.user.create({
        data: {
          fullName: nombrePropio(f.nombre),
          documentType: "CC",
          documentNumber: f.documento,
          email: correo,
          department: f.zona,
          personnelType: f.zona === "Administrativa" ? "ADMINISTRATIVO" : "ASISTENCIAL",
          tipoVinculacion: "CONTRATO_PRESTACION",
          origenRegistro: "IMPORTACION",
          provisionedAt: new Date(),
          provisionedBy: admin?.id ?? null,
          role: "STUDENT",
          status: "ACTIVE",
          // Sin cambio forzado: la contraseña se entrega en mano y muchos no
          // están familiarizados con la plataforma (decisión de Talento Humano).
          mustChangePassword: false,
          passwordHash: await bcrypt.hash(clave, 10),
        },
      });
    }
    resultados.push({ ...f, estado: "CREADO", usuario: correo, clave, nota: dry ? "(simulación)" : "Contratista · estudiante" });
  }

  const creados = resultados.filter((r) => r.estado === "CREADO").length;
  const previos = resultados.filter((r) => r.estado === "YA EXISTÍA").length;
  const conflictos = resultados.filter((r) => r.estado === "CONFLICTO").length;
  const fecha = new Date().toLocaleDateString("es-CO", { timeZone: "America/Bogota", dateStyle: "long" });

  const lineas: string[] = [];
  lineas.push(`# Usuarios de contratistas · RedSalud Te Forma`);
  lineas.push(``);
  lineas.push(`Generado el ${fecha}. Lote de ${LOTE.length} personas: **${creados} creados**, **${previos} ya existían** en el sistema (no se modificaron), ${conflictos} conflictos.`);
  lineas.push(``);
  lineas.push(`Acceso: https://campusvirtual.redsaludteforma.com/login · Usuario = correo · Vinculación: contrato de prestación de servicios · Rol: estudiante.`);
  lineas.push(``);
  const zonas = [...new Set(LOTE.map((f) => f.zona))];
  for (const z of zonas) {
    lineas.push(`## ${z}`);
    lineas.push(``);
    lineas.push(`| # | Nombre | Documento | Correo / usuario | Contraseña | Estado | Nota |`);
    lineas.push(`|---|---|---|---|---|---|---|`);
    resultados
      .filter((r) => r.zona === z)
      .forEach((r, i) => {
        lineas.push(`| ${i + 1} | ${r.nombre} | ${r.documento} | ${r.usuario} | \`${r.clave}\` | ${r.estado} | ${r.nota} |`);
      });
    lineas.push(``);
  }
  lineas.push(`> Las contraseñas son temporales y de entrega en mano. Quien ya existía conserva su contraseña actual; si no la recuerda, se restablece desde Usuarios.`);

  const salida = dry ? "contratistas-simulacion.md" : "contratistas-usuarios.md";
  writeFileSync(salida, lineas.join("\n"), "utf8");
  console.log(`${dry ? "SIMULACIÓN" : "LISTO"} · creados ${creados} · ya existían ${previos} · conflictos ${conflictos} · ${salida}`);
  for (const r of resultados.filter((r) => r.estado !== "CREADO")) console.log(` - ${r.estado}: ${r.nombre} · ${r.nota}`);
}

main().finally(() => prisma.$disconnect());
