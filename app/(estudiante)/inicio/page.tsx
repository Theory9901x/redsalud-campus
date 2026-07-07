import { Activity, GraduationCap, CheckCircle2, Award, BookOpen, Clock, Layers } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { StaggerGrid } from "@/components/brand/stagger-grid";
import { MetricCard } from "@/components/admin/metric-card";
import { CourseGrid } from "@/components/cursos/course-grid";
import { CoursePosterCard } from "@/components/cursos/course-poster-card";
import { CatalogFilters } from "@/components/public/catalog-filters";
import { EmptyState } from "@/components/brand/empty-state";
import { ConstellationPattern } from "@/components/brand/dot-pattern";
import { ENROLLMENT_STATUS_LABELS, ENROLLMENT_STATUS_DOT } from "@/components/cursos/labels";
import type { Prisma } from "@prisma/client";

export default async function InicioPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string }>;
}) {
  const session = await auth();
  const { q, categoria } = await searchParams;
  const userId = session!.user.id;

  const where: Prisma.CourseWhereInput = { status: "PUBLISHED" };
  if (q) where.title = { contains: q, mode: "insensitive" };
  if (categoria) where.categoryId = categoria;

  const [enrollments, availableCourses, categories, activeCount, completedCount, certificateCount] =
    await Promise.all([
      prisma.enrollment.findMany({
        where: { userId, status: { not: "CANCELLED" } },
        orderBy: { enrolledAt: "desc" },
        include: { course: { include: { category: { select: { name: true } } } } },
      }),
      prisma.course.findMany({
        where: { ...where, enrollments: { none: { userId, status: { not: "CANCELLED" } } } },
        orderBy: { publishedAt: "desc" },
        include: { category: { select: { name: true } } },
      }),
      prisma.courseCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      prisma.enrollment.count({ where: { userId, status: "ACTIVE" } }),
      prisma.enrollment.count({ where: { userId, status: "COMPLETED" } }),
      prisma.certificate.count({ where: { userId, status: "VALID" } }),
    ]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 space-y-10 px-4 py-8 sm:px-6">
      <section className="relative overflow-hidden rounded-3xl bg-navy px-6 py-8 text-white sm:px-10 sm:py-10">
        <ConstellationPattern className="text-primary/40" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(43,166,222,0.3),transparent_50%)]" />
        <div className="relative flex items-center gap-2 text-white/70">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wide">Campus virtual</span>
        </div>
        <h1 className="relative mt-2 font-display text-2xl font-extrabold sm:text-3xl">
          Hola, {session!.user.name?.split(" ")[0]}
        </h1>
        <p className="relative mt-1 max-w-lg text-sm text-white/70">
          Este es tu espacio de formación institucional. Aquí verás tus cursos, tu avance y tus certificados.
        </p>
      </section>

      <StaggerGrid className="grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Cursos activos" value={activeCount} icon={GraduationCap} accent="primary" />
        <MetricCard label="Completados" value={completedCount} icon={CheckCircle2} accent="success" />
        <MetricCard label="Certificados" value={certificateCount} icon={Award} accent="warning" />
      </StaggerGrid>

      <section className="space-y-4">
        <div>
          <h2 className="font-display text-xl font-bold text-foreground">Mis cursos</h2>
          <p className="mt-1 text-sm text-muted-foreground">Los cursos en los que estás inscrito.</p>
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
                ]}
                progress={enrollment.progressPercentage}
                progressLabel={`${enrollment.progressPercentage}% completado`}
              />
            ))}
          </CourseGrid>
        )}
      </section>

      <section className="space-y-5">
        <div className="text-center">
          <h2 className="font-display text-xl font-bold text-foreground">Catálogo disponible</h2>
          <p className="mt-1 text-sm text-muted-foreground">Cursos publicados por la institución.</p>
        </div>

        <CatalogFilters categories={categories} activeCategoria={categoria} q={q} basePath="/inicio" />

        {availableCourses.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No hay más cursos disponibles"
            description="Ya estás inscrito en todos los cursos publicados, o no hay resultados para tu búsqueda."
          />
        ) : (
          <CourseGrid>
            {availableCourses.map((course) => (
              <CoursePosterCard
                key={course.id}
                href={`/cursos/${course.slug}`}
                imageUrl={course.imageUrl}
                title={course.title}
                courseType={course.courseType}
                eyebrow={course.category?.name}
                meta={[
                  { icon: Clock, label: `${course.durationHours}h` },
                ]}
              />
            ))}
          </CourseGrid>
        )}
      </section>
    </main>
  );
}
