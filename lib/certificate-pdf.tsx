import { readFile } from "node:fs/promises";
import type { ComponentProps, ComponentType } from "react";
import QRCode from "qrcode";
import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { publicUploadDiskPath } from "@/lib/storage";
import type { CertificateElement, CertificateFieldValues, CertificateLayout } from "@/lib/certificate-template";

// El tipo `ImageProps` de esta versión de @react-pdf/renderer no declara `wrap`,
// aunque el layout SÍ lo lee en runtime para cualquier tipo de nodo (ver
// getWrap() en @react-pdf/layout). Es un hueco en los .d.ts, no una
// restricción real: se completa el tipo en vez de silenciar con `any`.
const ImageEl = Image as unknown as ComponentType<ComponentProps<typeof Image> & { wrap?: boolean }>;

export const CERTIFICATE_PAGE_WIDTH_PT = 841.89;
export const CERTIFICATE_PAGE_HEIGHT_PT = 595.28;

// Yoga (el motor de layout de react-pdf) calcula internamente en float32,
// pero el chequeo de "¿cabe en la página?" compara contra el alto/ancho de
// página como número JS normal (float64). 595.28 no es representable
// exactamente en float32: al pasar por Yoga, el alto medido del fondo se
// redondea a 595.280029296875, un pelo MÁS GRANDE que el 595.28 exacto con el
// que se compara. Esa diferencia de ~0.00003pt basta para que el fondo se
// considere "más grande que la página" y dispare el paginador de Yoga →
// primera página en blanco y el resto del contenido empujado a una segunda
// página. Restar un margen imperceptible (bien por encima del ruido de
// redondeo de float32) evita el falso positivo sin que se note visualmente.
const PAGE_SIZE_SAFETY_MARGIN_PT = 0.5;

const styles = StyleSheet.create({
  page: { backgroundColor: "#FFFFFF" },
  frame: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderWidth: 3, borderColor: "#0F2438", margin: 24 },
  background: {
    position: "absolute",
    top: 0,
    left: 0,
    width: CERTIFICATE_PAGE_WIDTH_PT - PAGE_SIZE_SAFETY_MARGIN_PT,
    height: CERTIFICATE_PAGE_HEIGHT_PT - PAGE_SIZE_SAFETY_MARGIN_PT,
    objectFit: "cover",
  },
  absolute: { position: "absolute" },
});

export type RenderCertificateInput = {
  layout: CertificateLayout;
  fieldValues: CertificateFieldValues;
  backgroundDiskPath: string | null;
  logoDiskPath: string | null;
  signatureDiskPath: string | null;
  validationUrl: string;
};

/**
 * @react-pdf/image resuelve cualquier `src` de tipo string con `url.parse()`
 * para decidir si es un archivo local o algo que debe "fetchear". En Windows,
 * una ruta absoluta como "D:\...\archivo.png" hace que esa función interprete
 * la letra de unidad ("D:") como si fuera el protocolo de una URL, así que
 * nunca la reconoce como ruta local: cae al branch de fetch(), que revienta
 * con "fetch failed" porque no es una URL válida. La imagen nunca carga, y el
 * nodo IMAGE sin dimensiones resueltas hace que el layout de Yoga la trate
 * como si no cupiera en la página, produciendo la primera página en blanco y
 * el contenido corrido a una segunda página.
 *
 * La solución robusta (funciona igual en Windows y Linux) es no dejar que
 * react-pdf resuelva la ruta: leemos el archivo nosotros mismos y pasamos el
 * Buffer directamente como `src`. `resolveImage` de @react-pdf/image detecta
 * `Buffer.isBuffer(src)` antes que cualquier lógica de URL/fetch.
 */
async function readImageBuffer(diskPath: string | null): Promise<Buffer | null> {
  if (!diskPath) return null;
  try {
    return await readFile(diskPath);
  } catch (error) {
    console.error(`No se pudo leer la imagen del certificado en disco: ${diskPath}`, error);
    return null;
  }
}

function toDiskPath(publicUrlOrNull: string | null): string | null {
  if (!publicUrlOrNull) return null;
  return publicUploadDiskPath(publicUrlOrNull);
}

function CertificateDocument({
  layout,
  fieldValues,
  backgroundImage,
  logoImage,
  signatureImage,
  customImages,
  qrDataUrl,
}: {
  layout: CertificateLayout;
  fieldValues: CertificateFieldValues;
  backgroundImage: Buffer | null;
  logoImage: Buffer | null;
  signatureImage: Buffer | null;
  customImages: Map<string, Buffer>;
  qrDataUrl: string;
}) {
  function renderElement(element: CertificateElement, index: number) {
    const position = { left: `${element.x}%`, top: `${element.y}%` };

    if (element.type === "static" || element.type === "text") {
      const text = element.type === "static" ? element.text : fieldValues[element.fieldKey] ?? "";
      if (!text) return null;
      return (
        <Text
          key={element.id ?? index}
          wrap={false}
          style={[
            styles.absolute,
            {
              ...position,
              width: `${element.widthPct}%`,
              fontSize: element.fontSize,
              fontFamily: element.fontFamily,
              color: element.color,
              textAlign: element.align,
            },
          ]}
        >
          {text}
        </Text>
      );
    }

    if (element.type === "qr") {
      // La página no es cuadrada: 1% del ancho ≠ 1% del alto. Sin este ajuste
      // el QR sale estirado y puede fallar al escanear.
      const heightPct = element.sizePct * (CERTIFICATE_PAGE_WIDTH_PT / CERTIFICATE_PAGE_HEIGHT_PT);
      return (
        <ImageEl
          key={element.id ?? index}
          src={qrDataUrl}
          wrap={false}
          style={[styles.absolute, { ...position, width: `${element.sizePct}%`, height: `${heightPct}%` }]}
        />
      );
    }

    // image (logo / firma / custom)
    let src: Buffer | null;
    if (element.kind === "logo") src = logoImage;
    else if (element.kind === "firma") src = signatureImage;
    else src = element.src ? customImages.get(element.src) ?? null : null;

    if (!src) return null;
    return (
      <ImageEl
        key={element.id ?? index}
        src={src}
        wrap={false}
        style={[styles.absolute, { ...position, width: `${element.widthPct}%`, height: `${element.heightPct}%`, objectFit: "contain" }]}
      />
    );
  }

  return (
    <Document>
      {/*
       * wrap={false} en TODOS los elementos: por defecto react-pdf marca cada
       * nodo como "puede partirse entre páginas" (getWrap() en
       * @react-pdf/layout devuelve true salvo que se indique lo contrario).
       * Este certificado es una plantilla de una sola página con elementos
       * absolutamente posicionados; ninguno debe generar una página nueva. Sin
       * esto, la imagen de fondo (y cualquier texto largo) puede disparar el
       * paginador de Yoga y producir una página en blanco/duplicada en vez de
       * simplemente desbordar visualmente si el contenido es más largo de lo
       * esperado (p. ej. un nombre muy largo).
       */}
      <Page size="A4" orientation="landscape" style={styles.page}>
        {backgroundImage ? (
          <ImageEl src={backgroundImage} wrap={false} style={styles.background} />
        ) : (
          <View wrap={false} style={styles.frame} />
        )}
        {layout.elements.map(renderElement)}
      </Page>
    </Document>
  );
}

export async function renderCertificatePdf(input: RenderCertificateInput): Promise<Buffer> {
  const customImagePublicUrls = [
    ...new Set(
      input.layout.elements
        .filter((el): el is Extract<CertificateElement, { type: "image" }> => el.type === "image" && el.kind === "custom")
        .map((el) => el.src)
        .filter((src): src is string => !!src)
    ),
  ];

  const [qrDataUrl, backgroundImage, logoImage, signatureImage, customImageEntries] = await Promise.all([
    QRCode.toDataURL(input.validationUrl, { margin: 1, width: 300 }),
    readImageBuffer(input.backgroundDiskPath),
    readImageBuffer(input.logoDiskPath),
    readImageBuffer(input.signatureDiskPath),
    Promise.all(
      customImagePublicUrls.map(async (publicUrl) => [publicUrl, await readImageBuffer(toDiskPath(publicUrl))] as const)
    ),
  ]);

  const customImages = new Map<string, Buffer>();
  for (const [publicUrl, buffer] of customImageEntries) {
    if (buffer) customImages.set(publicUrl, buffer);
  }

  return renderToBuffer(
    <CertificateDocument
      layout={input.layout}
      fieldValues={input.fieldValues}
      backgroundImage={backgroundImage}
      logoImage={logoImage}
      signatureImage={signatureImage}
      customImages={customImages}
      qrDataUrl={qrDataUrl}
    />
  );
}
