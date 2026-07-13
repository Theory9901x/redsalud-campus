import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { CourseForm } from "@/components/cursos/course-form";
import { createCourseAction } from "@/app/admin/cursos/actions";
import { AdminPageHeader } from "@/components/admin/page-header";

export default async function NuevoCursoPage() {
  const [categories, tutors] = await Promise.all([
    prisma.courseCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { role: { in: ["TUTOR", "ADMIN"] }, status: "ACTIVE" },
      orderBy: { fullName: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/cursos"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a cursos
        </Link>
        <AdminPageHeader
          title="Nuevo curso"
          description="Se crea en borrador. Podrás añadir módulos y lecciones después de guardarlo."
        />
      </div>

      <div className="surface max-w-3xl p-6">
        <CourseForm
          mode="create"
          action={createCourseAction.bind(null, "/admin/cursos")}
          categories={categories}
          tutors={tutors}
          isAdmin
          submitLabel="Crear curso"
        />
      </div>
    </div>
  );
}
