import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import sharp from "sharp";
import type { Role, UserStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { publicUploadDiskPath } from "@/lib/storage";
import { PERSONNEL_TYPE_LABELS } from "@/lib/personnel-labels";
import { VINCULACION_LABELS, esPlanta } from "@/components/admin/marca-planta";
import { BLANCO, LINEA, NAVY, ZEBRA, horaColombia, nuevoLibro, relleno } from "@/lib/excel-tabla";

/**
 * EXCEL del directorio completo de usuarios (todos menos los ADMIN), para
 * Talento Humano. Cuatro hojas:
 *
 *   1. Resumen   · portada con membrete, cifras clave y distribución por
 *                  rol, estado, municipio, vinculación y tipo de personal.
 *   2. Usuarios  · una fila por persona con TODOS sus datos.
 *   3. Accesos   · lo que se necesita para ayudarle a alguien a entrar: con
 *                  qué ingresa (correo o usuario), el estado de su contraseña
 *                  y su último ingreso. Primero los que no pueden entrar.
 *   4. Información
 *
 * Las contraseñas NO salen: se guardan cifradas (bcrypt) y no hay forma de
 * leerlas. La hoja de Accesos dice en qué estado está cada una; para entregar
 * una clave se restablece desde la ficha del usuario.
 */

const AZUL = "FF1FA3DB";
const AZUL_SUAVE = "FFE6F4FB";
const VERDE = "FF1F9D5A";
const VERDE_SUAVE = "FFE5F5EC";
const AMBAR = "FFB7791F";
const AMBAR_SUAVE = "FFFDF3E1";
const ROJO = "FFC0392B";
const ROJO_SUAVE = "FFFBE9E7";
const GRIS = "FF6B7C8F";
const GRIS_SUAVE = "FFEEF1F5";
const NAVY_2 = "FF183A57";

const ROL: Record<Role, string> = { ADMIN: "Administrador", TUTOR: "Tutor", STUDENT: "Estudiante", SEGUIMIENTO: "Seguimiento" };
const ESTADO: Record<UserStatus, string> = { ACTIVE: "Activo", INACTIVE: "Inactivo", BLOCKED: "Bloqueado" };
const TIPO_DOC: Record<string, string> = { CC: "CC", CE: "CE", TI: "TI", PA: "Pasaporte" };

type Tono = { texto: string; fondo: string };
const TONO_ESTADO: Record<UserStatus, Tono> = {
  ACTIVE: { texto: VERDE, fondo: VERDE_SUAVE },
  INACTIVE: { texto: GRIS, fondo: GRIS_SUAVE },
  BLOCKED: { texto: ROJO, fondo: ROJO_SUAVE },
};

/** Estado de la contraseña, deducido de mustChangePassword y lastLoginAt (la clave en sí no se puede leer). */
function estadoClave(u: { mustChangePassword: boolean; lastLoginAt: Date | null; tieneAcceso: boolean }): { texto: string; tono: Tono; orden: number } {
  if (!u.tieneAcceso) return { texto: "Sin acceso (no tiene correo ni usuario)", tono: { texto: ROJO, fondo: ROJO_SUAVE }, orden: 0 };
  if (u.mustChangePassword && !u.lastLoginAt)
    return { texto: "Temporal · nunca ha ingresado", tono: { texto: AMBAR, fondo: AMBAR_SUAVE }, orden: 1 };
  if (u.mustChangePassword) return { texto: "Temporal · pendiente de cambiarla", tono: { texto: AMBAR, fondo: AMBAR_SUAVE }, orden: 2 };
  if (!u.lastLoginAt) return { texto: "Asignada · nunca ha ingresado", tono: { texto: AZUL, fondo: AZUL_SUAVE }, orden: 3 };
  return { texto: "En uso · ya ingresó", tono: { texto: VERDE, fondo: VERDE_SUAVE }, orden: 4 };
}

const FECHA = "dd/mm/yyyy";
const FECHA_HORA = "dd/mm/yyyy hh:mm AM/PM";

type Columna = { titulo: string; ancho: number; formato?: string; centro?: boolean; mono?: boolean };

/**
 * Tabla con membrete: banda navy con título y subtítulo (filas 1-2), una fila
 * de respiro, encabezados en la fila 4, cebra, bordes finos, autofiltro y
 * paneles fijos (encabezado + primera columna de datos).
 */
function hojaConMembrete(
  wb: ExcelJS.Workbook,
  nombre: string,
  titulo: string,
  subtitulo: string,
  columnas: Columna[],
  filas: (string | number | Date | null)[][],
  colorPestana: string,
  fijarColumnas = 2
) {
  const hoja = wb.addWorksheet(nombre, {
    properties: { tabColor: { argb: colorPestana } },
    views: [{ state: "frozen", ySplit: 4, xSplit: fijarColumnas, showGridLines: false }],
  });
  columnas.forEach((c, i) => {
    hoja.getColumn(i + 1).width = c.ancho;
  });
  const ultima = columnas.length;

  // Membrete
  hoja.mergeCells(1, 1, 1, ultima);
  hoja.mergeCells(2, 1, 2, ultima);
  const t = hoja.getCell(1, 1);
  t.value = titulo;
  t.font = { bold: true, size: 16, color: { argb: BLANCO } };
  t.alignment = { vertical: "middle", indent: 1 };
  const s = hoja.getCell(2, 1);
  s.value = subtitulo;
  s.font = { size: 10, color: { argb: "FFB9CCDD" } };
  s.alignment = { vertical: "top", indent: 1 };
  for (let c = 1; c <= ultima; c++) {
    hoja.getCell(1, c).fill = relleno(NAVY);
    hoja.getCell(2, c).fill = relleno(NAVY);
    hoja.getCell(3, c).fill = relleno(AZUL);
  }
  hoja.getRow(1).height = 32;
  hoja.getRow(2).height = 20;
  hoja.getRow(3).height = 4;

  // Encabezados
  const cab = hoja.getRow(4);
  cab.height = 32;
  columnas.forEach((c, i) => {
    const celda = cab.getCell(i + 1);
    celda.value = c.titulo;
    celda.font = { bold: true, size: 10, color: { argb: BLANCO } };
    celda.fill = relleno(NAVY_2);
    celda.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    celda.border = { right: { style: "thin", color: { argb: NAVY } } };
  });

  // Datos
  filas.forEach((f, idx) => {
    const fila = hoja.getRow(5 + idx);
    fila.height = 20;
    f.forEach((v, i) => {
      const celda = fila.getCell(i + 1);
      const col = columnas[i];
      celda.value = v === null || v === "" ? (col.formato ? null : "—") : v;
      celda.font = { size: 10, color: { argb: v === null || v === "" ? "FFA0AEBC" : "FF1D2B3A" }, name: col.mono ? "Consolas" : undefined };
      celda.alignment = { vertical: "middle", horizontal: col.centro ? "center" : "left", indent: col.centro ? 0 : 1 };
      if (col.formato) celda.numFmt = col.formato;
      if (idx % 2 === 1) celda.fill = relleno(ZEBRA);
      celda.border = { bottom: { style: "thin", color: { argb: LINEA } } };
    });
  });

  if (filas.length) hoja.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + filas.length, column: ultima } };
  hoja.pageSetup = {
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    paperSize: 9,
    printTitlesRow: "4:4",
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };
  hoja.headerFooter.oddFooter = `&L&8RedSalud Te Forma · ${nombre}&R&8Página &P de &N`;
  return hoja;
}

/** Pinta una celda como «píldora»: texto en negrilla del color del tono sobre su fondo suave. */
function pildora(celda: ExcelJS.Cell, tono: Tono) {
  celda.font = { size: 10, bold: true, color: { argb: tono.texto } };
  celda.fill = relleno(tono.fondo);
  celda.alignment = { vertical: "middle", horizontal: "center" };
}

export async function generarExcelUsuarios(generadoPor: string) {
  const [usuarios, ajustes] = await Promise.all([
    prisma.user.findMany({
      where: { role: { not: "ADMIN" } },
      orderBy: { fullName: "asc" },
      select: {
        fullName: true,
        documentType: true,
        documentNumber: true,
        email: true,
        username: true,
        phone: true,
        profession: true,
        position: true,
        department: true,
        personnelType: true,
        tipoVinculacion: true,
        origenRegistro: true,
        role: true,
        status: true,
        mustChangePassword: true,
        lastLoginAt: true,
        createdAt: true,
        municipio: { select: { nombre: true } },
        cargo: { select: { nombre: true } },
      },
    }),
    prisma.institutionSettings.findUnique({ where: { id: "singleton" }, select: { logoUrl: true } }),
  ]);

  const personas = usuarios.map((u) => {
    const tieneAcceso = Boolean(u.email || u.username);
    return {
      ...u,
      tieneAcceso,
      ingresaCon: u.email ?? u.username ?? "",
      clave: estadoClave({ mustChangePassword: u.mustChangePassword, lastLoginAt: u.lastLoginAt, tieneAcceso }),
      cargoTexto: u.cargo?.nombre ?? u.position ?? "",
    };
  });

  const wb = nuevoLibro();
  wb.title = "Directorio de usuarios";

  // ── 1. Resumen ────────────────────────────────────────────────────────
  const total = personas.length;
  const activos = personas.filter((p) => p.status === "ACTIVE").length;
  const planta = personas.filter((p) => esPlanta(p.tipoVinculacion)).length;
  const contratistas = total - planta;
  const yaIngresaron = personas.filter((p) => p.lastLoginAt).length;
  const sinAcceso = personas.filter((p) => !p.tieneAcceso).length;

  const res = wb.addWorksheet("Resumen", { properties: { tabColor: { argb: NAVY } }, views: [{ showGridLines: false }] });
  // Rejilla: A margen · B-G bloque izquierdo · H separación · I-N bloque derecho · O margen.
  const ULT = 15;
  res.columns = Array.from({ length: ULT }, (_, i) => ({ width: i === 0 || i === 7 || i === ULT - 1 ? 3 : 13 }));
  for (let r = 1; r <= 4; r++) for (let c = 1; c <= ULT; c++) res.getCell(r, c).fill = relleno(NAVY);
  for (let c = 1; c <= ULT; c++) res.getCell(5, c).fill = relleno(AZUL);
  res.getRow(1).height = 18;
  res.getRow(2).height = 34;
  res.getRow(3).height = 22;
  res.getRow(4).height = 14;
  res.getRow(5).height = 4;

  let logo: Buffer | null = null;
  if (ajustes?.logoUrl) {
    try {
      logo = await sharp(await readFile(publicUploadDiskPath(ajustes.logoUrl))).resize(220, 220, { fit: "inside" }).png().toBuffer();
    } catch {
      /* sin logo: el membrete va solo con el texto */
    }
  }
  const colTexto = logo ? 4 : 2;
  if (logo) {
    const id = wb.addImage({ base64: logo.toString("base64"), extension: "png" });
    res.addImage(id, { tl: { col: 1.1, row: 0.6 }, ext: { width: 62, height: 62 } });
  }
  res.mergeCells(2, colTexto, 2, ULT - 1);
  res.mergeCells(3, colTexto, 3, ULT - 1);
  const titulo = res.getCell(2, colTexto);
  titulo.value = "Directorio de usuarios";
  titulo.font = { bold: true, size: 22, color: { argb: BLANCO } };
  titulo.alignment = { vertical: "middle" };
  const sub = res.getCell(3, colTexto);
  sub.value = `RedSalud Te Forma · Campus virtual · ${new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" }).format(new Date())}`;
  sub.font = { size: 10.5, color: { argb: "FFB9CCDD" } };
  sub.alignment = { vertical: "middle" };

  // Tarjetas de cifras (fila 7-9): valor grande, etiqueta, franja de color arriba.
  const tarjetas: [number, string, string][] = [
    [total, "Personas", AZUL],
    [activos, "Activas", VERDE],
    [planta, "De planta", NAVY_2],
    [contratistas, "Contratistas", GRIS],
    [yaIngresaron, "Ya ingresaron", VERDE],
    [sinAcceso, "Sin acceso", ROJO],
  ];
  res.getRow(6).height = 14;
  res.getRow(7).height = 5;
  res.getRow(8).height = 38;
  res.getRow(9).height = 22;
  const COL_TARJETA = [2, 4, 6, 9, 11, 13];
  tarjetas.forEach(([valor, etiqueta, color], i) => {
    const c = COL_TARJETA[i];
    for (const r of [7, 8, 9]) res.mergeCells(r, c, r, c + 1);
    res.getCell(7, c).fill = relleno(color);
    const v = res.getCell(8, c);
    v.value = valor;
    v.numFmt = "#,##0";
    v.font = { bold: true, size: 24, color: { argb: color === GRIS ? NAVY : color } };
    v.alignment = { horizontal: "center", vertical: "bottom" };
    const e = res.getCell(9, c);
    e.value = etiqueta.toUpperCase();
    e.font = { bold: true, size: 8.5, color: { argb: GRIS } };
    e.alignment = { horizontal: "center", vertical: "top" };
    for (const r of [8, 9]) {
      const celda = res.getCell(r, c);
      celda.fill = relleno(ZEBRA);
      celda.border = {
        left: { style: "medium", color: { argb: BLANCO } },
        right: { style: "medium", color: { argb: BLANCO } },
        bottom: r === 9 ? { style: "thin", color: { argb: LINEA } } : undefined,
      };
    }
  });

  // Distribuciones: dos columnas de bloques (B-D y E-G), cada bloque con barra de datos.
  const contar = (clave: (p: (typeof personas)[number]) => string) => {
    const m = new Map<string, number>();
    for (const p of personas) m.set(clave(p), (m.get(clave(p)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"));
  };
  /** Bloque de distribución en 6 columnas: etiqueta (3 combinadas) · personas · % · barra. */
  const bloque = (fila: number, col: number, tituloBloque: string, datos: [string, number][], color: string) => {
    res.mergeCells(fila, col, fila, col + 5);
    const tb = res.getCell(fila, col);
    tb.value = tituloBloque.toUpperCase();
    tb.font = { bold: true, size: 9.5, color: { argb: BLANCO } };
    tb.fill = relleno(NAVY_2);
    tb.alignment = { vertical: "middle", indent: 1 };
    res.getRow(fila).height = 22;
    res.mergeCells(fila + 1, col, fila + 1, col + 2);
    (["", "", "", "Personas", "%", ""] as const).forEach((h, i) => {
      const c = res.getCell(fila + 1, col + i);
      if (i === 0 || i >= 3) c.value = h;
      c.font = { bold: true, size: 8.5, color: { argb: GRIS } };
      c.alignment = { horizontal: "center" };
      c.border = { bottom: { style: "thin", color: { argb: LINEA } } };
    });
    datos.forEach(([etiqueta, n], i) => {
      const r = fila + 2 + i;
      res.mergeCells(r, col, r, col + 2);
      res.getRow(r).height = 18;
      const a = res.getCell(r, col);
      a.value = etiqueta;
      a.font = { size: 10, color: { argb: "FF1D2B3A" } };
      a.alignment = { indent: 1, vertical: "middle" };
      const b = res.getCell(r, col + 3);
      b.value = n;
      b.numFmt = "#,##0";
      b.font = { bold: true, size: 10 };
      b.alignment = { horizontal: "center", vertical: "middle" };
      const pct = total ? n / total : 0;
      const p = res.getCell(r, col + 4);
      p.value = pct;
      p.numFmt = "0.0%";
      p.font = { size: 10, color: { argb: GRIS } };
      p.alignment = { horizontal: "center", vertical: "middle" };
      // La barra va en su propia celda con el valor oculto (formato ;;;), así no tapa la cifra.
      const barra = res.getCell(r, col + 5);
      barra.value = pct;
      barra.numFmt = ";;;";
      for (let k = 0; k < 6; k++) {
        const c = res.getCell(r, col + k);
        if (i % 2 === 1) c.fill = relleno(ZEBRA);
        c.border = { bottom: { style: "hair", color: { argb: LINEA } } };
      }
    });
    if (datos.length) {
      const desde = res.getCell(fila + 2, col + 5).address;
      const hasta = res.getCell(fila + 1 + datos.length, col + 5).address;
      res.addConditionalFormatting({
        ref: `${desde}:${hasta}`,
        rules: [
          {
            type: "dataBar",
            priority: 1,
            minLength: 0,
            maxLength: 100,
            gradient: false,
            border: false,
            cfvo: [{ type: "num", value: 0 }, { type: "num", value: 1 }],
            color: { argb: color },
          } as unknown as ExcelJS.ConditionalFormattingRule,
        ],
      });
    }
    return fila + 2 + datos.length + 1;
  };

  let izq = 11;
  let der = 11;
  izq = bloque(izq, 2, "Por rol", contar((p) => ROL[p.role]), AZUL);
  der = bloque(der, 9, "Por estado de la cuenta", contar((p) => ESTADO[p.status]), VERDE);
  izq = bloque(izq, 2, "Por tipo de personal", contar((p) => PERSONNEL_TYPE_LABELS[p.personnelType]), AZUL);
  der = bloque(der, 9, "Por estado de la contraseña", contar((p) => p.clave.texto), AMBAR);
  const fila3 = Math.max(izq, der);
  bloque(fila3, 2, "Por municipio", contar((p) => p.municipio?.nombre ?? "Sin municipio"), AZUL);
  bloque(fila3, 9, "Por tipo de vinculación", contar((p) => VINCULACION_LABELS[p.tipoVinculacion]), NAVY_2);
  res.pageSetup = { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };

  // ── 2. Usuarios ───────────────────────────────────────────────────────
  const colsUsuarios: Columna[] = [
    { titulo: "N°", ancho: 6, centro: true },
    { titulo: "Nombre completo", ancho: 34 },
    { titulo: "Tipo doc.", ancho: 9, centro: true },
    { titulo: "Documento", ancho: 15, mono: true },
    { titulo: "Correo", ancho: 36 },
    { titulo: "Usuario alterno", ancho: 20 },
    { titulo: "Teléfono", ancho: 14 },
    { titulo: "Rol", ancho: 13, centro: true },
    { titulo: "Estado", ancho: 12, centro: true },
    { titulo: "Tipo de personal", ancho: 16 },
    { titulo: "Vinculación", ancho: 28 },
    { titulo: "Planta", ancho: 9, centro: true },
    { titulo: "Cargo", ancho: 30 },
    { titulo: "Profesión", ancho: 24 },
    { titulo: "Dependencia / área", ancho: 26 },
    { titulo: "Municipio", ancho: 18 },
    { titulo: "Origen del registro", ancho: 15, centro: true },
    { titulo: "Registrado el", ancho: 14, formato: FECHA, centro: true },
    { titulo: "Último ingreso", ancho: 19, formato: FECHA_HORA, centro: true },
  ];
  const hojaU = hojaConMembrete(
    wb,
    "Usuarios",
    "Usuarios de la plataforma",
    `${total.toLocaleString("es-CO")} personas · todos los roles excepto administradores · ordenado por nombre`,
    colsUsuarios,
    personas.map((p, i) => [
      i + 1,
      p.fullName,
      TIPO_DOC[p.documentType] ?? p.documentType,
      p.documentNumber,
      p.email,
      p.username,
      p.phone,
      ROL[p.role],
      ESTADO[p.status],
      PERSONNEL_TYPE_LABELS[p.personnelType],
      VINCULACION_LABELS[p.tipoVinculacion],
      esPlanta(p.tipoVinculacion) ? "★ Sí" : "No",
      p.cargoTexto,
      p.profession,
      p.department,
      p.municipio?.nombre ?? null,
      p.origenRegistro === "IMPORTACION" ? "Importado" : "Autoregistro",
      horaColombia(p.createdAt),
      p.lastLoginAt ? horaColombia(p.lastLoginAt) : null,
    ]),
    AZUL
  );
  personas.forEach((p, i) => {
    const fila = hojaU.getRow(5 + i);
    fila.getCell(2).font = { size: 10, bold: true, color: { argb: NAVY } };
    pildora(fila.getCell(9), TONO_ESTADO[p.status]);
    if (esPlanta(p.tipoVinculacion)) fila.getCell(12).font = { size: 10, bold: true, color: { argb: AMBAR } };
  });

  // ── 3. Accesos ────────────────────────────────────────────────────────
  const porAcceso = [...personas].sort((a, b) => a.clave.orden - b.clave.orden || a.fullName.localeCompare(b.fullName, "es"));
  const colsAccesos: Columna[] = [
    { titulo: "N°", ancho: 6, centro: true },
    { titulo: "Nombre completo", ancho: 34 },
    { titulo: "Documento", ancho: 19, mono: true },
    { titulo: "Ingresa con (correo o usuario)", ancho: 46, mono: true },
    { titulo: "Contraseña", ancho: 34, centro: true },
    { titulo: "Último ingreso", ancho: 20, formato: FECHA_HORA, centro: true },
    { titulo: "Cuenta", ancho: 12, centro: true },
    { titulo: "Rol", ancho: 13, centro: true },
    { titulo: "Municipio", ancho: 18 },
  ];
  const hojaA = hojaConMembrete(
    wb,
    "Accesos",
    "Accesos a la plataforma",
    "Las contraseñas se guardan cifradas y no se pueden leer: aquí va su estado. Para entregar una, restablézcala desde la ficha del usuario.",
    colsAccesos,
    porAcceso.map((p, i) => [
      i + 1,
      p.fullName,
      p.documentNumber,
      p.ingresaCon || null,
      p.clave.texto,
      p.lastLoginAt ? horaColombia(p.lastLoginAt) : null,
      ESTADO[p.status],
      ROL[p.role],
      p.municipio?.nombre ?? null,
    ]),
    VERDE
  );
  porAcceso.forEach((p, i) => {
    const fila = hojaA.getRow(5 + i);
    fila.getCell(2).font = { size: 10, bold: true, color: { argb: NAVY } };
    if (p.ingresaCon) fila.getCell(4).font = { size: 10, name: "Consolas", color: { argb: "FF0B6E99" } };
    pildora(fila.getCell(5), p.clave.tono);
    pildora(fila.getCell(7), TONO_ESTADO[p.status]);
  });

  // ── 4. Información ───────────────────────────────────────────────────
  const info = wb.addWorksheet("Información", { properties: { tabColor: { argb: GRIS } }, views: [{ showGridLines: false }] });
  info.columns = [{ width: 26 }, { width: 90 }];
  const pares: [string, string][] = [
    ["Contenido", "Directorio completo de usuarios del campus virtual, excepto las cuentas de administrador."],
    ["Personas", total.toLocaleString("es-CO")],
    ["Generado por", generadoPor],
    ["Generado", new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" }).format(new Date())],
    ["Contraseñas", "No se exportan: se guardan cifradas (bcrypt) y no se pueden recuperar. La hoja «Accesos» indica el estado de cada una."],
    ["Temporal", "El usuario debe cambiarla al entrar. Si nunca ha ingresado, la clave es la que se le entregó al crearlo o restablecerla."],
    ["Asignada", "Clave entregada sin cambio obligatorio (p. ej. contratistas cargados en lote) y la persona aún no ha entrado."],
    ["En uso", "La persona ya ingresó con su clave."],
    ["Confidencialidad", "Contiene datos personales (Ley 1581 de 2012). Uso interno de Talento Humano; no reenviar."],
  ];
  pares.forEach(([k, v]) => {
    const r = info.addRow([k, v]);
    r.height = 22;
    r.getCell(1).font = { bold: true, size: 10, color: { argb: BLANCO } };
    r.getCell(1).fill = relleno(NAVY);
    r.getCell(1).alignment = { vertical: "middle", indent: 1 };
    r.getCell(2).font = { size: 10 };
    r.getCell(2).alignment = { vertical: "middle", wrapText: true, indent: 1 };
    r.getCell(2).border = { bottom: { style: "thin", color: { argb: LINEA } } };
  });

  const fecha = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
  return { wb, nombre: `directorio-usuarios-${fecha}.xlsx` };
}
