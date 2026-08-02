/**
 * Lectura de .docx y .pptx sin dependencias externas.
 *
 * Los dos son ZIP con XML adentro. Se implementa aquí el mínimo de ZIP que
 * hace falta -directorio central + inflate- en vez de sumar una dependencia
 * al proyecto por leer cuatro archivos.
 *
 * Lo importante: en las evaluaciones que envían las áreas la respuesta
 * correcta viene SUBRAYADA dentro de la propia opción, no escrita aparte.
 * Un volcado de texto plano pierde la clave entera, así que aquí el
 * subrayado se conserva como parte del resultado.
 */
import { inflateRawSync } from "node:zlib";

const FIRMA_EOCD = 0x06054b50;
const FIRMA_CENTRAL = 0x02014b50;

/** Devuelve el contenido de una entrada del zip, o null si no está. */
function leerEntrada(zip: Buffer, nombre: string): Buffer | null {
  // El fin del directorio central está al final, después de un comentario de
  // longitud variable: se busca hacia atrás.
  let eocd = -1;
  for (let i = zip.length - 22; i >= 0; i--) {
    if (zip.readUInt32LE(i) === FIRMA_EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("No parece un archivo zip válido.");

  const total = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);

  for (let i = 0; i < total; i++) {
    if (zip.readUInt32LE(p) !== FIRMA_CENTRAL) break;
    const metodo = zip.readUInt16LE(p + 10);
    const tamComprimido = zip.readUInt32LE(p + 20);
    const largoNombre = zip.readUInt16LE(p + 28);
    const largoExtra = zip.readUInt16LE(p + 30);
    const largoComentario = zip.readUInt16LE(p + 32);
    const offsetLocal = zip.readUInt32LE(p + 42);
    const nombreEntrada = zip.subarray(p + 46, p + 46 + largoNombre).toString("utf8");

    if (nombreEntrada === nombre) {
      // La cabecera local repite nombre y extra, con longitudes propias.
      const nl = zip.readUInt16LE(offsetLocal + 26);
      const el = zip.readUInt16LE(offsetLocal + 28);
      const inicio = offsetLocal + 30 + nl + el;
      const datos = zip.subarray(inicio, inicio + tamComprimido);
      return metodo === 0 ? Buffer.from(datos) : inflateRawSync(datos);
    }

    p += 46 + largoNombre + largoExtra + largoComentario;
  }
  return null;
}

function desescapar(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export type LineaDocx = {
  texto: string;
  /** Fragmentos subrayados de la línea. En estas evaluaciones marcan la respuesta correcta. */
  subrayado: string;
};

/**
 * Párrafos de un .docx, cada uno con su texto completo y con la parte que
 * viene subrayada.
 *
 * Word parte una misma frase en varios "runs" -por un cambio de fuente, un
 * corrector ortográfico o nada en particular-, así que hay que recomponer
 * el párrafo run por run y no confiar en que cada uno sea una frase.
 */
export function leerParrafosDocx(zip: Buffer): LineaDocx[] {
  const xml = leerEntrada(zip, "word/document.xml");
  if (!xml) throw new Error("El .docx no contiene word/document.xml");
  const doc = xml.toString("utf8");

  const parrafos: LineaDocx[] = [];

  for (const [, cuerpo] of doc.matchAll(/<w:p[ >]([\s\S]*?)<\/w:p>/g)) {
    let texto = "";
    let subrayado = "";

    for (const [, run] of cuerpo.matchAll(/<w:r[ >]([\s\S]*?)<\/w:r>/g)) {
      const props = run.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/)?.[1] ?? "";
      const marca = props.match(/<w:u\b[^>]*\/?>/)?.[0] ?? "";
      const vaSubrayado = marca.length > 0 && !/w:val="none"/.test(marca);

      const trozo = [...run.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
        .map((m) => desescapar(m[1]))
        .join("");
      if (!trozo) continue;

      texto += trozo;
      if (vaSubrayado) subrayado += trozo;
    }

    if (texto.trim()) parrafos.push({ texto: texto.trim(), subrayado: subrayado.trim() });
  }

  return parrafos;
}

/** Texto de un .pptx, una entrada por diapositiva y en su orden real. */
export function leerDiapositivasPptx(zip: Buffer): string[] {
  const diapositivas: string[] = [];
  for (let i = 1; ; i++) {
    const xml = leerEntrada(zip, `ppt/slides/slide${i}.xml`);
    if (!xml) break;
    const texto = [...xml.toString("utf8").matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
      .map((m) => desescapar(m[1]).trim())
      .filter(Boolean)
      .join("\n");
    diapositivas.push(texto);
  }
  return diapositivas;
}
