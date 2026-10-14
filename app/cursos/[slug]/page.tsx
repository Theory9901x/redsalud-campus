import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Award, Building2 } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { htmlSeguro } from "@/lib/html-seguro";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StaggerSections } from "@/components/brand/stagger-sections";
import { EnrollButton } from "@/components/cursos/enroll-button";
import { PanelInscripcion } from "@/components/cursos/panel-inscripcion";
import { AuroraWebGL } from "@/components/cursos/aurora-webgl";
import { Cifra } from "@/components/training-plans/plan-dinamico";
import { CourseLessonAccordion } from "@/components/cursos/course-lesson-accordion";
import { PublicCoursesShell } from "@/components/cursos/public-courses-shell";
import { ShareCourseButton } from "@/components/cursos/share-course-button";
import { COURSE_TYPE_LABELS } from "@/components/cursos/labels";

/** Encabezado de sección numerado ("01 · Acerca de este curso ------ extra"). */
function SeccionCurso({ indice, titulo, extra, children }: { indice: string; titulo: string; extra?: string; children: React.ReactNode }) {
  return (
    <section className="curso-panel aparecer-scroll">
      <div className="curso-panel-cab">
        <span className="indice">{indice}</span>
        <h2>{titulo}</h2>
        <span className="linea" aria-hidden="true" />
        {extra && <span className="extra">{extra}</span>}
      </div>
      {children}
    </section>
  );
}

/** Parte el título para resaltar su final ("Curso de Inducción y <luz>Reinducción</luz>"). */
function partirTitulo(titulo: string): [string, string] {
  const palabras = titulo.trim().split(/\s+/);
  if (palabras.length < 3) return ["", titulo];
  const corte = Math.max(1, palabras.length - Math.ceil(palabras.length / 3));
  return [palabras.slice(0, corte).join(" "), palabras.slice(corte).join(" ")];
}

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

  // Cada quien ve los módulos de su grupo poblacional (AMBOS = todos). Sin
  // sesión se muestra el temario completo: es la vitrina del curso.
  // ADMIN y TUTOR ven el temario completo; el filtro es solo para estudiantes.
  const esGestion = session?.user?.role === "ADMIN" || session?.user?.role === "TUTOR";
  const tipoPersonal = esGestion ? null : session?.user?.personnelType ?? null;
  const modulosVisibles = course.modules.filter((m) => m.audience === "AMBOS" || !tipoPersonal || m.audience === tipoPersonal);
  const totalLessons = modulosVisibles.reduce((total, m) => total + m.lessons.length, 0);

  const [tituloBase, tituloLuz] = partirTitulo(course.title);
  const descripcion = course.fullDescription || course.shortDescription || "";

  // La acción principal (entrar, continuar, inscribirse…) es la misma en la
  // cabecera y en el panel lateral: se arma una sola vez.
  const accion = (
    <>
      {!session?.user && (
        <Link
          href="/login"
          className={cn(
            buttonVariants({ size: "lg" }),
            "glow-brand w-full gap-1.5 bg-gradient-to-r from-primary to-[color-mix(in_oklch,var(--primary)_55%,var(--success))] font-bold text-white hover:opacity-90"
          )}
        >
          Inicia sesión para inscribirte
        </Link>
      )}

      {session?.user && enrollment && (
        <Link
          href={`/aula/${course.id}`}
          className={cn(
            buttonVariants({ size: "lg" }),
            "glow-brand w-full gap-1.5 bg-gradient-to-r from-primary to-[color-mix(in_oklch,var(--primary)_55%,var(--success))] font-bold text-white hover:opacity-90"
          )}
        >
          {enrollment.status === "COMPLETED"
            ? "Ver curso completado"
            : enrollment.progressPercentage > 0
              ? "Continuar curso"
              : "Empezar el curso"}
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}

      {session?.user && !enrollment && course.enrollmentMode === "OPEN" && (
        <EnrollButton courseId={course.id} slug={course.slug} />
      )}

      {session?.user && !enrollment && course.enrollmentMode === "ASSIGNED" && (
        <div className="space-y-2">
          <p className="rounded-xl border border-border bg-muted/60 px-4 py-3 text-center text-[13px] text-muted-foreground">
            Aún no estás inscrito. Un administrador debe asignarte este curso.
          </p>
          <Link href={roleHome(session.user.role)} className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
            Ir a mi panel
          </Link>
        </div>
      )}
    </>
  );

  const instrumentos = [
    { valor: course.durationHours, sufijo: "h", etiqueta: "Duración" },
    { valor: modulosVisibles.length, sufijo: "", etiqueta: modulosVisibles.length === 1 ? "Módulo" : "Módulos" },
    { valor: totalLessons, sufijo: "", etiqueta: totalLessons === 1 ? "Lección" : "Lecciones" },
    { valor: course.passingScore, sufijo: "%", etiqueta: "Para aprobar" },
    { valor: course._count.enrollments, sufijo: "", etiqueta: "Inscritos" },
  ].filter((x) => x.valor > 0);

  return (
    <PublicCoursesShell maxWidth="max-w-6xl">
      <div className="space-y-8">
        <Link
          href="/cursos"
          className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al catálogo
        </Link>

        {/* ── Cabecera con aurora WebGL ── */}
        <section className="curso-hero revelar">
          <AuroraWebGL />
          <div className="contenido p-6 sm:p-10 lg:px-12 lg:py-12">
            <div className="min-w-0 max-w-4xl">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="curso-eyebrow">
                  {[course.category?.name, COURSE_TYPE_LABELS[course.courseType]].filter(Boolean).join(" · ")}
                </p>
                <div className="lg:hidden">
                  <ShareCourseButton title={course.title} />
                </div>
              </div>
              <h1 className="curso-titulo mt-4">
                {tituloBase && <>{tituloBase} </>}
                <span className="luz">{tituloLuz}</span>
              </h1>
              {course.shortDescription && (
                <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/72">{course.shortDescription}</p>
              )}
              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-white/75">
                <span className="inline-flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-[8px] border border-white/20 bg-white/10 font-mono text-[10px] font-semibold text-white">
                    {initials(course.tutor.fullName)}
                  </span>
                  Por <span className="font-semibold text-white">{course.tutor.fullName}</span>
                </span>
                {institutionSettings && (
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-[color-mix(in_oklch,var(--primary)_70%,white)]" aria-hidden="true" />
                    {institutionSettings.institutionName}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <Award className="h-4 w-4 text-[color-mix(in_oklch,var(--success)_70%,white)]" aria-hidden="true" />
                  Certificado al aprobar
                </span>
              </div>

              {instrumentos.length > 0 && (
                <div className="mt-7 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                  {instrumentos.map((x) => (
                    <div key={x.etiqueta} className="instrumento">
                      <b>
                        <Cifra valor={x.valor} sufijo={x.sufijo} />
                      </b>
                      <span>{x.etiqueta}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="cta-curso mt-7 flex flex-wrap items-center gap-3">
                <div className="w-full sm:w-auto sm:min-w-[260px]">{accion}</div>
                <div className="hidden lg:block">
                  <ShareCourseButton title={course.title} />
                </div>
              </div>
            </div>

          </div>
        </section>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <StaggerSections className="space-y-6 lg:col-span-2">
            <SeccionCurso indice="01" titulo="Acerca de este curso">
              <p className="whitespace-pre-line text-[15px] leading-[1.75] text-foreground/80">{descripcion}</p>
            </SeccionCurso>

            {course.instructions && (
              <SeccionCurso indice="02" titulo="Instrucciones">
                <div
                  className="prose prose-sm max-w-none text-foreground/80"
                  dangerouslySetInnerHTML={{ __html: htmlSeguro(course.instructions) }}
                />
              </SeccionCurso>
            )}

            <SeccionCurso
              indice={course.instructions ? "03" : "02"}
              titulo="Contenido del curso"
              extra={modulosVisibles.length > 0 ? `${modulosVisibles.length} módulos · ${totalLessons} lecciones` : undefined}
            >
              <div className="linea-tiempo">
                <CourseLessonAccordion
                  modules={modulosVisibles}
                  completedLessonIds={completedLessonIds}
                  isEnrolled={!!enrollment}
                />
              </div>
            </SeccionCurso>

            <SeccionCurso indice={course.instructions ? "04" : "03"} titulo="Ficha del curso">
              <div>
                <div className="ficha-dato">
                  <span className="grid h-10 w-10 place-items-center rounded-[10px] border border-primary/30 bg-primary/8 font-mono text-[11px] font-semibold text-primary">
                    {initials(course.tutor.fullName)}
                  </span>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Tutor responsable</p>
                    <p className="text-[14px] font-semibold text-foreground">{course.tutor.fullName}</p>
                  </div>
                </div>
                {institutionSettings && (
                  <div className="ficha-dato">
                    {institutionSettings.logoUrl ? (
                      <Image
                        src={institutionSettings.logoUrl}
                        alt=""
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-[10px] border border-border bg-white object-contain p-0.5"
                      />
                    ) : (
                      <span className="grid h-10 w-10 place-items-center rounded-[10px] border border-border">
                        <Building2 className="h-4 w-4 text-primary" aria-hidden="true" />
                      </span>
                    )}
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Certificado por</p>
                      <p className="text-[14px] font-semibold text-foreground">{institutionSettings.institutionName}</p>
                      {institutionSettings.signerName && (
                        <p className="text-[12px] text-muted-foreground">
                          Firma: {institutionSettings.signerName}
                          {institutionSettings.signerPosition ? ` · ${institutionSettings.signerPosition}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </SeccionCurso>
          </StaggerSections>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <PanelInscripcion
              courseId={course.id}
              progreso={session?.user && enrollment ? enrollment.progressPercentage : null}
              completado={enrollment?.status === "COMPLETED"}
              durationHours={course.durationHours}
              passingScore={course.passingScore}
              enrollmentMode={course.enrollmentMode}
              modulos={course.modules.length}
              lecciones={totalLessons}
              inscritos={course._count.enrollments}
              accion={accion}
            />
          </aside>
        </div>
      </div>
    </PublicCoursesShell>
  );
}
