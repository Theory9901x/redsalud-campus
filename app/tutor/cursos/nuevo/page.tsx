import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { CourseForm } from "@/components/cursos/course-form";
import { createCourseAction } from "@/app/admin/cursos/actions";

export default async function NuevoCursoTutorPage() {
  const categories = await prisma.courseCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/tutor"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a mis cursos
        </Link>
        <h1 className="font-display text-2xl font-extrabold text-foreground">Nuevo curso</h1>
        <p className="text-sm text-muted-foreground">
          Se crea en borrador. Un administrador lo revisará y publicará cuando esté listo.
        </p>
      </div>

      <div className="surface max-w-3xl p-6">
        <CourseForm
          mode="create"
          action={createCourseAction.bind(null, "/tutor/cursos")}
          categories={categories}
          tutors={[]}
          isAdmin={false}
          submitLabel="Crear curso"
        />
      </div>
    </div>
  );
}
