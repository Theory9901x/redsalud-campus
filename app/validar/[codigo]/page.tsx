import { prisma } from "@/lib/prisma";
import { maskDocumentNumber } from "@/lib/certificates";
import { CertificateValidation } from "@/components/certificates/certificate-validation";

export default async function ValidarCodigoPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const certificateCode = decodeURIComponent(codigo).trim().toUpperCase();

  const [certificate, settings] = await Promise.all([
    prisma.certificate.findUnique({
      where: { certificateCode },
      include: {
        user: { select: { fullName: true, documentType: true, documentNumber: true } },
        course: { select: { title: true, courseType: true } },
      },
    }),
    prisma.institutionSettings.findUnique({ where: { id: "singleton" } }),
  ]);

  const institutionName = settings?.institutionName ?? "Red Salud Casanare E.S.E.";

  if (!certificate) {
    return (
      <CertificateValidation result={{ state: "not-found", searchedCode: certificateCode, institutionName }} />
    );
  }

  if (certificate.status === "REVOKED") {
    return (
      <CertificateValidation
        result={{ state: "revoked", certificateCode: certificate.certificateCode, institutionName }}
      />
    );
  }

  return (
    <CertificateValidation
      result={{
        state: "valid",
        certificateCode: certificate.certificateCode,
        studentName: certificate.user.fullName,
        documentType: certificate.user.documentType,
        documentNumber: maskDocumentNumber(certificate.user.documentNumber),
        courseTitle: certificate.course.title,
        courseType: certificate.course.courseType,
        issuedAtLabel: certificate.issuedAt.toLocaleDateString("es-CO", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        institutionName,
      }}
    />
  );
}
