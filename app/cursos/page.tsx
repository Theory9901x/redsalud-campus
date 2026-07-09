import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CourseCatalogBrowser } from "@/components/cursos/course-catalog-browser";
import type { Prisma } from "@prisma/client";

export default async function CatalogoCursosPage() {
  const session = await auth();

  // Visitante anónimo: ve todo el catálogo público. Usuario con sesión: solo
  // los cursos de su tipo de personal (o "Ambos"), igual que en su dashboard.
  const where: Prisma.CourseWhereInput = { status: "PUBLISHED" };
  if (session?.user) {
    where.targetAudience = { in: [session.user.personnelType, "AMBOS"] };
  }

  const [courses, categories] = await Promise.all([
    prisma.course.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      include: { category: { select: { id: true, name: true } }, tutor: { select: { fullName: true } } },
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
          <span className="bg-gradient-to-r from-primary to-success bg-clip-text text-transparent">
            formación institucional
          </span>{" "}
          en un solo lugar.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          Inducción, reinducción y capacitación del talento humano de Red Salud Casanare E.S.E.
        </p>
      </section>

      <CourseCatalogBrowser
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        courses={courses.map((course) => ({
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
    </div>
  );
}
