import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toCsv, csvResponse } from "@/lib/csv";
import { CERTIFICATE_STATUS_LABELS } from "@/components/certificados/labels";
import type { CertificateStatus, Prisma } from "@prisma/client";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const estado = searchParams.get("estado") || undefined;

  const where: Prisma.CertificateWhereInput = {};
  if (estado) where.status = estado as CertificateStatus;
  if (desde || hasta) {
    where.issuedAt = {};
    if (desde) where.issuedAt.gte = new Date(`${desde}T00:00:00`);
    if (hasta) where.issuedAt.lte = new Date(`${hasta}T23:59:59`);
  }

  const certificates = await prisma.certificate.findMany({
    where,
    orderBy: { issuedAt: "desc" },
    include: { user: true, course: { select: { title: true } } },
  });

  const csv = toCsv(
    ["Código", "Estudiante", "Documento", "Curso", "Emitido", "Estado", "Anulado", "Motivo de anulación"],
    certificates.map((c) => [
      c.certificateCode,
      c.user.fullName,
      `${c.user.documentType} ${c.user.documentNumber}`,
      c.course.title,
      c.issuedAt.toLocaleDateString("es-CO"),
      CERTIFICATE_STATUS_LABELS[c.status],
      c.revokedAt ? c.revokedAt.toLocaleDateString("es-CO") : "",
      c.revokedReason ?? "",
    ])
  );

  return csvResponse("certificados.csv", csv);
}
