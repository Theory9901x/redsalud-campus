import Link from "next/link";
import { Award, BookOpen, Clock, Download } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CourseGrid } from "@/components/cursos/course-grid";
import { CoursePosterCard } from "@/components/cursos/course-poster-card";
import { EmptyState } from "@/components/brand/empty-state";
import { ENROLLMENT_STATUS_LABELS, ENROLLMENT_STATUS_DOT } from "@/components/cursos/labels";

export default async function MiAulaPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [enrollments, certificates] = await Promise.all([
    prisma.enrollment.findMany({
      where: { userId, status: { not: "CANCELLED" } },
      orderBy: { enrolledAt: "desc" },
      include: { course: true },
    }),
    prisma.certificate.findMany({
      where: { userId, status: "VALID" },
      orderBy: { issuedAt: "desc" },
      include: { course: { select: { title: true } } },
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-10 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-foreground">Mi aula completa</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          El panorama completo de tu formación: cursos, avance y certificados.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold text-foreground">Mis cursos</h2>
        {enrollments.length === 0 ? (
          <EmptyState icon={BookOpen} title="Aún no tienes cursos" description="Inscríbete desde el catálogo para empezar." />
        ) : (
          <CourseGrid>
            {enrollments.map((enrollment) => (
              <CoursePosterCard
                key={enrollment.id}
                href={`/aula/${enrollment.courseId}`}
                imageUrl={enrollment.course.imageUrl}
                title={enrollment.course.title}
                courseType={enrollment.course.courseType}
                statusBadge={{
                  label: ENROLLMENT_STATUS_LABELS[enrollment.status],
                  dotClassName: ENROLLMENT_STATUS_DOT[enrollment.status],
                }}
                meta={[{ icon: Clock, label: `${enrollment.course.durationHours}h` }]}
                progress={enrollment.progressPercentage}
                progressLabel={`${enrollment.progressPercentage}% completado`}
              />
            ))}
          </CourseGrid>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-bold text-foreground">Mis certificados</h2>
        {certificates.length === 0 ? (
          <EmptyState
            icon={Award}
            title="Aún no tienes certificados"
            description="Se emiten automáticamente al completar un curso y aprobar sus evaluaciones."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {certificates.map((certificate) => (
              <div key={certificate.id} className="surface flex items-center gap-4 p-5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning-foreground">
                  <Award className="h-6 w-6" />
                </span>
                <div className="flex-1">
                  <p className="font-display text-sm font-bold text-foreground">{certificate.course.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {certificate.certificateCode} · {certificate.issuedAt.toLocaleDateString("es-CO")}
                  </p>
                </div>
                {certificate.pdfUrl && (
                  <Link
                    href={certificate.pdfUrl}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"
                  >
                    <Download className="h-4 w-4" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
