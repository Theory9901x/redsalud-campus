import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Target, Users, Info, User, ClipboardList, Layers } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/brand/empty-state";
import { StaggerSections } from "@/components/brand/stagger-sections";
import { DotPattern } from "@/components/brand/dot-pattern";
import { EnrollButton } from "@/components/cursos/enroll-button";
import { CourseDetailCard } from "@/components/cursos/course-detail-card";
import { CourseCreatorCard } from "@/components/cursos/course-creator-card";
import { CourseLessonAccordion } from "@/components/cursos/course-lesson-accordion";
import { coursePhotoTransitionName } from "@/lib/view-transition-names";
import {
  COURSE_TYPE_LABELS,
  COURSE_TYPE_ICONS,
  COURSE_TYPE_COLORS,
  ENROLLMENT_MODE_LABELS,
} from "@/components/cursos/labels";

function roleHome(role: string | undefined) {
  if (role === "ADMIN") return "/admin";
  if (role === "TUTOR") return "/tutor";
  return "/inicio";
}

export default async function CursoDetallePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const session = await auth();

  // La inscripción se busca por slug (vía relación) en vez de esperar el id
  // del curso, para poder lanzar ambas consultas en paralelo.
  const [course, enrollmentRecord, institutionSettings] = await Promise.all([
    prisma.course.findUnique({
      where: { slug },
      include: {
        category: { select: { name: true } },
        tutor: { select: { fullName: true } },
        modules: {
          orderBy: { sortOrder: "asc" },
          include: {
            lessons: {
              orderBy: { sortOrder: "asc" },
              select: { id: true, title: true, isRequired: true, contentType: true, estimatedMinutes: true },
            },
          },
        },
        _count: { select: { enrollments: true } },
      },
    }),
    session?.user ? prisma.enrollment.findFirst({ where: { userId: session.user.id, course: { slug } } }) : null,
    prisma.institutionSettings.findUnique({ where: { id: "singleton" } }),
  ]);

  if (!course || course.status !== "PUBLISHED") notFound();

  // Una inscripción cancelada no cuenta como "inscrito": puede volver a inscribirse.
  const enrollment = enrollmentRecord?.status === "CANCELLED" ? null : enrollmentRecord;

  // Progreso real por lección (dato ya registrado por LessonProgress), solo si hay inscripción vigente.
  const completedLessonIds = enrollment
    ? new Set(
        (
          await prisma.lessonProgress.findMany({
            where: { enrollmentId: enrollment.id, status: "COMPLETED" },
            select: { lessonId: true },
          })
        ).map((p) => p.lessonId)
      )
    : new Set<string>();

  const TypeIcon = COURSE_TYPE_ICONS[course.courseType];
  const colors = COURSE_TYPE_COLORS[course.courseType];
  const totalLessons = course.modules.reduce((total, m) => total + m.lessons.length, 0);

  return (
    <div className="space-y-6">
      <Link
        href="/cursos"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al catálogo
      </Link>

      {/* Header "completo" del curso: banner a todo el ancho con la foto (o el
          gradiente por tipo de curso) de fondo y un degradado navy encima para
          que el título siempre sea legible, en vez de una miniatura chica
          seguida de texto plano. */}
      <section className="relative isolate overflow-hidden rounded-3xl shadow-sm">
        <div className="relative h-56 w-full sm:h-72 lg:h-80">
          {course.imageUrl ? (
            <>
              <Image
                src={course.imageUrl}
                alt={course.title}
                fill
                sizes="100vw"
                className="object-cover"
                style={{ viewTransitionName: coursePhotoTransitionName(`/cursos/${slug}`) }}
                priority
              />
              {/* Doble capa: un tinte parejo sobre toda la foto (para que
                  cualquier imagen subida, por brillante o "ruidosa" que sea,
                  quede subordinada) más un refuerzo abajo donde vive el texto. */}
              <div className="absolute inset-0 bg-black/45" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent" />
            </>
          ) : (
            <div className={cn("absolute inset-0 bg-gradient-to-br", colors.gradient)}>
              <DotPattern className="text-white/15" />
            </div>
          )}

          <div className="relative flex h-full flex-col justify-end p-6 sm:p-10">
            <div className={cn("mb-3 flex h-11 w-11 items-center justify-center rounded-xl shadow-md", colors.iconBox)}>
              <TypeIcon className="h-5 w-5 text-white" />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {course.category && (
                <Badge className="border border-white/10 bg-black/40 text-white backdrop-blur">{course.category.name}</Badge>
              )}
              <Badge className={colors.badge}>{COURSE_TYPE_LABELS[course.courseType]}</Badge>
            </div>
            <h1 className="mt-3 max-w-2xl text-balance font-display text-2xl font-extrabold tracking-tight text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.55)] sm:text-4xl">
              {course.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/90 drop-shadow-[0_1px_4px_rgba(0,0,0,0.5)] sm:text-[15px]">
              {course.shortDescription}
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <StaggerSections className="space-y-6 lg:col-span-2">
          <CourseDetailCard icon={User} iconClassName="bg-primary/10 text-primary" title="Ficha del curso">
            <CourseCreatorCard
              tutorName={course.tutor.fullName}
              institution={
                institutionSettings
                  ? {
                      name: institutionSettings.institutionName,
                      logoUrl: institutionSettings.logoUrl,
                      signerName: institutionSettings.signerName,
                      signerPosition: institutionSettings.signerPosition,
                    }
                  : null
              }
            />
          </CourseDetailCard>

          <CourseDetailCard icon={Info} iconClassName="bg-navy/10 text-navy" title="Acerca de este curso">
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-foreground/80">
              {course.fullDescription || course.shortDescription}
            </p>
          </CourseDetailCard>

          {course.instructions && (
            <CourseDetailCard icon={ClipboardList} iconClassName="bg-warning/15 text-warning-foreground" title="Instrucciones">
              <div
                className="prose prose-sm max-w-none text-foreground/80"
                dangerouslySetInnerHTML={{ __html: course.instructions }}
              />
            </CourseDetailCard>
          )}

          <CourseDetailCard
            icon={Layers}
            iconClassName="bg-success/10 text-success"
            title="Contenido del curso"
            action={
              course.modules.length > 0 ? (
                <p className="shrink-0 text-xs text-muted-foreground">
                  {course.modules.length} módulos · {totalLessons} lecciones
                </p>
              ) : undefined
            }
          >
            <CourseLessonAccordion
              modules={course.modules}
              completedLessonIds={completedLessonIds}
              isEnrolled={!!enrollment}
            />
          </CourseDetailCard>
        </StaggerSections>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="surface-panel surface-hover p-6">
            {!session?.user && (
              <Link
                href="/login"
                className={cn(
                  buttonVariants(),
                  "w-full gap-1.5 bg-gradient-to-r from-primary to-teal-400 text-white hover:opacity-90"
                )}
              >
                Inicia sesión para inscribirte
              </Link>
            )}

            {session?.user && enrollment && (
              <div className="space-y-2">
                {enrollment.progressPercentage > 0 && (
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-teal-400"
                      style={{ width: `${enrollment.progressPercentage}%` }}
                    />
                  </div>
                )}
                <Link
                  href={`/aula/${course.id}`}
                  className={cn(
                    buttonVariants(),
                    "w-full gap-1.5 bg-gradient-to-r from-primary to-teal-400 text-white hover:opacity-90"
                  )}
                >
                  {enrollment.status === "COMPLETED"
                    ? "Ver curso completado"
                    : enrollment.progressPercentage > 0
                      ? "Continuar curso"
                      : "Realizar curso"}
                </Link>
              </div>
            )}

            {session?.user && !enrollment && course.enrollmentMode === "OPEN" && (
              <EnrollButton courseId={course.id} slug={course.slug} />
            )}

            {session?.user && !enrollment && course.enrollmentMode === "ASSIGNED" && (
              <div className="space-y-2">
                <div className="rounded-md bg-secondary px-3 py-2.5 text-center text-sm text-secondary-foreground">
                  Aún no estás inscrito. Un administrador debe asignarte este curso.
                </div>
                <Link href={roleHome(session.user.role)} className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
                  Ir a mi panel
                </Link>
              </div>
            )}

            <div className="mt-5 space-y-3 border-t border-border pt-4 text-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Clock className="h-4 w-4" />
                </span>
                <span className="text-foreground/80">{course.durationHours} horas de duración</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning-foreground">
                  <Target className="h-4 w-4" />
                </span>
                <span className="text-foreground/80">Puntaje mínimo: {course.passingScore}%</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                  <Users className="h-4 w-4" />
                </span>
                <span className="text-foreground/80">{ENROLLMENT_MODE_LABELS[course.enrollmentMode]}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
