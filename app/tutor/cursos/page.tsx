import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
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
      <div>
        <h1 className="font-display text-2xl font-extrabold text-foreground">Mis cursos</h1>
        <p className="text-sm text-muted-foreground">
          {courses.length} {courses.length === 1 ? "curso" : "cursos"} a tu cargo. Los cursos los crea y asigna el
          administrador; aquí gestionas su contenido.
        </p>
      </div>

      <CourseListTable courses={courses} basePath="/tutor/cursos" showTutorColumn={false} />
    </div>
  );
}
