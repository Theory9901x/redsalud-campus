/**
 * FICHA DE LOS DOCUMENTOS: qué es cada archivo (su tipo documental) y su
 * formato (PDF, Word, Excel…). El tipo lo elige quien sube el archivo; si
 * no lo eligió (archivos antiguos, grabaciones automáticas) se deduce del
 * nombre y del formato para que el registro no quede con huecos.
 */
export const TIPOS_DOCUMENTO = {
  PRESENTACION: "Presentación",
  LISTA_ASISTENCIA: "Lista de asistencia",
  ACTA: "Acta",
  GRABACION: "Grabación de la jornada",
  INFORME: "Informe",
  FORMATO: "Formato institucional",
  RESOLUCION: "Resolución / normativa",
  EVIDENCIA: "Evidencia fotográfica",
  MATERIAL: "Material de apoyo",
  OTRO: "Otro documento",
} as const;

export type TipoDocumento = keyof typeof TIPOS_DOCUMENTO;

/**
 * DÓNDE se sube el documento. Las actas y las resoluciones son de los
 * comités y las reuniones; un plan de capacitación o una capacitación no
 * levantan acta, así que ahí no se ofrecen (ni se deducen).
 */
export type ContextoDocumento = "capacitacion" | "comite" | "reunion";

const TODOS_LOS_TIPOS = Object.keys(TIPOS_DOCUMENTO) as TipoDocumento[];

export const TIPOS_POR_CONTEXTO: Record<ContextoDocumento, readonly TipoDocumento[]> = {
  capacitacion: ["PRESENTACION", "LISTA_ASISTENCIA", "GRABACION", "INFORME", "FORMATO", "EVIDENCIA", "MATERIAL", "OTRO"],
  comite: TODOS_LOS_TIPOS,
  reunion: TODOS_LOS_TIPOS,
};

/** Tipos documentales que se ofrecen al subir en ese contexto, en el orden del catálogo. */
export function tiposDocumentoPara(contexto: ContextoDocumento): [TipoDocumento, string][] {
  const permitidos = TIPOS_POR_CONTEXTO[contexto];
  return TODOS_LOS_TIPOS.filter((t) => permitidos.includes(t)).map((t) => [t, TIPOS_DOCUMENTO[t]]);
}

export type Formato = "pdf" | "word" | "excel" | "powerpoint" | "video" | "imagen" | "audio" | "zip" | "texto" | "otro";

export const FORMATOS: Record<Formato, { etiqueta: string; sigla: string }> = {
  pdf: { etiqueta: "PDF", sigla: "PDF" },
  word: { etiqueta: "Word", sigla: "DOC" },
  excel: { etiqueta: "Excel", sigla: "XLS" },
  powerpoint: { etiqueta: "PowerPoint", sigla: "PPT" },
  video: { etiqueta: "Video", sigla: "VID" },
  imagen: { etiqueta: "Imagen", sigla: "IMG" },
  audio: { etiqueta: "Audio", sigla: "AUD" },
  zip: { etiqueta: "Comprimido", sigla: "ZIP" },
  texto: { etiqueta: "Texto", sigla: "TXT" },
  otro: { etiqueta: "Archivo", sigla: "FILE" },
};

export function extensionDe(fileName: string) {
  return (fileName.match(/\.([a-z0-9]+)$/i)?.[1] ?? "").toLowerCase();
}

export function formatoDe(fileType: string, fileName: string): Formato {
  const ext = extensionDe(fileName);
  const t = fileType.toLowerCase();
  if (t === "application/pdf" || ext === "pdf") return "pdf";
  if (/msword|wordprocessingml|rtf/.test(t) || ["doc", "docx", "rtf", "odt"].includes(ext)) return "word";
  if (/spreadsheet|excel|csv/.test(t) || ["xls", "xlsx", "csv", "ods"].includes(ext)) return "excel";
  if (/presentation|powerpoint/.test(t) || ["ppt", "pptx", "odp"].includes(ext)) return "powerpoint";
  if (t.startsWith("video/") || ["mp4", "webm", "mov", "mkv"].includes(ext)) return "video";
  if (t.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "imagen";
  if (t.startsWith("audio/") || ["mp3", "wav", "m4a", "ogg"].includes(ext)) return "audio";
  if (/zip|rar|7z|compressed/.test(t) || ["zip", "rar", "7z"].includes(ext)) return "zip";
  if (t.startsWith("text/") || ext === "txt") return "texto";
  return "otro";
}

/**
 * Tipo documental: el elegido al subir o, si no hay, el que sugieren el
 * nombre y el formato. Con `contexto`, un tipo que no aplica ahí (un "ACTA"
 * viejo en una capacitación) se lee como «Otro documento».
 */
export function tipoDocumentoDe(doc: { kind?: string | null; fileName: string; fileType: string }, contexto?: ContextoDocumento): TipoDocumento {
  const tipo = tipoDocumentoSinContexto(doc);
  return contexto && !TIPOS_POR_CONTEXTO[contexto].includes(tipo) ? "OTRO" : tipo;
}

function tipoDocumentoSinContexto(doc: { kind?: string | null; fileName: string; fileType: string }): TipoDocumento {
  if (doc.kind && doc.kind in TIPOS_DOCUMENTO) return doc.kind as TipoDocumento;
  const n = doc.fileName.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const f = formatoDe(doc.fileType, doc.fileName);
  if (f === "video") return "GRABACION";
  if (/^\d+-?acta|\bacta\b/.test(n)) return "ACTA";
  if (/asistencia|lista/.test(n)) return "LISTA_ASISTENCIA";
  if (/informe|reporte/.test(n)) return "INFORME";
  if (/resoluci|circular|decreto|norma|lineamiento/.test(n)) return "RESOLUCION";
  if (/formato|plantilla/.test(n)) return "FORMATO";
  if (f === "powerpoint" || /presentaci|diapositiva/.test(n)) return "PRESENTACION";
  if (f === "imagen") return "EVIDENCIA";
  if (f === "pdf" || f === "word") return "MATERIAL";
  return "OTRO";
}

/** El nombre en disco va saneado (sin tildes, con guiones): se recupera un título legible. */
export function nombreLegibleDocumento(fileName: string) {
  const sinExt = fileName.replace(/^\d+-/, "").replace(/\.[a-z0-9]+$/i, "");
  return sinExt
    .replace(/---+/g, " · ")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/ci n\b/gi, "ción")
    .replace(/si n\b/gi, "sión")
    .trim();
}

export function tamanoLegible(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function leerTipoDocumento(valor: unknown): TipoDocumento | null {
  return typeof valor === "string" && valor in TIPOS_DOCUMENTO ? (valor as TipoDocumento) : null;
}
