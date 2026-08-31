import Image from "next/image";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, ExternalLink, FileText } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAulaData } from "@/lib/aula";
import { getYoutubeEmbedUrl } from "@/lib/youtube";
import { htmlSeguro } from "@/lib/html-seguro";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LESSON_CONTENT_TYPE_LABELS, LESSON_CONTENT_TYPE_ICONS } from "@/components/cursos/labels";
import { CompletarLeccion } from "@/components/aula/completar-leccion";

/**
 * Vista de la lección: UN workspace glass flotante donde el video es el
 * protagonista, el título manda y el CTA es evidente. La estructura
 * funcional (navegación, completar, tipos de contenido, estados) es la
 * misma de siempre; solo cambió la piel.
 */
export default async function AulaLessonPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const data = await getAulaData(courseId, session.user.id);
  if (!data) notFound();

  /*
   * Una lección que ya no existe NO es un 404: al reemplazar el contenido de
   * un módulo, los enlaces guardados apuntan a ids que se borraron. Se lleva
   * a la persona al curso, que la reanuda donde le corresponde ahora.
   */
  const lessonMeta = data.flattenedLessons.find((l) => l.id === lessonId);
  if (!lessonMeta) redirect(`/aula/${courseId}`);
  if (!lessonMeta.unlocked) redirect(`/aula/${courseId}`);

  const [lesson, progresoLeccion] = await Promise.all([
    prisma.lesson.findUnique({ where: { id: lessonId } }),
    // Dónde quedó en el video, para reanudar donde lo dejó.
    prisma.lessonProgress.findUnique({
      where: { userId_lessonId: { userId: session.user.id, lessonId } },
      select: { lastPositionSeconds: true },
    }),
  ]);
  if (!lesson) notFound();

  const lessonIndex = data.flattenedLessons.findIndex((l) => l.id === lessonId);
  const prevLesson = lessonIndex > 0 ? data.flattenedLessons[lessonIndex - 1] : null;
  const nextLesson =
    lessonIndex < data.flattenedLessons.length - 1 ? data.flattenedLessons[lessonIndex + 1] : null;

  const showText = lesson.contentType === "TEXT" || lesson.contentType === "MIXED";
  const showYoutube = lesson.contentType === "YOUTUBE" || lesson.contentType === "MIXED";
  const showVideoFile = lesson.contentType === "VIDEO" && lesson.fileUrl;
  const showFile = (lesson.contentType === "PDF" || lesson.contentType === "IMAGE" || lesson.contentType === "MIXED") && lesson.fileUrl;
  const showLink = (lesson.contentType === "LINK" || lesson.contentType === "MIXED") && lesson.externalUrl;
  const embedUrl = lesson.videoUrl ? getYoutubeEmbedUrl(lesson.videoUrl) : null;

  // Un documento (PDF) necesita más lienzo que un texto de lectura.
  const isDocumentLesson = Boolean(showFile && lesson.contentType !== "IMAGE");

  // "Título · Subtítulo": la segunda parte se pinta como subtítulo en
  // degradado. Si el título no trae separador, no hay subtítulo.
  const [tituloPrincipal, ...restoTitulo] = lesson.title.split(" · ");
  const subtitulo = restoTitulo.join(" · ") || null;

  const TypeIcon = LESSON_CONTENT_TYPE_ICONS[lesson.contentType];

  const botonAnterior = prevLesson ? (
    <Link href={`/aula/${courseId}/${prevLesson.id}`} className="btn-nav-leccion" data-dir="anterior">
      <span className="flex items-center gap-1.5">
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Anterior
      </span>
      <span className="micro">Lección anterior</span>
    </Link>
  ) : (
    <span aria-hidden="true" />
  );

  const botonSiguiente = nextLesson ? (
    <Link href={`/aula/${courseId}/${nextLesson.id}`} className="btn-nav-leccion" data-dir="siguiente">
      <span className="flex items-center gap-1.5">
        Siguiente
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="micro">Siguiente lección</span>
    </Link>
  ) : (
    <span aria-hidden="true" />
  );

  return (
    <div className={cn("mx-auto", isDocumentLesson ? "max-w-[1250px]" : "max-w-[1180px]")}>
      <div className="reading-progress" aria-hidden="true" />

      <article className="leccion-workspace p-[clamp(18px,3.2vw,36px)]">
        {/* ---- Metadatos ---- */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <span className="pildora-leccion !text-[var(--accent)]">
            <TypeIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {LESSON_CONTENT_TYPE_LABELS[lesson.contentType]}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {lesson.estimatedMinutes !== null && lesson.estimatedMinutes > 0 && (
              <span className="pildora-leccion">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                {lesson.estimatedMinutes} min
              </span>
            )}
            <span className="pildora-leccion">
              <span
                className={cn("h-1.5 w-1.5 rounded-full", lessonMeta.completed ? "bg-success" : "bg-[var(--accent)]")}
                aria-hidden="true"
              />
              {lessonMeta.completed ? "Completada" : "En curso"}
            </span>
          </div>
        </div>

        {/* ---- Título ---- */}
        <h1 className="leccion-titulo mt-4">{tituloPrincipal}</h1>
        {subtitulo && <p className="leccion-subtitulo mt-[5px]">{subtitulo}</p>}
        {lesson.description && (
          <p className="mt-2.5 max-w-[780px] text-[14.5px] leading-[1.55] text-muted-foreground">
            {lesson.description}
          </p>
        )}

        {/* ---- Contenido ---- */}
        <div className="mt-6 space-y-6">
          {showText && lesson.contentBody && (
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: htmlSeguro(lesson.contentBody) }}
            />
          )}

          {showYoutube && embedUrl && (
            <div className="player-shell">
              <iframe
                src={embedUrl}
                title={lesson.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          {showFile && lesson.contentType === "IMAGE" && (
            <div className="player-shell">
              <div className="relative aspect-video w-full overflow-hidden rounded-[18px] bg-muted">
                {/* unoptimized: fileUrl es una ruta privada (/api/media/[id]) protegida por sesión;
                    el optimizador de next/image la pide desde el servidor sin cookies y recibe 401. */}
                <Image
                  src={lesson.fileUrl!}
                  alt={lesson.title}
                  fill
                  unoptimized
                  sizes="(min-width: 768px) 1100px, 100vw"
                  className="object-contain"
                />
              </div>
            </div>
          )}

          {showFile && lesson.contentType !== "IMAGE" && (
            <div className="space-y-3">
              {/* Visor a casi toda la altura de la ventana, para leer el
                  documento aquí mismo sin abrirlo en otra pestaña. */}
              <div className="h-[80vh] min-h-[520px] w-full overflow-hidden rounded-[20px] border border-border/60 shadow-sm">
                <iframe src={`${lesson.fileUrl!}#view=FitH&navpanes=0`} title={lesson.title} className="h-full w-full" />
              </div>
              <Link
                href={lesson.fileUrl!}
                target="_blank"
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
              >
                <FileText className="h-4 w-4" />
                Abrir documento en una pestaña nueva
              </Link>
            </div>
          )}

          {showLink && (
            <Link
              href={lesson.externalUrl!}
              target="_blank"
              className="btn-nav-leccion !flex-row justify-between gap-3 px-4 py-3"
            >
              <span className="min-w-0 truncate text-sm font-medium">{lesson.externalUrl}</span>
              <ExternalLink className="h-4 w-4 shrink-0 text-[var(--accent)]" aria-hidden="true" />
            </Link>
          )}

          {!showText && !showYoutube && !showVideoFile && !showFile && !showLink && (
            <p className="text-sm text-muted-foreground">Esta lección todavía no tiene contenido.</p>
          )}
        </div>

        {/* ---- Botonera ---- */}
        {showVideoFile ? (
          /* El video subido vive dentro del control de completar (reanuda y
             auto-completa al 90%): ocupa el ancho y la navegación va debajo. */
          <div className="mt-6 space-y-5 border-t border-border/40 pt-6">
            <CompletarLeccion
              courseId={courseId}
              lessonId={lessonId}
              contentType={lesson.contentType}
              fileUrl={lesson.fileUrl}
              yaCompletada={lessonMeta.completed}
              posicionInicial={progresoLeccion?.lastPositionSeconds ?? null}
            />
            <div className="flex items-center justify-between gap-3">
              {botonAnterior}
              {botonSiguiente}
            </div>
          </div>
        ) : (
          <div className="leccion-botonera mt-6 border-t border-border/40 pt-6">
            <div className="justify-self-start">{botonAnterior}</div>
            <div data-slot="cta" className="justify-self-center">
              <CompletarLeccion
                courseId={courseId}
                lessonId={lessonId}
                contentType={lesson.contentType}
                fileUrl={lesson.fileUrl}
                yaCompletada={lessonMeta.completed}
                posicionInicial={progresoLeccion?.lastPositionSeconds ?? null}
              />
            </div>
            <div className="justify-self-end">{botonSiguiente}</div>
          </div>
        )}
      </article>

      {/* Un respiro al final para que el workspace no muera contra el borde. */}
      <div className="h-8" aria-hidden="true" />
    </div>
  );
}
