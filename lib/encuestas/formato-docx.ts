import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  AlignmentType,
  BorderStyle,
  CheckBox,
  Document,
  Footer,
  Header,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import { prisma } from "@/lib/prisma";
import { leerConfig, type OpcionPregunta, type TonoOpcion } from "@/lib/encuestas/tipos";

/**
 * FORMATO OFICIAL EN WORD de una encuesta (la SIAU): replica el documento
 * institucional -encabezado con logo, NIT, código, fecha y versión; campos
 * de identificación; todas las preguntas de corrido; pie con dirección y
 * paginación- pero con la estructura visual de la página: caritas por
 * significado y casillas de verificación reales de Word.
 *
 * Se genera en servidor a partir de la encuesta guardada, así el formato
 * impreso nunca se desalinea de lo que se responde en línea.
 */

const FUENTE = "Arial";
const TONO_COLOR: Record<TonoOpcion, { color: string; suave: string }> = {
  exc: { color: "#1f9d5a", suave: "#e6f6ec" },
  bue: { color: "#2f80c2", suave: "#e8f1fa" },
  reg: { color: "#e0a11c", suave: "#fdf4dd" },
  mal: { color: "#e0642e", suave: "#fdece4" },
  muymal: { color: "#d64545", suave: "#fbe7e7" },
  na: { color: "#64748b", suave: "#eef2f6" },
};

/** Misma carita de la página, en SVG estático. */
export function svgCarita(tono: TonoOpcion): string {
  const { color, suave } = TONO_COLOR[tono];
  const boca =
    tono === "exc" ? "M17 34 Q28 46 39 34" : tono === "bue" ? "M19 35 Q28 42 37 35" : tono === "reg" ? "M19 37 L37 37" : tono === "mal" ? "M19 40 Q28 33 37 40" : tono === "muymal" ? "M18 41 Q28 31 38 41" : "M20 37 L36 37";
  const ojos =
    tono === "exc"
      ? `<path d="M17 24 Q21 19 25 24" stroke="${color}" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M31 24 Q35 19 39 24" stroke="${color}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`
      : `<circle cx="21" cy="23" r="2.6" fill="${color}"/><circle cx="35" cy="23" r="2.6" fill="${color}"/>`;
  const cejas = tono === "mal" || tono === "muymal" ? `<path d="M16 18 L25 21" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/><path d="M40 18 L31 21" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>` : "";
  const lagrima = tono === "muymal" ? `<path d="M38 29 q3 5 0 7 q-3 -2 0 -7" fill="${color}"/>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56" width="224" height="224"><circle cx="28" cy="28" r="25" fill="${suave}" stroke="${color}" stroke-width="2.5" ${tono === "na" ? 'stroke-dasharray="4 3"' : ""}/>${ojos}${cejas}<path d="${boca}" stroke="${color}" stroke-width="2.8" fill="none" stroke-linecap="round"/>${lagrima}</svg>`;
}

const cachePng = new Map<TonoOpcion, Buffer>();
async function pngCarita(tono: TonoOpcion): Promise<Buffer> {
  const previo = cachePng.get(tono);
  if (previo) return previo;
  const png = await sharp(Buffer.from(svgCarita(tono))).png().toBuffer();
  cachePng.set(tono, png);
  return png;
}

// ------------------------------------------------------------ helpers de texto
const t = (texto: string, extra: Partial<ConstructorParameters<typeof TextRun>[0] & object> = {}) =>
  new TextRun({ text: texto, font: FUENTE, size: 18, ...extra });
const negrita = (texto: string, size = 18) => t(texto, { bold: true, size });
const parrafo = (runs: TextRun[] | string, opts: Partial<ConstructorParameters<typeof Paragraph>[0] & object> = {}) =>
  new Paragraph({ children: typeof runs === "string" ? [t(runs)] : runs, spacing: { after: 80 }, ...opts });
const casilla = () => new CheckBox({ checked: false, checkedState: { value: "2612", font: "MS Gothic" }, uncheckedState: { value: "2610", font: "MS Gothic" } });

const SIN_BORDE = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const sinBordes = { top: SIN_BORDE, bottom: SIN_BORDE, left: SIN_BORDE, right: SIN_BORDE, insideHorizontal: SIN_BORDE, insideVertical: SIN_BORDE };
const BORDE = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
const conBordes = { top: BORDE, bottom: BORDE, left: BORDE, right: BORDE, insideHorizontal: BORDE, insideVertical: BORDE };

function celda(children: Paragraph[], opts: { width?: number; shade?: string; span?: number; center?: boolean } = {}) {
  return new TableCell({
    children,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    columnSpan: opts.span,
    verticalAlign: VerticalAlign.CENTER,
    shading: opts.shade ? { type: ShadingType.CLEAR, fill: opts.shade, color: "auto" } : undefined,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
  });
}

function imagen(png: Buffer, px: number) {
  return new ImageRun({ type: "png", data: png, transformation: { width: px, height: px } });
}

function tituloPregunta(prompt: string) {
  return new Paragraph({ children: [negrita(prompt, 19)], spacing: { before: 200, after: 100 }, keepNext: true });
}

/** Opción con casilla + carita + etiqueta, como celda de tabla (para filas de caritas). */
async function celdaCarita(o: OpcionPregunta, ancho: number) {
  const png = await pngCarita(o.tono ?? "na");
  return celda(
    [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [imagen(png, 40)], spacing: { after: 40 } }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [casilla(), t(" " + o.texto, { bold: true, color: TONO_COLOR[o.tono ?? "na"].color.replace("#", "") })], spacing: { after: 20 } }),
      ...(o.ayuda ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [t(o.ayuda, { size: 14, color: "475569" })] })] : []),
    ],
    { width: ancho, center: true }
  );
}

// ------------------------------------------------------------ documento

export async function generarFormatoDocx(slug: string): Promise<{ buffer: Buffer; nombre: string } | null> {
  const encuesta = await prisma.survey.findUnique({
    where: { slug },
    include: { pages: { orderBy: { sortOrder: "asc" }, include: { questions: { orderBy: { sortOrder: "asc" } } } } },
  });
  if (!encuesta) return null;
  const ajustes = await prisma.institutionSettings.findUnique({ where: { id: "singleton" }, select: { institutionName: true } });
  const institucion = ajustes?.institutionName ?? "Red Salud Casanare E.S.E.";
  const logo = await readFile(path.join(process.cwd(), "assets", "formatos", "logo-redsalud.jpeg")).catch(() => null);
  const [codigo, version] = (encuesta.code.match(/^(.*?)\s+(V\.\d+)$/)?.slice(1) ?? [encuesta.code, ""]) as [string, string];

  const ANCHO = 9974; // 12242 - 2 × 1134 twips

  // ---- encabezado oficial
  const encabezado = new Header({
    children: [
      new Table({
        width: { size: ANCHO, type: WidthType.DXA },
        borders: conBordes,
        rows: [
          new TableRow({
            children: [
              celda([new Paragraph({ alignment: AlignmentType.CENTER, children: logo ? [new ImageRun({ type: "jpg", data: logo, transformation: { width: 120, height: 48 } })] : [negrita(institucion, 16)] })], { width: 2400 }),
              celda(
                [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [negrita(institucion.toUpperCase(), 16)] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [t("NIT.844.004197-2", { size: 14 })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [negrita(encuesta.title.toUpperCase(), 18)] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [t("Resolución 0256 de 2016", { size: 14 })] }),
                ],
                { width: 5174 }
              ),
              celda(
                [
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [negrita(codigo, 16)] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [t("16/6/2025", { size: 14 })] }),
                  new Paragraph({ alignment: AlignmentType.CENTER, children: [negrita(version || "V.1", 16)] }),
                ],
                { width: 2400 }
              ),
            ],
          }),
        ],
      }),
      new Paragraph({ spacing: { after: 120 } }),
    ],
  });

  const pie = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { top: { style: BorderStyle.SINGLE, size: 4, color: "000000", space: 4 } },
        children: [t("Carrera 19 No 06-85 Yopal – Casanare  contactenos@redsaludcasanare.gov.co", { size: 14 })],
      }),
      new Paragraph({ alignment: AlignmentType.RIGHT, children: [t("Página ", { size: 14 }), new TextRun({ children: [PageNumber.CURRENT], font: FUENTE, size: 14 }), t(" de ", { size: 14 }), new TextRun({ children: [PageNumber.TOTAL_PAGES], font: FUENTE, size: 14 })] }),
    ],
  });

  const cuerpo: (Paragraph | Table)[] = [];
  const preguntas = encuesta.pages.flatMap((p) => p.questions.map((q) => ({ q, pagina: p })));

  // ---- identificación (fecha, nombre, sexo, teléfono, EPS, municipio)
  const datos = preguntas.filter(({ q }) => ["fecha", "nombre", "telefono", "eps", "municipio"].includes(leerConfig(q.config).rol ?? "") || leerConfig(q.config).estilo === "sexo");
  if (datos.length > 0) {
    const linea = (etiqueta: string, ancho: number) => celda([new Paragraph({ children: [negrita(etiqueta + ": ")] })], { width: ancho });
    const sexo = datos.find(({ q }) => leerConfig(q.config).estilo === "sexo");
    cuerpo.push(
      new Table({
        width: { size: ANCHO, type: WidthType.DXA },
        borders: conBordes,
        rows: [
          new TableRow({ children: [linea("FECHA", 3324), celda([new Paragraph({ children: [negrita("NOMBRE: ")] })], { width: 6650, span: 2 })] }),
          new TableRow({
            children: [
              linea("TELÉFONO", 3324),
              celda([new Paragraph({ children: [negrita("SEXO: "), ...(sexo ? (leerConfig(sexo.q.config).opciones ?? []).flatMap((o) => [casilla(), t(` ${o.texto}   `)]) : [])] })], { width: 3325 }),
              linea("EPS", 3325),
            ],
          }),
          new TableRow({ children: [celda([new Paragraph({ children: [negrita("MUNICIPIO: ")] })], { width: 9974, span: 3 })] }),
        ],
      }),
      new Paragraph({ spacing: { after: 120 } })
    );
  }

  // ---- bienvenida + habeas
  const bienvenida = encuesta.pages[0]?.description ?? encuesta.description;
  if (bienvenida) cuerpo.push(parrafo([t(bienvenida)], { alignment: AlignmentType.JUSTIFIED, spacing: { after: 140 } }));
  const habeas = preguntas.find(({ q }) => leerConfig(q.config).estilo === "habeas");
  if (habeas) {
    const ops = leerConfig(habeas.q.config).opciones ?? [];
    cuerpo.push(parrafo([negrita(habeas.q.prompt + ":")], { alignment: AlignmentType.JUSTIFIED }));
    cuerpo.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: ops.flatMap((o) => [casilla(), t(` ${o.texto}.        `)]) }));
  }

  // ---- preguntas numeradas
  let matrizYaPintada = false;
  for (const { q, pagina } of preguntas) {
    const c = leerConfig(q.config);
    if (["habeas", "sexo", "selector"].includes(c.estilo ?? "") || ["fecha", "nombre", "telefono", "eps", "municipio", "otro"].includes(c.rol ?? "")) continue;

    if (c.estilo === "matriz") {
      if (matrizYaPintada) continue;
      matrizYaPintada = true;
      const filas = pagina.questions.filter((x) => leerConfig(x.config).estilo === "matriz");
      const escala = leerConfig(filas[0]?.config).opciones ?? [];
      cuerpo.push(tituloPregunta(pagina.description ?? "2: ¿Cómo califica la amabilidad, el trato digno y el respeto recibido por parte del personal de la institución?"));
      const cabecera = new TableRow({
        tableHeader: true,
        children: [
          celda([new Paragraph({ children: [negrita("Personal que lo atendió", 16)] })], { width: 3400, shade: "E8F1FA" }),
          ...(await Promise.all(
            escala.map(async (o) =>
              celda(
                [new Paragraph({ alignment: AlignmentType.CENTER, children: [imagen(await pngCarita(o.tono ?? "na"), 22)] }), new Paragraph({ alignment: AlignmentType.CENTER, children: [negrita(o.id === "NA" ? "N/A" : o.texto, 13)] })],
                { width: Math.floor((ANCHO - 3400) / escala.length), shade: "F4F7FA" }
              )
            )
          )),
        ],
      });
      const cuerpoFilas = filas.map(
        (f) =>
          new TableRow({
            children: [
              celda([new Paragraph({ children: [t(f.prompt)] })], { width: 3400 }),
              ...escala.map(() => celda([new Paragraph({ alignment: AlignmentType.CENTER, children: [casilla()] })], { width: Math.floor((ANCHO - 3400) / escala.length) })),
            ],
          })
      );
      cuerpo.push(new Table({ width: { size: ANCHO, type: WidthType.DXA }, borders: conBordes, rows: [cabecera, ...cuerpoFilas] }));
      continue;
    }

    cuerpo.push(tituloPregunta(q.prompt));
    const opciones = c.opciones ?? [];

    if (c.estilo === "servicios") {
      // Tres columnas de casillas, como el formato original.
      const cols = 3;
      const filas: TableRow[] = [];
      for (let i = 0; i < opciones.length; i += cols) {
        const grupo = opciones.slice(i, i + cols);
        filas.push(
          new TableRow({
            children: Array.from({ length: cols }, (_, j) => {
              const o = grupo[j];
              return celda([new Paragraph({ children: o ? [casilla(), t(` ${o.texto}${/^otro/i.test(o.texto) ? ": ____________________" : ""}`)] : [] })], { width: Math.floor(ANCHO / cols) });
            }),
          })
        );
      }
      cuerpo.push(new Table({ width: { size: ANCHO, type: WidthType.DXA }, borders: sinBordes, rows: filas }));
      continue;
    }

    if (c.estilo === "caritas" || c.estilo === "tarjetas") {
      const ancho = Math.floor(ANCHO / opciones.length);
      cuerpo.push(new Table({ width: { size: ANCHO, type: WidthType.DXA }, borders: sinBordes, rows: [new TableRow({ children: await Promise.all(opciones.map((o) => celdaCarita(o, ancho))) })] }));
      continue;
    }

    if (c.estilo === "semaforo" || q.type === "SINGLE_CHOICE" || q.type === "YES_NO") {
      for (const o of opciones) {
        const png = await pngCarita(o.tono ?? "na");
        cuerpo.push(new Paragraph({ spacing: { after: 60 }, indent: { left: 280 }, children: [casilla(), t("  "), imagen(png, 18), t(`  ${o.texto}`)] }));
      }
      continue;
    }

    if (q.type === "LONG_TEXT" || q.type === "SHORT_TEXT") {
      cuerpo.push(
        new Table({
          width: { size: ANCHO, type: WidthType.DXA },
          borders: conBordes,
          rows: [new TableRow({ children: [celda(Array.from({ length: 5 }, () => new Paragraph({ children: [t(" ")], spacing: { after: 160 } })), { width: ANCHO })], height: { value: 1800, rule: "atLeast" } })],
        })
      );
    }
  }

  cuerpo.push(new Paragraph({ spacing: { before: 240 }, alignment: AlignmentType.CENTER, children: [t("¡Gracias por su tiempo! Su opinión es la base de nuestra mejora continua.", { italics: true, size: 16, color: "475569" })] }));

  const doc = new Document({
    creator: institucion,
    title: `${encuesta.code} · ${encuesta.title}`,
    styles: { default: { document: { run: { font: FUENTE, size: 18 } } } },
    sections: [
      {
        properties: { page: { size: { width: 12242, height: 15842 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134, header: 510, footer: 400 } } },
        headers: { default: encabezado },
        footers: { default: pie },
        children: cuerpo,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return { buffer: Buffer.from(buffer), nombre: `${codigo.replace(/\s+/g, "-")}_${encuesta.title.replace(/[^\w]+/g, "-")}.docx` };
}
