import Image from "next/image";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, ExternalLink, FileText } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAulaData } from "@/lib/aula";
import { getYoutubeEmbedUrl } from "@/lib/youtube";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LESSON_CONTENT_TYPE_LABELS, LESSON_CONTENT_TYPE_ICONS } from "@/components/cursos/labels";
import { markLessonCompleteAction } from "../actions";

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

  const lessonMeta = data.flattenedLessons.find((l) => l.id === lessonId);
  if (!lessonMeta) notFound();
  if (!lessonMeta.unlocked) redirect(`/aula/${courseId}`);

  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="reading-progress" aria-hidden="true" />
      <div>
        {/* Badges de tipo de contenido + duración + estado de avance. */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(() => {
            const TypeIcon = LESSON_CONTENT_TYPE_ICONS[lesson.contentType];
            return (
              <Badge className="gap-1 bg-primary/10 text-primary">
                <TypeIcon className="h-3 w-3" />
                {LESSON_CONTENT_TYPE_LABELS[lesson.contentType]}
              </Badge>
            );
          })()}
          {lesson.estimatedMinutes !== null && lesson.estimatedMinutes > 0 && (
            <Badge className="gap-1 bg-secondary text-secondary-foreground">
              <Clock className="h-3 w-3" />
              {lesson.estimatedMinutes} min
            </Badge>
          )}
          <Badge
            className={cn(
              "gap-1",
              lessonMeta.completed ? "bg-success/15 text-success" : "bg-warning/15 text-warning-foreground"
            )}
          >
            {lessonMeta.completed && <CheckCircle2 className="h-3 w-3" />}
            {lessonMeta.completed ? "Completada" : "En curso"}
          </Badge>
        </div>
        <h1 className="mt-2 font-display text-2xl font-extrabold text-foreground">{lesson.title}</h1>
        {lesson.description && <p className="mt-2 text-sm text-muted-foreground">{lesson.description}</p>}
      </div>

      {/* Tarjeta glass del contenido: difumina los blobs del aula-canvas. */}
      <div className="surface-glass space-y-5 p-6">
        {showText && lesson.contentBody && (
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: lesson.contentBody }}
          />
        )}

        {showYoutube && embedUrl && (
          <div className="aspect-video w-full overflow-hidden rounded-xl border border-border shadow-sm">
            <iframe
              src={embedUrl}
              title={lesson.title}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {showVideoFile && (
          <div className="aspect-video w-full overflow-hidden rounded-xl border border-border bg-black shadow-sm">
            {/* fileUrl apunta a /api/media/[id], que ahora soporta Range/206 para permitir buscar/adelantar. */}
            <video controls className="h-full w-full" src={lesson.fileUrl!}>
              Tu navegador no soporta la reproducción de este video.
            </video>
          </div>
        )}

        {showFile && lesson.contentType === "IMAGE" && (
          <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-muted shadow-sm">
            {/* unoptimized: fileUrl es una ruta privada (/api/media/[id]) protegida por sesión;
                el optimizador de next/image la pide desde el servidor sin cookies y recibe 401. */}
            <Image
              src={lesson.fileUrl!}
              alt={lesson.title}
              fill
              unoptimized
              sizes="(min-width: 768px) 700px, 100vw"
              className="object-contain"
            />
          </div>
        )}

        {showFile && lesson.contentType !== "IMAGE" && (
          <div className="space-y-3">
            <div className="aspect-[4/3] w-full overflow-hidden rounded-xl border border-border shadow-sm">
              <iframe src={lesson.fileUrl!} title={lesson.title} className="h-full w-full" />
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
            className="surface-hover flex items-center justify-between p-4"
          >
            <span className="text-sm font-medium text-foreground">{lesson.externalUrl}</span>
            <ExternalLink className="h-4 w-4 text-primary" />
          </Link>
        )}

        {!showText && !showYoutube && !showVideoFile && !showFile && !showLink && (
          <p className="text-sm text-muted-foreground">Esta lección todavía no tiene contenido.</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        {prevLesson ? (
          <Link
            href={`/aula/${courseId}/${prevLesson.id}`}
            className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Link>
        ) : (
          <span />
        )}

        <form
          action={async () => {
            "use server";
            const { certificateId } = await markLessonCompleteAction(courseId, lessonId);
            if (certificateId) redirect(`/mi-aula/certificados/${certificateId}?justIssued=1`);
          }}
        >
          <Button type="submit" disabled={lessonMeta.completed} className="gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            {lessonMeta.completed ? "Completada" : "Marcar como completada"}
          </Button>
        </form>

        {nextLesson ? (
          <Link
            href={`/aula/${courseId}/${nextLesson.id}`}
            className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
          >
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
