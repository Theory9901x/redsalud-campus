import "dotenv/config";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { parseCertificateLayout, SAMPLE_FIELD_VALUES, type CertificateLayout } from "../lib/certificate-template";
import { renderCertificatePdf } from "../lib/certificate-pdf";
import { publicUploadDiskPath, privateMediaDiskPath } from "../lib/storage";
import { regenerateCertificatePdf } from "../lib/certificates";
import { certificateLayoutSchema } from "../lib/validations/certificate-template";

const CARGO = "PROFESIONAL UNIVERSITARIO TALENTO HUMANO";

/** Previsualiza la firma extraída del PDF; --aplicar configura y regenera las constancias existentes. */
async function main() {
  const [signaturePath, outputDir] = process.argv.slice(2);
  if (!signaturePath || !outputDir) throw new Error("Indica la firma PNG extraída del PDF y la carpeta de respaldo/previsualización.");
  const signature = await readFile(signaturePath);
  if (!signature.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error("La firma debe ser un PNG válido.");
  const settings = await prisma.institutionSettings.findUniqueOrThrow({ where: { id: "singleton" } });
  const template = await prisma.certificateTemplate.findFirstOrThrow({ where: { isDefault: true } });
  const current = parseCertificateLayout(template.layoutJson);
  const layout: CertificateLayout = { elements: current.elements.filter((e) => e.id !== "cargo-firmante" && e.id !== "qr-ayuda").map((e) => {
    if (e.type === "text" && e.fieldKey === "nombreCompleto") return { ...e, x: 19.4, y: 39.7, widthPct: 61.1, fontSize: 18, fontFamily: "Helvetica-Bold" };
    if (e.type === "text" && e.fieldKey === "curso") return { ...e, y: 61.4, fontSize: 17, fontFamily: "Helvetica-Bold" };
    if (e.type === "image" && e.kind === "firma") return { ...e, x: 39.5, y: 76.7, widthPct: 20, heightPct: 7.3 };
    return e;
  }) };
  if (!layout.elements.some((e) => e.type === "image" && e.kind === "firma")) throw new Error("La plantilla no contiene un espacio para la firma.");
  layout.elements.push(
    { id: "cargo-firmante", type: "text", fieldKey: "cargoFirmante", x: 27, y: 89.2, widthPct: 45, fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#0F2438", align: "center" },
    { id: "qr-ayuda", type: "static", text: "VERIFICA ESTA CONSTANCIA", x: 6, y: 92, widthPct: 16, fontSize: 6.5, fontFamily: "Helvetica", color: "#233E8F", align: "center" },
  );
  certificateLayoutSchema.parse(layout);
  await mkdir(outputDir, { recursive: true });
  const preview = await renderCertificatePdf({
    layout, fieldValues: { ...SAMPLE_FIELD_VALUES, nombreCompleto: "María Fernanda Rodríguez Pérez", curso: "Inducción y reinducción", intensidadHoraria: "40 horas", fecha: "29 de octubre de 2026", cargoFirmante: CARGO },
    backgroundDiskPath: template.backgroundImageUrl ? publicUploadDiskPath(template.backgroundImageUrl) : null,
    logoDiskPath: settings.logoUrl ? publicUploadDiskPath(settings.logoUrl) : null,
    signatureDiskPath: signaturePath,
    validationUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://campusvirtual.redsaludteforma.com"}/validar/RSC-EJEMPLO`,
  });
  await writeFile(path.join(outputDir, "vista-previa-constancia.pdf"), preview);
  console.log("Vista previa generada; firma y cargo incluidos.");
  if (!process.argv.includes("--aplicar")) return;

  const certificates = await prisma.certificate.findMany({ where: { course: { courseType: { in: ["INDUCCION", "REINDUCCION"] } } }, select: { id: true, certificateCode: true, status: true } });
  // Conserva tanto la configuración anterior como cada PDF, antes de sustituirlos.
  await writeFile(path.join(outputDir, "configuracion-anterior.json"), JSON.stringify({ settings, template, certificates }, null, 2), { flag: "wx" });
  for (const c of certificates) await copyFile(privateMediaDiskPath("certificates", `${c.id}.pdf`), path.join(outputDir, `${c.id}-anterior.pdf`));
  const signatureUrl = "/uploads/institucion/firma/firma-constancia-talento-humano-20261029.png";
  const target = publicUploadDiskPath(signatureUrl);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, signature);
  await prisma.$transaction([
    prisma.institutionSettings.update({ where: { id: "singleton" }, data: { signatureUrl, signerPosition: CARGO } }),
    prisma.certificateTemplate.update({ where: { id: template.id }, data: { layoutJson: JSON.parse(JSON.stringify(layout)) } }),
  ]);
  for (const c of certificates) {
    await regenerateCertificatePdf(c.id);
    console.log(`Constancia actualizada: ${c.certificateCode} (${c.status}).`);
  }
  console.log(`Firma configurada para futuras emisiones y ${certificates.length} PDF existentes actualizados.`);
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
