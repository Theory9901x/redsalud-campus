import { Activity, GraduationCap, CheckCircle2, Award, BookOpen, Clock, User } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { StaggerGrid } from "@/components/brand/stagger-grid";
import { StaggerSections } from "@/components/brand/stagger-sections";
import { MetricCard } from "@/components/admin/metric-card";
import { CourseGrid } from "@/components/cursos/course-grid";
import { CoursePosterCard } from "@/components/cursos/course-poster-card";
import { CourseCatalogBrowser } from "@/components/cursos/course-catalog-browser";
import { AvatarProgressRing } from "@/components/student/avatar-progress-ring";
import { EmptyState } from "@/components/brand/empty-state";
import { ConstellationPattern } from "@/components/brand/dot-pattern";
import { ENROLLMENT_STATUS_LABELS, ENROLLMENT_STATUS_DOT } from "@/components/cursos/labels";
import { getUserAvatarUrl } from "@/lib/avatar";

export default async function InicioPage() {
  const session = await auth();
  const userId = session!.user.id;
  const personnelType = session!.user.personnelType;

  const [enrollments, availableCourses, categories, activeCount, completedCount, certificateCount, avatarUrl] =
    await Promise.all([
      prisma.enrollment.findMany({
        where: { userId, status: { not: "CANCELLED" } },
        orderBy: { enrolledAt: "desc" },
        include: {
          course: { include: { category: { select: { name: true } }, tutor: { select: { fullName: true } } } },
        },
      }),
      prisma.course.findMany({
        where: {
          status: "PUBLISHED",
          targetAudience: { in: [personnelType, "AMBOS"] },
          enrollments: { none: { userId, status: { not: "CANCELLED" } } },
        },
        orderBy: { publishedAt: "desc" },
        include: { category: { select: { id: true, name: true } }, tutor: { select: { fullName: true } } },
      }),
      prisma.courseCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      prisma.enrollment.count({ where: { userId, status: "ACTIVE" } }),
      prisma.enrollment.count({ where: { userId, status: "COMPLETED" } }),
      prisma.certificate.count({ where: { userId, status: "VALID" } }),
      getUserAvatarUrl(userId),
    ]);

  const overallProgress =
    enrollments.length > 0
      ? Math.round(enrollments.reduce((sum, e) => sum + e.progressPercentage, 0) / enrollments.length)
      : 0;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <StaggerSections className="space-y-10">
      <section className="relative overflow-hidden rounded-3xl bg-navy px-6 py-8 text-white sm:px-10 sm:py-10">
        <ConstellationPattern className="text-primary/40" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(43,166,222,0.3),transparent_50%)]" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <AvatarProgressRing name={session!.user.name ?? ""} avatarUrl={avatarUrl} progress={overallProgress} />

          <div className="flex-1">
            <div className="flex items-center gap-2 text-white/70">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wide">Campus virtual</span>
            </div>
            <h1 className="mt-2 font-display text-2xl font-extrabold sm:text-3xl">
              Hola, {session!.user.name?.split(" ")[0]}
            </h1>
            <p className="mt-1 max-w-lg text-sm text-white/70">
              Este es tu espacio de formación institucional. Aquí verás tus cursos, tu avance y tus certificados.
            </p>
          </div>

          <div className="flex gap-6 border-t border-white/15 pt-4 sm:border-l sm:border-t-0 sm:pl-8 sm:pt-0">
            <div>
              <p className="font-display text-2xl font-extrabold">{activeCount}</p>
              <p className="text-xs text-white/60">Activos</p>
            </div>
            <div>
              <p className="font-display text-2xl font-extrabold">{completedCount}</p>
              <p className="text-xs text-white/60">Completados</p>
            </div>
            <div>
              <p className="font-display text-2xl font-extrabold">{certificateCount}</p>
              <p className="text-xs text-white/60">Certificados</p>
            </div>
          </div>
        </div>
      </section>

      <StaggerGrid className="grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Cursos activos" value={activeCount} icon={GraduationCap} accent="primary" href="#mis-cursos" />
        <MetricCard label="Completados" value={completedCount} icon={CheckCircle2} accent="success" href="#mis-cursos" />
        <MetricCard label="Certificados" value={certificateCount} icon={Award} accent="warning" href="/mi-aula#mis-certificados" />
      </StaggerGrid>

      <section id="mis-cursos" className="surface-panel scroll-mt-20 p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/[0.07] blur-3xl" />
        <div className="relative space-y-5">
          <div className="flex items-center gap-3">
            <span className="h-8 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-primary to-success" />
            <div>
              <h2 className="font-display text-2xl font-extrabold text-foreground">Mis cursos</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Los cursos en los que estás inscrito.</p>
            </div>
          </div>

          {enrollments.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="Aún no tienes cursos asignados"
              description="Cuando un administrador te inscriba, o te inscribas en un curso abierto, aparecerán aquí con tu progreso."
            />
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
                />
              ))}
            </CourseGrid>
          )}
        </div>
      </section>

      <section className="surface-panel p-6 sm:p-8">
        <div className="pointer-events-none absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-success/[0.07] blur-3xl" />
        <div className="relative space-y-5">
          <div className="flex items-center gap-3">
            <span className="h-8 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-primary to-success" />
            <div>
              <h2 className="font-display text-2xl font-extrabold text-foreground">Catálogo disponible</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Cursos publicados por la institución.</p>
            </div>
          </div>

          {availableCourses.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No hay más cursos disponibles"
              description="Ya estás inscrito en todos los cursos publicados por la institución."
            />
          ) : (
            <CourseCatalogBrowser
              categories={categories.map((c) => ({ id: c.id, name: c.name }))}
              courses={availableCourses.map((course) => ({
                id: course.id,
                href: `/cursos/${course.slug}`,
                imageUrl: course.imageUrl,
                title: course.title,
                courseType: course.courseType,
                categoryId: course.category?.id ?? null,
                categoryName: course.category?.name ?? null,
                targetAudience: course.targetAudience,
                durationHours: course.durationHours,
                tutorName: course.tutor.fullName,
              }))}
            />
          )}
        </div>
      </section>
      </StaggerSections>
    </main>
  );
}
