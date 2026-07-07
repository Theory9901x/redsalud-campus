import QRCode from "qrcode";
import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { publicUploadDiskPath } from "@/lib/storage";
import type { CertificateElement, CertificateFieldValues, CertificateLayout } from "@/lib/certificate-template";

export const CERTIFICATE_PAGE_WIDTH_PT = 841.89;
export const CERTIFICATE_PAGE_HEIGHT_PT = 595.28;

const styles = StyleSheet.create({
  page: { backgroundColor: "#FFFFFF" },
  frame: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderWidth: 3, borderColor: "#0F2438", margin: 24 },
  background: { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" },
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

function toDiskPath(publicUrlOrNull: string | null): string | null {
  if (!publicUrlOrNull) return null;
  return publicUploadDiskPath(publicUrlOrNull);
}

function CertificateDocument({
  layout,
  fieldValues,
  backgroundDiskPath,
  logoDiskPath,
  signatureDiskPath,
  qrDataUrl,
}: {
  layout: CertificateLayout;
  fieldValues: CertificateFieldValues;
  backgroundDiskPath: string | null;
  logoDiskPath: string | null;
  signatureDiskPath: string | null;
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
        <Image
          key={element.id ?? index}
          src={qrDataUrl}
          style={[styles.absolute, { ...position, width: `${element.sizePct}%`, height: `${heightPct}%` }]}
        />
      );
    }

    // image (logo / firma / custom)
    const src = element.kind === "logo" ? logoDiskPath : element.kind === "firma" ? signatureDiskPath : toDiskPath(element.src);
    if (!src) return null;
    return (
      <Image
        key={element.id ?? index}
        src={src}
        style={[styles.absolute, { ...position, width: `${element.widthPct}%`, height: `${element.heightPct}%`, objectFit: "contain" }]}
      />
    );
  }

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {backgroundDiskPath ? <Image src={backgroundDiskPath} style={styles.background} /> : <View style={styles.frame} />}
        {layout.elements.map(renderElement)}
      </Page>
    </Document>
  );
}

export async function renderCertificatePdf(input: RenderCertificateInput): Promise<Buffer> {
  const qrDataUrl = await QRCode.toDataURL(input.validationUrl, { margin: 1, width: 300 });
  return renderToBuffer(
    <CertificateDocument
      layout={input.layout}
      fieldValues={input.fieldValues}
      backgroundDiskPath={input.backgroundDiskPath}
      logoDiskPath={input.logoDiskPath}
      signatureDiskPath={input.signatureDiskPath}
      qrDataUrl={qrDataUrl}
    />
  );
}
