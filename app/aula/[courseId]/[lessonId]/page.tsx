import Image from "next/image";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { CheckCircle2, ChevronLeft, ChevronRight, ExternalLink, FileText } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getAulaData } from "@/lib/aula";
import { getYoutubeEmbedUrl } from "@/lib/youtube";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  const showVideo = lesson.contentType === "YOUTUBE" || lesson.contentType === "MIXED";
  const showFile = (lesson.contentType === "PDF" || lesson.contentType === "IMAGE" || lesson.contentType === "MIXED") && lesson.fileUrl;
  const showLink = (lesson.contentType === "LINK" || lesson.contentType === "MIXED") && lesson.externalUrl;
  const embedUrl = lesson.videoUrl ? getYoutubeEmbedUrl(lesson.videoUrl) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {lessonMeta.completed ? "Completada" : "Lección"}
        </p>
        <h1 className="mt-1 font-display text-2xl font-extrabold text-foreground">{lesson.title}</h1>
        {lesson.description && <p className="mt-2 text-sm text-muted-foreground">{lesson.description}</p>}
      </div>

      <div className="surface space-y-5 p-6">
        {showText && lesson.contentBody && (
          <div
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: lesson.contentBody }}
          />
        )}

        {showVideo && embedUrl && (
          <div className="aspect-video w-full overflow-hidden rounded-xl">
            <iframe
              src={embedUrl}
              title={lesson.title}
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}

        {showFile && lesson.contentType === "IMAGE" && (
          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-muted">
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
            <div className="aspect-[4/3] w-full overflow-hidden rounded-xl border border-border">
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

        {!showText && !showVideo && !showFile && !showLink && (
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
            await markLessonCompleteAction(courseId, lessonId);
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
