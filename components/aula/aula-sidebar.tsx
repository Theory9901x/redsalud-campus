"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CheckCircle2, Lock, FileText, Video, FileImage, Link2, Layers, ListChecks, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AulaModule, AulaQuiz } from "@/lib/aula";

const CONTENT_ICONS: Record<string, typeof FileText> = {
  TEXT: FileText,
  YOUTUBE: Video,
  PDF: FileText,
  IMAGE: FileImage,
  LINK: Link2,
  MIXED: Layers,
};

function QuizNavItem({ courseId, quiz, pathname }: { courseId: string; quiz: AulaQuiz; pathname: string }) {
  const href = `/aula/${courseId}/quiz/${quiz.id}`;
  const isActive = pathname === href;
  const failed = !quiz.passed && quiz.attemptsRemaining <= 0;

  if (!quiz.unlocked) {
    return (
      <div className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground/50">
        <Lock className="h-3.5 w-3.5 shrink-0" />
        {quiz.title}
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors",
        isActive ? "bg-primary/10 font-medium text-primary" : "text-foreground/80 hover:bg-muted"
      )}
    >
      {quiz.passed ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
      ) : failed ? (
        <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
      ) : (
        <ListChecks className="h-3.5 w-3.5 shrink-0" />
      )}
      <span className="line-clamp-1">{quiz.title}</span>
    </Link>
  );
}

export function AulaSidebar({
  courseId,
  courseTitle,
  progress,
  modules,
  finalQuizzes,
}: {
  courseId: string;
  courseTitle: string;
  progress: number;
  modules: AulaModule[];
  finalQuizzes: AulaQuiz[];
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-full shrink-0 flex-col border-r border-border bg-card lg:h-[calc(100vh-57px)] lg:w-80 lg:overflow-y-auto">
      <div className="border-b border-border p-4">
        <p className="font-display text-sm font-bold leading-snug text-foreground">{courseTitle}</p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-teal-400 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{progress}% completado</p>
      </div>

      <nav className="flex-1 space-y-4 p-3">
        {modules.map((module_, moduleIndex) => (
          <div key={module_.id}>
            <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Módulo {moduleIndex + 1}: {module_.title}
            </p>
            <div className="mt-1 space-y-0.5">
              {module_.lessons.map((lesson) => {
                const Icon = CONTENT_ICONS[lesson.contentType] ?? FileText;
                const href = `/aula/${courseId}/${lesson.id}`;
                const isActive = pathname === href;

                if (!lesson.unlocked) {
                  return (
                    <div
                      key={lesson.id}
                      className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground/50"
                    >
                      <Lock className="h-3.5 w-3.5 shrink-0" />
                      {lesson.title}
                    </div>
                  );
                }

                return (
                  <Link
                    key={lesson.id}
                    href={href}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-foreground/80 hover:bg-muted"
                    )}
                  >
                    {lesson.completed ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                    ) : (
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span className="line-clamp-1">{lesson.title}</span>
                  </Link>
                );
              })}
              {module_.quiz && <QuizNavItem courseId={courseId} quiz={module_.quiz} pathname={pathname} />}
            </div>
          </div>
        ))}

        {finalQuizzes.length > 0 && (
          <div>
            <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Evaluación final
            </p>
            <div className="mt-1 space-y-0.5">
              {finalQuizzes.map((quiz) => (
                <QuizNavItem key={quiz.id} courseId={courseId} quiz={quiz} pathname={pathname} />
              ))}
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
}
