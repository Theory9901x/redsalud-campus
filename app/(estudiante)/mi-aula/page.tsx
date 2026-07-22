import Link from "next/link";
import { Award, BookOpen, Clock, Download, User } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CourseGrid } from "@/components/cursos/course-grid";
import { CoursePosterCard } from "@/components/cursos/course-poster-card";
import { EmptyState } from "@/components/brand/empty-state";
import { StaggerSections } from "@/components/brand/stagger-sections";
import { ENROLLMENT_STATUS_LABELS, ENROLLMENT_STATUS_DOT } from "@/components/cursos/labels";

export default async function MiAulaPage() {
  const session = await auth();
  const userId = session!.user.id;

  const [enrollments, certificates] = await Promise.all([
    prisma.enrollment.findMany({
      where: { userId, status: { not: "CANCELLED" } },
      orderBy: { enrolledAt: "desc" },
      include: { course: { include: { tutor: { select: { fullName: true } } } } },
    }),
    prisma.certificate.findMany({
      where: { userId, status: "VALID" },
      orderBy: { issuedAt: "desc" },
      include: { course: { select: { title: true } } },
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <StaggerSections className="space-y-10">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-foreground">Mi aula completa</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          El panorama completo de tu formación: cursos, avance y certificados.
        </p>
      </div>

      <section className="surface-panel p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/[0.07] blur-3xl" />
        <div className="relative space-y-4">
          <div className="flex items-center gap-3">
            <span className="h-8 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-primary to-success" />
            <h2 className="font-display text-2xl font-extrabold text-foreground">Mis cursos</h2>
          </div>
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
                  meta={[
                    { icon: Clock, label: `${enrollment.course.durationHours}h` },
                    { icon: User, label: enrollment.course.tutor.fullName },
                  ]}
                  progress={enrollment.progressPercentage}
                  progressLabel={`${enrollment.progressPercentage}% completado`}
                  ctaLabel={enrollment.status === "COMPLETED" ? "Revisar curso" : "Continuar"}
                />
              ))}
            </CourseGrid>
          )}
        </div>
      </section>

      <section id="mis-certificados" className="surface-panel scroll-mt-20 p-6 sm:p-8">
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-success/[0.07] blur-3xl" />
        <div className="relative space-y-4">
          <div className="flex items-center gap-3">
            <span className="h-8 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-primary to-success" />
            <h2 className="font-display text-2xl font-extrabold text-foreground">Mis certificados</h2>
          </div>
          {certificates.length === 0 ? (
            <EmptyState
              icon={Award}
              title="Aún no tienes certificados"
              description="Se emiten automáticamente al completar un curso y aprobar sus evaluaciones."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {certificates.map((certificate) => (
                <Link
                  key={certificate.id}
                  href={`/mi-aula/certificados/${certificate.id}`}
                  className="surface-clay flex items-center gap-4 p-5 transition-all duration-200 hover:-translate-y-0.5"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-warning/15 text-warning-foreground">
                    <Award className="h-6 w-6" />
                  </span>
                  <div className="flex-1">
                    <p className="font-display text-sm font-bold text-foreground">{certificate.course.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {certificate.certificateCode} · {certificate.issuedAt.toLocaleDateString("es-CO")}
                    </p>
                  </div>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Download className="h-4 w-4" />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
      </StaggerSections>
    </main>
  );
}
