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
import { PublicCoursesShell } from "@/components/cursos/public-courses-shell";
import { ShareCourseButton } from "@/components/cursos/share-course-button";
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

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
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
    <PublicCoursesShell maxWidth="max-w-6xl">
    <div className="space-y-6">
      <Link
        href="/cursos"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al catálogo
      </Link>

      {/* Tarjeta de título: compacta, sin foto detrás -- separada de la caja
          de imagen/video de abajo en vez de tener el texto encimado sobre la
          foto. */}
      <section className="relative isolate overflow-hidden rounded-2xl bg-navy px-5 py-5 text-white sm:px-8 sm:py-6">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 10% 0%, color-mix(in oklch, var(--primary) 30%, transparent), transparent 55%), radial-gradient(circle at 100% 100%, color-mix(in oklch, var(--success) 18%, transparent), transparent 50%)",
          }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {course.category && (
                <Badge className="border border-white/15 bg-white/10 text-white">{course.category.name}</Badge>
              )}
              <Badge className={colors.badge}>{COURSE_TYPE_LABELS[course.courseType]}</Badge>
            </div>
            <h1 className="mt-2 max-w-2xl text-balance font-display text-xl font-extrabold tracking-tight sm:text-2xl">
              {course.title}
            </h1>
            <div className="mt-2.5 flex items-center gap-2 text-sm text-white/70">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-[10px] font-bold text-white">
                {initials(course.tutor.fullName)}
              </span>
              Por <span className="font-medium text-white">{course.tutor.fullName}</span>
            </div>
          </div>
          <ShareCourseButton title={course.title} />
        </div>
      </section>

      {/* Caja de imagen/video: el "cuadro" propio de la portada del curso,
          separado del título de arriba. */}
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/5">
        {course.imageUrl ? (
          <Image
            src={course.imageUrl}
            alt={course.title}
            fill
            sizes="(min-width: 1024px) 900px, 100vw"
            className="object-cover"
            style={{ viewTransitionName: coursePhotoTransitionName(`/cursos/${slug}`) }}
            priority
          />
        ) : (
          <div className={cn("flex h-full w-full items-center justify-center bg-gradient-to-br", colors.gradient)}>
            <DotPattern className="text-white/15" />
            <TypeIcon className="h-16 w-16 text-white/40" strokeWidth={1.5} />
          </div>
        )}
      </div>

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
                  "glow-brand w-full gap-1.5 bg-gradient-to-r from-primary to-teal-400 text-white hover:opacity-90"
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
                    "glow-brand w-full gap-1.5 bg-gradient-to-r from-primary to-teal-400 text-white hover:opacity-90"
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
    </PublicCoursesShell>
  );
}
