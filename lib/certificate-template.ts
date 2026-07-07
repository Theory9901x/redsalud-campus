export type CertificateFieldKey =
  | "nombreCompleto"
  | "tipoDocumento"
  | "numeroDocumento"
  | "curso"
  | "tipoCurso"
  | "intensidadHoraria"
  | "ciudad"
  | "fecha"
  | "codigo"
  | "institucion"
  | "firmante"
  | "cargoFirmante"
  | "textoAdicional";

export const CERTIFICATE_FIELD_LABELS: Record<CertificateFieldKey, string> = {
  nombreCompleto: "Nombre completo",
  tipoDocumento: "Tipo de documento",
  numeroDocumento: "Número de documento",
  curso: "Nombre del curso",
  tipoCurso: "Tipo de curso",
  intensidadHoraria: "Intensidad horaria",
  ciudad: "Ciudad",
  fecha: "Fecha de emisión",
  codigo: "Código del certificado",
  institucion: "Nombre de la institución",
  firmante: "Nombre del responsable",
  cargoFirmante: "Cargo del responsable",
  textoAdicional: "Texto adicional",
};

export type CertificateFieldValues = Record<CertificateFieldKey, string>;

/** Valores de muestra para previsualizar la plantilla en el constructor visual. */
export const SAMPLE_FIELD_VALUES: CertificateFieldValues = {
  nombreCompleto: "Nombre Completo De Ejemplo",
  tipoDocumento: "CC",
  numeroDocumento: "•••••1234",
  curso: "Título del curso de ejemplo",
  tipoCurso: "Capacitación",
  intensidadHoraria: "8 horas",
  ciudad: "Yopal, Casanare",
  fecha: "6 de julio de 2026",
  codigo: "RSC-2026-ABC123",
  institucion: "Red Salud Casanare E.S.E.",
  firmante: "Nombre del responsable",
  cargoFirmante: "Cargo del responsable",
  textoAdicional: "",
};

export const CERTIFICATE_FONT_FAMILIES = [
  "Helvetica",
  "Helvetica-Bold",
  "Helvetica-Oblique",
  "Helvetica-BoldOblique",
  "Times-Roman",
  "Times-Bold",
  "Times-Italic",
  "Times-BoldItalic",
  "Courier",
  "Courier-Bold",
  "Courier-Oblique",
  "Courier-BoldOblique",
] as const;

export type CertificateFontFamily = (typeof CERTIFICATE_FONT_FAMILIES)[number];

export const CERTIFICATE_FONT_LABELS: Record<CertificateFontFamily, string> = {
  Helvetica: "Sans serif",
  "Helvetica-Bold": "Sans serif negrita",
  "Helvetica-Oblique": "Sans serif itálica",
  "Helvetica-BoldOblique": "Sans serif negrita itálica",
  "Times-Roman": "Serif",
  "Times-Bold": "Serif negrita",
  "Times-Italic": "Serif itálica",
  "Times-BoldItalic": "Serif negrita itálica",
  Courier: "Monoespaciada",
  "Courier-Bold": "Monoespaciada negrita",
  "Courier-Oblique": "Monoespaciada itálica",
  "Courier-BoldOblique": "Monoespaciada negrita itálica",
};

export type CertificateTextElement = {
  id: string;
  type: "text";
  fieldKey: CertificateFieldKey;
  x: number; // % del ancho de la página (0-100)
  y: number; // % del alto de la página (0-100)
  fontSize: number; // en puntos, igual que en el PDF final
  fontFamily: CertificateFontFamily;
  color: string; // hex
  align: "left" | "center" | "right";
  widthPct: number; // ancho de la caja de texto, % del ancho de la página
};

export type CertificateImageElement = {
  id: string;
  type: "image";
  /** "logo"/"firma" resuelven su imagen desde la configuración institucional al momento de generar el PDF. */
  kind: "logo" | "firma" | "custom";
  src: string | null;
  x: number;
  y: number;
  widthPct: number;
  heightPct: number;
};

export type CertificateQrElement = {
  id: string;
  type: "qr";
  x: number;
  y: number;
  sizePct: number;
};

/** Texto fijo escrito por el admin (títulos, frases fijas), no ligado a ningún dato del usuario. */
export type CertificateStaticTextElement = {
  id: string;
  type: "static";
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: CertificateFontFamily;
  color: string;
  align: "left" | "center" | "right";
  widthPct: number;
};

export type CertificateElement =
  | CertificateTextElement
  | CertificateImageElement
  | CertificateQrElement
  | CertificateStaticTextElement;

export type CertificateLayout = {
  elements: CertificateElement[];
};

/**
 * Diseño de fábrica: coincide con la plantilla institucional real de Red
 * Salud Casanare (fondo diseñado con el logo, título, textos fijos y líneas
 * ya impresos en la imagen). Aquí solo van los campos dinámicos que se
 * escriben sobre esas líneas en blanco.
 */
export const DEFAULT_CERTIFICATE_LAYOUT: CertificateLayout = {
  elements: [
    // Línea 1: "____" encima de "identificado(a) con"
    {
      id: "nombre",
      type: "text",
      fieldKey: "nombreCompleto",
      x: 19.4,
      y: 49.3,
      fontSize: 16,
      fontFamily: "Helvetica-Bold",
      color: "#0F2438",
      align: "center",
      widthPct: 61.1,
    },
    // Línea 2: tipo + número de documento
    {
      id: "tipo-documento",
      type: "text",
      fieldKey: "tipoDocumento",
      x: 28,
      y: 58.3,
      fontSize: 12,
      fontFamily: "Helvetica",
      color: "#0F2438",
      align: "right",
      widthPct: 10,
    },
    {
      id: "numero-documento",
      type: "text",
      fieldKey: "numeroDocumento",
      x: 39,
      y: 58.3,
      fontSize: 12,
      fontFamily: "Helvetica",
      color: "#0F2438",
      align: "left",
      widthPct: 25,
    },
    // Línea 3: nombre del curso
    {
      id: "curso",
      type: "text",
      fieldKey: "curso",
      x: 19.4,
      y: 66.4,
      fontSize: 15,
      fontFamily: "Helvetica-Bold",
      color: "#0F2438",
      align: "center",
      widthPct: 61.1,
    },
    // Fila "Intensidad horaria | ___"
    {
      id: "intensidad",
      type: "text",
      fieldKey: "intensidadHoraria",
      x: 41,
      y: 73.2,
      fontSize: 10,
      fontFamily: "Helvetica",
      color: "#0F2438",
      align: "left",
      widthPct: 10,
    },
    // Fila "Fecha de expedición | ___"
    {
      id: "fecha",
      type: "text",
      fieldKey: "fecha",
      x: 69,
      y: 73.2,
      fontSize: 10,
      fontFamily: "Helvetica",
      color: "#0F2438",
      align: "left",
      widthPct: 14,
    },
    // Firma, justo encima de la línea "Firma autorizada"
    { id: "firma", type: "image", kind: "firma", src: null, x: 40, y: 77, widthPct: 20, heightPct: 7 },
    // "Código de certificado | ___"
    {
      id: "codigo",
      type: "text",
      fieldKey: "codigo",
      x: 56,
      y: 91.3,
      fontSize: 10,
      fontFamily: "Helvetica-Bold",
      color: "#0F2438",
      align: "left",
      widthPct: 20,
    },
    // Recuadro punteado del QR
    { id: "qr", type: "qr", x: 83, y: 75.5, sizePct: 8 },
  ],
};

/** Arma los valores reales de cada campo {{ }} a partir de los datos del certificado emitido. */
export function buildFieldValues(input: {
  fullName: string;
  documentType: string;
  documentNumber: string;
  courseTitle: string;
  courseTypeLabel: string;
  durationHours: number;
  city: string;
  issuedAt: Date;
  certificateCode: string;
  institutionName: string;
  signerName: string | null;
  signerPosition: string | null;
  certificateText: string | null;
}): CertificateFieldValues {
  return {
    nombreCompleto: input.fullName,
    tipoDocumento: input.documentType,
    numeroDocumento: input.documentNumber,
    curso: input.courseTitle,
    tipoCurso: input.courseTypeLabel,
    intensidadHoraria: `${input.durationHours} horas`,
    ciudad: input.city,
    fecha: input.issuedAt.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" }),
    codigo: input.certificateCode,
    institucion: input.institutionName,
    firmante: input.signerName ?? "",
    cargoFirmante: input.signerPosition ?? "",
    textoAdicional: input.certificateText ?? "",
  };
}

/** Convierte el layoutJson (Json de Prisma) a un CertificateLayout tipado, o el diseño de fábrica si es inválido/nulo. */
export function parseCertificateLayout(layoutJson: unknown): CertificateLayout {
  if (
    layoutJson &&
    typeof layoutJson === "object" &&
    Array.isArray((layoutJson as { elements?: unknown }).elements)
  ) {
    return layoutJson as CertificateLayout;
  }
  return DEFAULT_CERTIFICATE_LAYOUT;
}
