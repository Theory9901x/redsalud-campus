import { prisma } from "@/lib/prisma";
import { generateCertificateCode, generateValidationHash } from "@/lib/certificate-code";
import { renderCertificatePdf } from "@/lib/certificate-pdf";
import { saveCertificatePdf, publicUploadDiskPath } from "@/lib/storage";
import { buildFieldValues, parseCertificateLayout } from "@/lib/certificate-template";
import { COURSE_TYPE_LABELS } from "@/components/cursos/labels";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Plantilla activa: la marcada `isDefault`, creándola con el diseño de fábrica si todavía no existe ninguna. */
async function getDefaultTemplate() {
  const existing = await prisma.certificateTemplate.findFirst({ where: { isDefault: true } });
  if (existing) return existing;
  return prisma.certificateTemplate.create({
    data: { name: "Plantilla institucional", isDefault: true },
  });
}

async function getTemplateForCertificate(templateId: string | null) {
  if (templateId) {
    const template = await prisma.certificateTemplate.findUnique({ where: { id: templateId } });
    if (template) return template;
  }
  return getDefaultTemplate();
}

async function renderAndSaveCertificate(certificate: {
  id: string;
  certificateCode: string;
  issuedAt: Date;
  templateId: string | null;
  user: { fullName: string; documentType: string; documentNumber: string };
  course: { title: string; courseType: keyof typeof COURSE_TYPE_LABELS; durationHours: number };
}) {
  const [settings, template] = await Promise.all([
    prisma.institutionSettings.findUnique({ where: { id: "singleton" } }),
    getTemplateForCertificate(certificate.templateId),
  ]);

  const fieldValues = buildFieldValues({
    fullName: certificate.user.fullName,
    documentType: certificate.user.documentType,
    documentNumber: certificate.user.documentNumber,
    courseTitle: certificate.course.title,
    courseTypeLabel: COURSE_TYPE_LABELS[certificate.course.courseType],
    durationHours: certificate.course.durationHours,
    city: settings?.city ?? "Yopal, Casanare",
    issuedAt: certificate.issuedAt,
    certificateCode: certificate.certificateCode,
    institutionName: settings?.institutionName ?? "Red Salud Casanare E.S.E.",
    signerName: settings?.signerName ?? null,
    signerPosition: settings?.signerPosition ?? null,
    certificateText: settings?.certificateText ?? null,
  });

  const pdfBuffer = await renderCertificatePdf({
    layout: parseCertificateLayout(template.layoutJson),
    fieldValues,
    backgroundDiskPath: template.backgroundImageUrl ? publicUploadDiskPath(template.backgroundImageUrl) : null,
    logoDiskPath: settings?.logoUrl ? publicUploadDiskPath(settings.logoUrl) : null,
    signatureDiskPath: settings?.signatureUrl ? publicUploadDiskPath(settings.signatureUrl) : null,
    validationUrl: `${APP_URL}/validar/${certificate.certificateCode}`,
  });

  await saveCertificatePdf(pdfBuffer, certificate.id);
  return template.id;
}

/**
 * Emite el certificado de una inscripción recién completada, si aún no
 * tiene uno. Se llama desde recalculateEnrollmentProgress justo cuando el
 * curso pasa a COMPLETED. Idempotente: si ya existe un certificado para
 * esta inscripción, no hace nada.
 */
export async function issueCertificateIfEligible(enrollmentId: string) {
  const existing = await prisma.certificate.findUnique({ where: { enrollmentId }, select: { id: true } });
  if (existing) return;

  const enrollment = await prisma.enrollment.findUniqueOrThrow({
    where: { id: enrollmentId },
    include: { user: true, course: true },
  });

  const certificateCode = await generateCertificateCode();
  const validationHash = generateValidationHash();

  // Se crea primero la fila (sin pdfUrl) para reservar el código único antes
  // de renderizar el PDF, que es lo más costoso y lo que más puede fallar.
  const certificate = await prisma.certificate.create({
    data: {
      userId: enrollment.userId,
      courseId: enrollment.courseId,
      enrollmentId: enrollment.id,
      certificateCode,
      validationHash,
    },
    include: { user: true, course: true },
  });

  const templateId = await renderAndSaveCertificate(certificate);

  await prisma.certificate.update({
    where: { id: certificate.id },
    data: { pdfUrl: `/api/certificados/${certificate.id}`, templateId },
  });
}

/** Vuelve a generar el archivo PDF de un certificado ya emitido (p. ej. si se perdió en disco o cambió la plantilla). */
export async function regenerateCertificatePdf(certificateId: string) {
  const certificate = await prisma.certificate.findUniqueOrThrow({
    where: { id: certificateId },
    include: { user: true, course: true },
  });

  await renderAndSaveCertificate(certificate);

  if (!certificate.pdfUrl) {
    await prisma.certificate.update({
      where: { id: certificate.id },
      data: { pdfUrl: `/api/certificados/${certificate.id}` },
    });
  }
}

/** Enmascara un número de documento dejando visibles solo los últimos 3 dígitos. */
export function maskDocumentNumber(documentNumber: string): string {
  const visible = documentNumber.slice(-3);
  const hidden = "•".repeat(Math.max(documentNumber.length - 3, 3));
  return `${hidden}${visible}`;
}
