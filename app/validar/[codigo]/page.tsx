import Link from "next/link";
import { Activity, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { maskDocumentNumber } from "@/lib/certificates";
import { COURSE_TYPE_LABELS } from "@/components/cursos/labels";

export default async function ValidarCodigoPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const certificateCode = decodeURIComponent(codigo).trim().toUpperCase();

  const certificate = await prisma.certificate.findUnique({
    where: { certificateCode },
    include: {
      user: { select: { fullName: true, documentType: true, documentNumber: true } },
      course: { select: { title: true, courseType: true } },
    },
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center gap-2 border-b border-border bg-card px-4 py-3.5 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" strokeWidth={2.5} />
          <span className="font-display text-sm font-extrabold text-foreground">RedSalud Forma</span>
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-md space-y-5">
          {!certificate && (
            <div className="surface flex flex-col items-center gap-2 p-8 text-center">
              <HelpCircle className="h-12 w-12 text-muted-foreground" />
              <h1 className="font-display text-xl font-extrabold text-foreground">Certificado no encontrado</h1>
              <p className="text-sm text-muted-foreground">
                El código <span className="font-mono">{certificateCode}</span> no corresponde a ningún certificado
                emitido. Verifica que esté escrito exactamente como aparece en el documento.
              </p>
            </div>
          )}

          {certificate && certificate.status === "VALID" && (
            <div className="surface surface-accent-top space-y-4 p-8 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
              <div>
                <h1 className="font-display text-xl font-extrabold text-foreground">Certificado válido</h1>
                <p className="text-sm text-muted-foreground">Este certificado fue emitido por RedSalud Forma.</p>
              </div>
              <dl className="space-y-2 text-left text-sm">
                <div className="flex justify-between border-b border-border pb-2">
                  <dt className="text-muted-foreground">Nombre</dt>
                  <dd className="font-medium text-foreground">{certificate.user.fullName}</dd>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <dt className="text-muted-foreground">Documento</dt>
                  <dd className="font-medium text-foreground">
                    {certificate.user.documentType} {maskDocumentNumber(certificate.user.documentNumber)}
                  </dd>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <dt className="text-muted-foreground">Curso</dt>
                  <dd className="text-right font-medium text-foreground">{certificate.course.title}</dd>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <dt className="text-muted-foreground">Tipo</dt>
                  <dd className="font-medium text-foreground">{COURSE_TYPE_LABELS[certificate.course.courseType]}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Fecha de emisión</dt>
                  <dd className="font-medium text-foreground">
                    {certificate.issuedAt.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}
                  </dd>
                </div>
              </dl>
              <p className="font-mono text-xs text-muted-foreground">{certificate.certificateCode}</p>
            </div>
          )}

          {certificate && certificate.status === "REVOKED" && (
            <div className="surface flex flex-col items-center gap-2 p-8 text-center">
              <XCircle className="h-12 w-12 text-destructive" />
              <h1 className="font-display text-xl font-extrabold text-foreground">Certificado anulado</h1>
              <p className="text-sm text-muted-foreground">
                Este certificado (<span className="font-mono">{certificate.certificateCode}</span>) fue anulado por la
                institución y ya no es válido.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
