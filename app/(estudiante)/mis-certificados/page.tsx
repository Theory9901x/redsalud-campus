import Link from "next/link";
import { ArrowRight, Award, Download, QrCode, ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { StaggerSections } from "@/components/brand/stagger-sections";
import { EmptyState } from "@/components/brand/empty-state";

/**
 * Mis certificados: SOLO certificados, como una lista descriptiva sobre
 * vidrio. No repite cursos ni progreso —eso vive en Mi aula—; cada fila es un
 * certificado con su curso, código, fecha y las acciones para descargarlo o
 * validarlo con QR.
 */
export default async function MisCertificadosPage() {
  const session = await auth();
  const userId = session!.user.id;

  const certificados = await prisma.certificate.findMany({
    where: { userId, status: "VALID" },
    orderBy: { issuedAt: "desc" },
    include: { course: { select: { title: true, durationHours: true } } },
  });

  return (
    <main className="aula-canvas min-h-full">
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
        <StaggerSections className="space-y-6">
          {/* Encabezado */}
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning-foreground">
              <Award className="h-5 w-5" />
            </span>
            <div>
              <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-tight text-foreground">
                Mis certificados
              </h1>
              <p className="text-[13px] text-muted-foreground">
                {certificados.length === 0
                  ? "Aún no tienes certificados."
                  : `${certificados.length} ${certificados.length === 1 ? "certificado emitido" : "certificados emitidos"}, verificables con código QR.`}
              </p>
            </div>
          </div>

          {certificados.length === 0 ? (
            <EmptyState
              icon={Award}
              title="Aún no tienes certificados"
              description="Completa un curso y aprueba sus evaluaciones para obtener tu primer certificado verificable."
            />
          ) : (
            // Lista glassmorfismo: cada certificado es una fila de vidrio.
            <ul className="space-y-3">
              {certificados.map((c) => (
                <li
                  key={c.id}
                  className="surface-glass flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-warning/30 to-warning/10 text-warning-foreground">
                    <Award className="h-6 w-6" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-[16px] font-bold leading-snug text-foreground">
                      {c.course.title}
                    </h2>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
                      <span className="font-mono">{c.certificateCode}</span>
                      <span className="h-3 w-px bg-border" />
                      <span>Emitido el {c.issuedAt.toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" })}</span>
                      <span className="h-3 w-px bg-border" />
                      <span>{c.course.durationHours} h</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/mi-aula/certificados/${c.id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 py-2 text-[12.5px] font-semibold text-foreground transition-colors hover:border-[var(--accent)]/40"
                    >
                      <Download className="h-3.5 w-3.5" /> Descargar
                    </Link>
                    <Link
                      href={`/validar/${c.certificateCode}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <QrCode className="h-3.5 w-3.5" /> Validar
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between border-t border-border pt-4 text-[12.5px] text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[var(--accent)]/70" />
              Cada certificado es verificable públicamente con su código.
            </span>
            <Link href="/mi-aula" className="inline-flex items-center gap-1.5 text-[var(--accent)] hover:underline">
              Ir a mi aula <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </StaggerSections>
      </div>
    </main>
  );
}
