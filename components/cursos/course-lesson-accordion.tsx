import { Lock, CheckCircle2, Layers } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { EmptyState } from "@/components/brand/empty-state";
import { LESSON_CONTENT_TYPE_ICONS } from "@/components/cursos/labels";
import type { LessonContentType } from "@prisma/client";

export type LessonAccordionItem = {
  id: string;
  title: string;
  isRequired: boolean;
  contentType: LessonContentType;
  estimatedMinutes: number | null;
};

export type ModuleAccordionItem = {
  id: string;
  title: string;
  lessons: LessonAccordionItem[];
};

/**
 * Check real solo si hay inscripción activa Y la lección está en
 * completedLessonIds (LessonProgress ya existente) — sin inscripción real,
 * todas las lecciones se muestran con candado (informativo: "inscríbete
 * para acceder"), sin inventar una lógica de acceso nueva.
 */
export function CourseLessonAccordion({
  modules,
  completedLessonIds,
  isEnrolled,
}: {
  modules: ModuleAccordionItem[];
  completedLessonIds: Set<string>;
  isEnrolled: boolean;
}) {
  if (modules.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="El temario se está preparando"
        description="El tutor todavía está construyendo los módulos y lecciones de este curso."
        className="border-none bg-muted/40 py-10"
      />
    );
  }

  return (
    <Accordion defaultValue={["module-0"]} className="space-y-3">
      {modules.map((module_, index) => (
        <AccordionItem
          key={module_.id}
          value={`module-${index}`}
          className="surface surface-hover overflow-hidden border-none px-4"
        >
          <AccordionTrigger className="py-4 hover:no-underline">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
                {index + 1}
              </span>
              <span className="font-display text-base font-bold text-foreground">{module_.title}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-1 border-t border-border pt-3">
              {module_.lessons.map((lesson) => {
                const Icon = LESSON_CONTENT_TYPE_ICONS[lesson.contentType];
                const isDone = isEnrolled && completedLessonIds.has(lesson.id);
                return (
                  <div
                    key={lesson.id}
                    className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-muted/50"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate text-foreground">{lesson.title}</span>
                    {lesson.estimatedMinutes && (
                      <span className="shrink-0 text-xs text-muted-foreground">{lesson.estimatedMinutes} min</span>
                    )}
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                    ) : (
                      <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                  </div>
                );
              })}
              {module_.lessons.length === 0 && (
                <p className="px-2 py-2 text-sm text-muted-foreground">Sin lecciones todavía.</p>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
