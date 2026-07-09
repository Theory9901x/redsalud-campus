import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Lock, Target, Users, Layers } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/brand/empty-state";
import { DotPattern } from "@/components/brand/dot-pattern";
import { EnrollButton } from "@/components/cursos/enroll-button";
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
  const [course, enrollmentRecord] = await Promise.all([
    prisma.course.findUnique({
      where: { slug },
      include: {
        category: { select: { name: true } },
        tutor: { select: { fullName: true } },
        modules: {
          orderBy: { sortOrder: "asc" },
          include: { lessons: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, isRequired: true } } },
        },
        _count: { select: { enrollments: true } },
      },
    }),
    session?.user ? prisma.enrollment.findFirst({ where: { userId: session.user.id, course: { slug } } }) : null,
  ]);

  if (!course || course.status !== "PUBLISHED") notFound();

  // Una inscripción cancelada no cuenta como "inscrito": puede volver a inscribirse.
  const enrollment = enrollmentRecord?.status === "CANCELLED" ? null : enrollmentRecord;

  const TypeIcon = COURSE_TYPE_ICONS[course.courseType];
  const colors = COURSE_TYPE_COLORS[course.courseType];
  const totalLessons = course.modules.reduce((total, m) => total + m.lessons.length, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/5">
            {course.imageUrl ? (
              <Image
                src={course.imageUrl}
                alt={course.title}
                fill
                sizes="(min-width: 1024px) 800px, 100vw"
                className="fade-edge object-cover"
                priority
              />
            ) : (
              <div className={cn("relative flex h-full w-full items-center justify-center bg-gradient-to-br", colors.gradient)}>
                <DotPattern className="text-white/20" />
                <TypeIcon className="h-16 w-16 text-white/40" strokeWidth={1.5} />
              </div>
            )}
            <div className={cn("absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-xl shadow-md", colors.iconBox)}>
              <TypeIcon className="h-5 w-5 text-white" />
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              {course.category && <Badge className="bg-secondary text-secondary-foreground">{course.category.name}</Badge>}
              <Badge className={colors.badge}>{COURSE_TYPE_LABELS[course.courseType]}</Badge>
            </div>
            <h1 className="mt-2 font-display text-2xl font-extrabold text-foreground sm:text-3xl">{course.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Impartido por {course.tutor.fullName}</p>
          </div>

          <div className="surface p-5">
            <h2 className="font-display text-lg font-bold text-foreground">Acerca de este curso</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
              {course.fullDescription || course.shortDescription}
            </p>
          </div>

          <div className="surface p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-foreground">Contenido del curso</h2>
              {course.modules.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {course.modules.length} módulos · {totalLessons} lecciones
                </p>
              )}
            </div>

            {course.modules.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="El temario se está preparando"
                description="El tutor todavía está construyendo los módulos y lecciones de este curso."
                className="mt-4 border-none bg-muted/40 py-10"
              />
            ) : (
              <Accordion defaultValue={["module-0"]} className="mt-4">
                {course.modules.map((module_, index) => (
                  <AccordionItem key={module_.id} value={`module-${index}`} className="border-border">
                    <AccordionTrigger className="text-sm font-semibold text-foreground hover:no-underline">
                      Módulo {index + 1}: {module_.title}
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-1">
                        {module_.lessons.map((lesson) => (
                          <div
                            key={lesson.id}
                            className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground"
                          >
                            <Lock className="h-3.5 w-3.5 shrink-0" />
                            {lesson.title}
                          </div>
                        ))}
                        {module_.lessons.length === 0 && (
                          <p className="px-2 py-2 text-sm text-muted-foreground">Sin lecciones todavía.</p>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </div>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="surface surface-hover p-5">
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

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Clock className="h-4 w-4" />
                </span>
                <span className="text-muted-foreground">{course.durationHours} horas de duración</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning-foreground">
                  <Target className="h-4 w-4" />
                </span>
                <span className="text-muted-foreground">Puntaje mínimo: {course.passingScore}%</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                  <Users className="h-4 w-4" />
                </span>
                <span className="text-muted-foreground">{ENROLLMENT_MODE_LABELS[course.enrollmentMode]}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
