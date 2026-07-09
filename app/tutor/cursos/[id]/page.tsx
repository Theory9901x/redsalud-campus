import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CourseForm } from "@/components/cursos/course-form";
import { CourseImageUploader } from "@/components/cursos/course-image-uploader";
import { ModuleLessonEditor } from "@/components/cursos/module-lesson-editor";
import { COURSE_STATUS_CLASSES, COURSE_STATUS_LABELS } from "@/components/cursos/labels";
import { updateCourseAction } from "@/app/admin/cursos/actions";

export default async function TutorCursoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const [course, categories] = await Promise.all([
    prisma.course.findUnique({
      where: { id },
      include: {
        modules: {
          orderBy: { sortOrder: "asc" },
          include: { lessons: { orderBy: { sortOrder: "asc" } } },
        },
        quizzes: {
          orderBy: { title: "asc" },
          include: { questions: { orderBy: { sortOrder: "asc" }, include: { options: { orderBy: { sortOrder: "asc" } } } } },
        },
      },
    }),
    prisma.courseCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  if (!course) notFound();
  if (session!.user.role !== "ADMIN" && course.tutorId !== session!.user.id) {
    redirect("/no-autorizado");
  }

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
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-extrabold text-foreground">{course.title}</h1>
          <Badge className={COURSE_STATUS_CLASSES[course.status]}>{COURSE_STATUS_LABELS[course.status]}</Badge>
          {course.status === "PUBLISHED" && (
            <Link
              href={`/cursos/${course.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Ver en el catálogo <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
        {course.status === "DRAFT" && (
          <p className="mt-2 text-sm text-muted-foreground">
            Este curso está en borrador. Un administrador debe publicarlo para que aparezca en el catálogo.
          </p>
        )}
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="temario">Temario</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <CourseImageUploader courseId={course.id} basePath="/tutor/cursos" imageUrl={course.imageUrl} />
          <div className="surface p-6">
            <CourseForm
              mode="edit"
              action={updateCourseAction.bind(null, course.id, "/tutor/cursos")}
              categories={categories}
              tutors={[]}
              isAdmin={false}
              submitLabel="Guardar cambios"
              defaultValues={{
                title: course.title,
                slug: course.slug,
                shortDescription: course.shortDescription,
                fullDescription: course.fullDescription ?? "",
                categoryId: course.categoryId ?? "",
                courseType: course.courseType,
                durationHours: course.durationHours,
                passingScore: course.passingScore,
                enrollmentMode: course.enrollmentMode,
                targetAudience: course.targetAudience,
                isSequential: course.isSequential,
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="temario">
          <ModuleLessonEditor courseId={course.id} initialModules={course.modules} initialQuizzes={course.quizzes} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
