import Link from "next/link";
import { Plus, Tag } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CourseAdminTable } from "@/components/cursos/course-admin-table";
import { StaggerSections } from "@/components/brand/stagger-sections";
import { AdminPageHeader } from "@/components/admin/page-header";
import { TablePagination } from "@/components/admin/table-pagination";
import { AutoSearchInput, AutoFilterSelect } from "@/components/admin/auto-search-input";
import { parsePageSize } from "@/lib/pagination";
import { COURSE_TYPE_LABELS, COURSE_STATUS_LABELS } from "@/components/cursos/labels";
import type { Prisma, CourseStatus, CourseType } from "@prisma/client";

export default async function AdminCursosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string; estado?: string; tipo?: string; page?: string; pageSize?: string }>;
}) {
  const { q, categoria, estado, tipo, page: pageParam, pageSize: pageSizeParam } = await searchParams;
  const pageSize = parsePageSize(pageSizeParam);
  const page = Math.max(1, Number(pageParam) || 1);

  const where: Prisma.CourseWhereInput = {};
  if (q) where.title = { contains: q, mode: "insensitive" };
  if (categoria) where.categoryId = categoria;
  if (estado) where.status = estado as CourseStatus;
  if (tipo) where.courseType = tipo as CourseType;

  const [courses, categories, totalCourses] = await Promise.all([
    prisma.course.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        category: { select: { name: true } },
        tutor: { select: { fullName: true } },
        _count: { select: { modules: true, enrollments: true } },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.courseCategory.findMany({ orderBy: { name: "asc" } }),
    prisma.course.count({ where }),
  ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Cursos"
        description={`${courses.length} ${courses.length === 1 ? "curso" : "cursos"}`}
        action={
          <>
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
          </>
        }
      />

      <StaggerSections className="space-y-6">
      {/* Filtros automáticos: sin botón. */}
      <div className="surface-panel flex flex-wrap items-end gap-3 p-4">
        <AutoSearchInput label="Buscar curso" placeholder="Nombre del curso..." />
        <AutoFilterSelect paramName="categoria" label="Categoría" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
        <AutoFilterSelect paramName="tipo" label="Tipo" options={Object.entries(COURSE_TYPE_LABELS).map(([value, label]) => ({ value, label }))} />
        <AutoFilterSelect paramName="estado" label="Estado" options={Object.entries(COURSE_STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
      </div>

      <div>
        <CourseAdminTable courses={courses} basePath="/admin/cursos" />
        <div className="surface-glass mt-0 rounded-t-none border-t-0">
          <TablePagination total={totalCourses} page={page} pageSize={pageSize} />
        </div>
      </div>
      </StaggerSections>
    </div>
  );
}
