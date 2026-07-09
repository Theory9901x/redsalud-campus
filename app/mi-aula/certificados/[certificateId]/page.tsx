import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CertificateReveal } from "@/components/certificates/certificate-reveal";
import { COURSE_TYPE_LABELS } from "@/components/cursos/labels";

export default async function CertificateRevealPage({
  params,
  searchParams,
}: {
  params: Promise<{ certificateId: string }>;
  searchParams: Promise<{ justIssued?: string }>;
}) {
  const { certificateId } = await params;
  const { justIssued } = await searchParams;

  const session = await auth();
  if (!session?.user) redirect("/login");

  const [certificate, settings] = await Promise.all([
    prisma.certificate.findUnique({
      where: { id: certificateId },
      include: { user: { select: { fullName: true } }, course: { select: { title: true, courseType: true, durationHours: true } } },
    }),
    prisma.institutionSettings.findUnique({ where: { id: "singleton" } }),
  ]);

  if (!certificate) notFound();
  const isOwner = certificate.userId === session.user.id;
  const isAdmin = session.user.role === "ADMIN";
  if (!isOwner && !isAdmin) notFound();

  return (
    <CertificateReveal
      justIssued={justIssued === "1"}
      certificateCode={certificate.certificateCode}
      issuedAt={certificate.issuedAt.toISOString()}
      status={certificate.status}
      studentName={certificate.user.fullName}
      courseTitle={certificate.course.title}
      courseTypeLabel={COURSE_TYPE_LABELS[certificate.course.courseType]}
      courseType={certificate.course.courseType}
      durationHours={certificate.course.durationHours}
      institutionName={settings?.institutionName ?? "Red Salud Casanare E.S.E."}
      pdfUrl={certificate.pdfUrl ?? `/api/certificados/${certificate.id}`}
      validationUrl={`/validar/${certificate.certificateCode}`}
    />
  );
}
