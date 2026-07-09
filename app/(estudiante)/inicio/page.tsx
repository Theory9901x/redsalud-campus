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
import { EcgPulse } from "@/components/brand/ecg-pulse";
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
      {/*
       * Momento signature 2: composición editorial asimétrica, no la banda
       * navy centrada de siempre. El pulso ECG atraviesa toda la sección como
       * protagonista (no un ícono de esquina) y se dibuja solo al cargar.
       */}
      <section className="relative isolate overflow-hidden rounded-3xl bg-navy px-6 py-12 text-white sm:px-10 sm:py-16 lg:py-20">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 8% -15%, color-mix(in oklch, var(--primary) 35%, transparent), transparent 55%), radial-gradient(circle at 100% 115%, color-mix(in oklch, var(--success) 22%, transparent), transparent 55%)",
          }}
        />
        <EcgPulse className="absolute inset-x-0 bottom-10 h-28 w-full text-primary/50 sm:bottom-14 sm:h-36 lg:h-44" />

        <div className="relative grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <div className="flex items-center gap-2 text-white/60">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em]">Campus virtual</span>
            </div>
            <h1 className="text-display-xl mt-3 font-display font-extrabold text-balance">
              Hola, {session!.user.name?.split(" ")[0]}.
            </h1>
            <p className="mt-4 max-w-lg text-base text-white/70">
              Este es tu espacio de formación institucional. Aquí verás tus cursos, tu avance y tus certificados.
            </p>
          </div>

          <div className="flex items-center gap-5 lg:col-span-4 lg:justify-end">
            <AvatarProgressRing name={session!.user.name ?? ""} avatarUrl={avatarUrl} progress={overallProgress} size={72} />
            <div className="flex flex-col gap-3 border-l border-white/15 pl-5">
              <div>
                <p className="font-display text-2xl font-extrabold leading-none">{activeCount}</p>
                <p className="mt-1 text-xs text-white/60">Activos</p>
              </div>
              <div>
                <p className="font-display text-2xl font-extrabold leading-none">{completedCount}</p>
                <p className="mt-1 text-xs text-white/60">Completados</p>
              </div>
              <div>
                <p className="font-display text-2xl font-extrabold leading-none">{certificateCount}</p>
                <p className="mt-1 text-xs text-white/60">Certificados</p>
              </div>
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
              <h2 className="text-display-md font-display font-extrabold text-foreground">Mis cursos</h2>
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
              <h2 className="text-display-md font-display font-extrabold text-foreground">Catálogo disponible</h2>
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
