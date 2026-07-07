import { Clock, Layers } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { CourseGrid } from "@/components/cursos/course-grid";
import { CoursePosterCard } from "@/components/cursos/course-poster-card";
import { CatalogFilters } from "@/components/public/catalog-filters";
import { EmptyState } from "@/components/brand/empty-state";
import type { Prisma } from "@prisma/client";

export default async function CatalogoCursosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string }>;
}) {
  const { q, categoria } = await searchParams;

  const where: Prisma.CourseWhereInput = { status: "PUBLISHED" };
  if (q) where.title = { contains: q, mode: "insensitive" };
  if (categoria) where.categoryId = categoria;

  const [courses, categories] = await Promise.all([
    prisma.course.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      include: { category: { select: { name: true } } },
    }),
    prisma.courseCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-10">
      <section className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Plataforma oficial · RedSalud Casanare E.S.E.
        </span>
        <h1 className="mx-auto mt-4 max-w-2xl font-display text-3xl font-extrabold tracking-tight text-navy sm:text-4xl">
          Todo tu proceso de{" "}
          <span className="bg-gradient-to-r from-primary to-teal-400 bg-clip-text text-transparent">
            formación institucional
          </span>{" "}
          en un solo lugar.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          Inducción, reinducción y capacitación del talento humano de Red Salud Casanare E.S.E.
        </p>
      </section>

      <CatalogFilters categories={categories} activeCategoria={categoria} q={q} basePath="/cursos" />

      {courses.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Todavía no hay cursos publicados"
          description="Vuelve pronto — la institución está preparando nuevos cursos."
        />
      ) : (
        <CourseGrid>
          {courses.map((course) => (
            <CoursePosterCard
              key={course.id}
              href={`/cursos/${course.slug}`}
              imageUrl={course.imageUrl}
              title={course.title}
              courseType={course.courseType}
              eyebrow={course.category?.name}
              meta={[{ icon: Clock, label: `${course.durationHours}h` }]}
            />
          ))}
        </CourseGrid>
      )}
    </div>
  );
}
