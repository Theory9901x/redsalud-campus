import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, BookOpen, ExternalLink, Info, ListTree, Settings2, Users } from "lucide-react";
import { requireSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { ModuloHero } from "@/components/training-plans/modulo-hero";
import { PildoraEstado } from "@/components/training-plans/plan-visual";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CourseForm } from "@/components/cursos/course-form";
import { CourseImageUploader } from "@/components/cursos/course-image-uploader";
import { ModuleLessonEditor } from "@/components/cursos/module-lesson-editor";
import { COURSE_STATUS_LABELS } from "@/components/cursos/labels";
import { updateCourseAction } from "@/app/admin/cursos/actions";

export default async function TutorCursoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();

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
        category: { select: { name: true } },
        _count: { select: { enrollments: true, certificates: true } },
      },
    }),
    prisma.courseCategory.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
  ]);

  if (!course) notFound();
  if (session.user.role !== "ADMIN" && course.tutorId !== session.user.id) {
    redirect("/no-autorizado");
  }

  const lecciones = course.modules.reduce((n, m) => n + m.lessons.length, 0);
  const estadoPildora = course.status === "PUBLISHED" ? "ACTIVE" : course.status === "DRAFT" ? "DRAFT" : "CLOSED";

  return (
    <div className="space-y-5">
      <Link
        href="/tutor/cursos"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Mis cursos
      </Link>

      <div className="space-y-3">
        <ModuloHero
          eyebrow={`Curso · ${course.category?.name ?? "Sin categoría"}`}
          Icono={BookOpen}
          titulo={course.title}
          descripcion={course.shortDescription}
          cifras={[
            { valor: course.modules.length, etiqueta: "Módulos" },
            { valor: lecciones, etiqueta: "Lecciones" },
            { valor: course.quizzes.length, etiqueta: "Evaluaciones" },
            { valor: course._count.enrollments, etiqueta: "Inscritos", detalle: `${course._count.certificates} constancias` },
          ]}
          acciones={
            <>
              <Link href={`/tutor/inscritos?vista=cursos&curso=${course.id}`} className="boton-hero">
                <Users className="h-4 w-4" aria-hidden="true" />
                Inscritos y progreso
              </Link>
              {course.status === "PUBLISHED" && (
                <Link href={`/cursos/${course.slug}`} target="_blank" className="enlace-hero">
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Ver en el catálogo
                </Link>
              )}
            </>
          }
        />
        <div className="barra-modulo flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="mono-label">Estado</span>
            <PildoraEstado estado={estadoPildora}>{COURSE_STATUS_LABELS[course.status]}</PildoraEstado>
          </div>
          {course.status === "DRAFT" && (
            <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
              <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              En borrador: un administrador debe publicarlo para que aparezca en el catálogo.
            </p>
          )}
        </div>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="plan-tabs">
          <TabsTrigger value="general">
            <Settings2 aria-hidden="true" />
            General
          </TabsTrigger>
          <TabsTrigger value="temario">
            <ListTree aria-hidden="true" />
            Temario
            <span className="conteo">{lecciones}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-5 pt-5">
          <CourseImageUploader courseId={course.id} basePath="/tutor/cursos" imageUrl={course.imageUrl} />
          <div className="barra-modulo p-5 sm:p-6">
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
                instructions: course.instructions ?? "",
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

        <TabsContent value="temario" className="pt-5">
          <ModuleLessonEditor courseId={course.id} initialModules={course.modules} initialQuizzes={course.quizzes} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
