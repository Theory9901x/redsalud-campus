import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CourseForm } from "@/components/cursos/course-form";
import { CourseImageUploader } from "@/components/cursos/course-image-uploader";
import { ModuleLessonEditor } from "@/components/cursos/module-lesson-editor";
import { CoursePublishControls } from "@/components/cursos/course-publish-controls";
import { COURSE_STATUS_CLASSES, COURSE_STATUS_LABELS } from "@/components/cursos/labels";
import { updateCourseAction } from "@/app/admin/cursos/actions";
import { AdminPageHeader } from "@/components/admin/page-header";

export default async function AdminCursoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [course, categories, tutors] = await Promise.all([
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
    prisma.user.findMany({ where: { role: { in: ["TUTOR", "ADMIN"] } }, orderBy: { fullName: "asc" } }),
  ]);

  if (!course) notFound();

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
          title={course.title}
          action={
            <>
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
            </>
          }
        />
      </div>

      <CoursePublishControls courseId={course.id} status={course.status} />

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="temario">Temario</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <CourseImageUploader courseId={course.id} basePath="/admin/cursos" imageUrl={course.imageUrl} />
          <div className="surface p-6">
            <CourseForm
              mode="edit"
              action={updateCourseAction.bind(null, course.id, "/admin/cursos")}
              categories={categories}
              tutors={tutors}
              isAdmin
              submitLabel="Guardar cambios"
              defaultValues={{
                title: course.title,
                slug: course.slug,
                shortDescription: course.shortDescription,
                fullDescription: course.fullDescription ?? "",
                instructions: course.instructions ?? "",
                categoryId: course.categoryId ?? "",
                courseType: course.courseType,
                durationHours: course.durationHours,
                passingScore: course.passingScore,
                enrollmentMode: course.enrollmentMode,
                targetAudience: course.targetAudience,
                isSequential: course.isSequential,
                tutorId: course.tutorId,
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
