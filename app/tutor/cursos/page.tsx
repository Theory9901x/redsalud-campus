import Link from "next/link";
import { Plus } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CourseListTable } from "@/components/cursos/course-list-table";

export default async function TutorCursosPage() {
  const session = await auth();
  const tutorId = session!.user.id;

  const courses = await prisma.course.findMany({
    where: { tutorId },
    orderBy: { createdAt: "desc" },
    include: {
      category: { select: { name: true } },
      tutor: { select: { fullName: true } },
      _count: { select: { modules: true, enrollments: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-foreground">Mis cursos</h1>
          <p className="text-sm text-muted-foreground">
            {courses.length} {courses.length === 1 ? "curso" : "cursos"}. Solo un administrador puede publicarlos.
          </p>
        </div>
        <Link href="/tutor/cursos/nuevo" className={cn(buttonVariants(), "gap-1.5")}>
          <Plus className="h-4 w-4" />
          Nuevo curso
        </Link>
      </div>

      <CourseListTable courses={courses} basePath="/tutor/cursos" showTutorColumn={false} />
    </div>
  );
}
