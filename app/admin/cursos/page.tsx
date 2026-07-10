import Link from "next/link";
import { Plus, Tag } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CourseAdminTable } from "@/components/cursos/course-admin-table";
import { StaggerSections } from "@/components/brand/stagger-sections";
import { COURSE_TYPE_LABELS, COURSE_STATUS_LABELS } from "@/components/cursos/labels";
import type { Prisma, CourseStatus, CourseType } from "@prisma/client";

export default async function AdminCursosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string; estado?: string; tipo?: string }>;
}) {
  const { q, categoria, estado, tipo } = await searchParams;

  const where: Prisma.CourseWhereInput = {};
  if (q) where.title = { contains: q, mode: "insensitive" };
  if (categoria) where.categoryId = categoria;
  if (estado) where.status = estado as CourseStatus;
  if (tipo) where.courseType = tipo as CourseType;

  const [courses, categories] = await Promise.all([
    prisma.course.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        category: { select: { name: true } },
        tutor: { select: { fullName: true } },
        _count: { select: { modules: true, enrollments: true } },
      },
    }),
    prisma.courseCategory.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-foreground">Cursos</h1>
          <p className="text-sm text-muted-foreground">
            {courses.length} {courses.length === 1 ? "curso" : "cursos"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/cursos/categorias" className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}>
            <Tag className="h-4 w-4" />
            Categorías
          </Link>
          <Link
            href="/admin/cursos/nuevo"
            className={cn(buttonVariants(), "gap-1.5 bg-gradient-to-r from-primary to-teal-400 text-white hover:opacity-90")}
          >
            <Plus className="h-4 w-4" />
            Nuevo curso
          </Link>
        </div>
      </div>

      <StaggerSections className="space-y-6">
      <form method="get" className="surface-panel flex flex-wrap items-end gap-3 p-4">
        <div className="flex-1 min-w-[200px] space-y-1.5">
          <label htmlFor="q" className="text-xs font-medium text-muted-foreground">
            Buscar por título
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q ?? ""}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="categoria" className="text-xs font-medium text-muted-foreground">
            Categoría
          </label>
          <select
            id="categoria"
            name="categoria"
            defaultValue={categoria ?? ""}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Todas</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="tipo" className="text-xs font-medium text-muted-foreground">
            Tipo
          </label>
          <select
            id="tipo"
            name="tipo"
            defaultValue={tipo ?? ""}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Todos</option>
            {Object.entries(COURSE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="estado" className="text-xs font-medium text-muted-foreground">
            Estado
          </label>
          <select
            id="estado"
            name="estado"
            defaultValue={estado ?? ""}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Todos</option>
            {Object.entries(COURSE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className={cn(buttonVariants({ variant: "secondary" }))}
        >
          Filtrar
        </button>
        {(q || categoria || estado || tipo) && (
          <Link href="/admin/cursos" className={cn(buttonVariants({ variant: "ghost" }))}>
            Limpiar
          </Link>
        )}
      </form>

      <CourseAdminTable courses={courses} basePath="/admin/cursos" />
      </StaggerSections>
    </div>
  );
}
