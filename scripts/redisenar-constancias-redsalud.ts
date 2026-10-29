import "dotenv/config";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "../lib/prisma";
import { REDSALUD_CERTIFICATE_BACKGROUND_URL, REDSALUD_CERTIFICATE_LAYOUT, redSaludCertificateSvg } from "../lib/certificate-redsalud-design";
import { SAMPLE_FIELD_VALUES } from "../lib/certificate-template";
import { renderCertificatePdf } from "../lib/certificate-pdf";
import { regenerateCertificatePdf } from "../lib/certificates";
import { privateMediaDiskPath, publicUploadDiskPath } from "../lib/storage";
import { certificateLayoutSchema } from "../lib/validations/certificate-template";

/**
 * Previsualización local sin BD:
 * npx tsx scripts/redisenar-constancias-redsalud.ts CARPETA LOGO.png FIRMA.png --local
 * En servidor: npx tsx scripts/redisenar-constancias-redsalud.ts CARPETA [--aplicar]
 * --aplicar respalda configuración y PDFs antes de activar el diseño original.
 */
async function main() {
  const args = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  const [outputDir, localLogo, localSignature] = args;
  const local = process.argv.includes("--local");
  if (!outputDir || (local && (!localLogo || !localSignature))) throw new Error("Indica la carpeta de salida y, en modo local, el logo y la firma.");
  if (local && process.argv.includes("--aplicar")) throw new Error("El modo local solo genera vistas previas.");
  const settings = local ? null : await prisma.institutionSettings.findUniqueOrThrow({ where: { id: "singleton" } });
  if (!local && (!settings?.logoUrl || !settings.signatureUrl)) throw new Error("Configura primero el logo y la firma institucionales.");
  const logoPath = local ? localLogo : publicUploadDiskPath(settings!.logoUrl!);
  const signaturePath = local ? localSignature : publicUploadDiskPath(settings!.signatureUrl!);
  const logo = await readFile(logoPath);
  await readFile(signaturePath); // Impide publicar una plantilla con firma ausente.
  const svg = redSaludCertificateSvg(`data:image/png;base64,${logo.toString("base64")}`);
  certificateLayoutSchema.parse(REDSALUD_CERTIFICATE_LAYOUT);
  await mkdir(outputDir, { recursive: true });
  const backgroundPath = path.join(outputDir, path.basename(REDSALUD_CERTIFICATE_BACKGROUND_URL));
  await writeFile(backgroundPath.replace(/\.png$/, ".svg"), svg);
  await sharp(Buffer.from(svg)).png().toFile(backgroundPath);
  const preview = await renderCertificatePdf({
    layout: REDSALUD_CERTIFICATE_LAYOUT,
    fieldValues: {
      ...SAMPLE_FIELD_VALUES,
      nombreCompleto: "María Fernanda Rodríguez Pérez", tipoDocumento: "CC", numeroDocumento: "1234567890",
      curso: "Inducción y reinducción", intensidadHoraria: "40 horas", fecha: "29 de octubre de 2026",
      cargoFirmante: "PROFESIONAL UNIVERSITARIO TALENTO HUMANO",
    },
    backgroundDiskPath: backgroundPath, signatureDiskPath: signaturePath, logoDiskPath: null,
    validationUrl: "https://campusvirtual.redsaludteforma.com/validar/RSC-EJEMPLO",
  });
  await writeFile(path.join(outputDir, "constancia-redsalud-vista-previa.pdf"), preview);
  console.log("Vista previa generada con el logo, marca de agua, sello institucional, firma y QR de RedSalud.");
  if (!process.argv.includes("--aplicar")) return;

  const template = await prisma.certificateTemplate.findFirstOrThrow({ where: { isDefault: true } });
  const certificates = await prisma.certificate.findMany({
    where: { course: { courseType: { in: ["INDUCCION", "REINDUCCION"] } }, OR: [{ templateId: template.id }, { templateId: null }] },
    select: { id: true, certificateCode: true, status: true, issuedAt: true, validationHash: true },
  });
  await writeFile(path.join(outputDir, "configuracion-anterior.json"), JSON.stringify({ template, settings, certificates }, null, 2), { flag: "wx" });
  for (const c of certificates) await copyFile(privateMediaDiskPath("certificates", `${c.id}.pdf`), path.join(outputDir, `${c.id}-anterior.pdf`));
  const backgroundImageUrl = REDSALUD_CERTIFICATE_BACKGROUND_URL;
  await mkdir(path.dirname(publicUploadDiskPath(backgroundImageUrl)), { recursive: true });
  await copyFile(backgroundPath, publicUploadDiskPath(backgroundImageUrl));
  await prisma.certificateTemplate.update({
    where: { id: template.id }, data: { backgroundImageUrl, layoutJson: JSON.parse(JSON.stringify(REDSALUD_CERTIFICATE_LAYOUT)) },
  });
  for (const c of certificates) await regenerateCertificatePdf(c.id);
  const after = await prisma.certificate.findMany({
    where: { id: { in: certificates.map((c) => c.id) } },
    select: { id: true, certificateCode: true, status: true, issuedAt: true, validationHash: true },
  });
  for (const c of certificates) {
    if (JSON.stringify(after.find((row) => row.id === c.id)) !== JSON.stringify(c)) throw new Error("Cambió un dato de validación de una constancia.");
  }
  console.log(`Diseño activo. ${certificates.length} constancias actualizadas; códigos, fechas, hashes y estados conservados.`);
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
