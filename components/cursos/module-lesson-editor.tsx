"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  FileText,
  Video,
  FileImage,
  Link2,
  Layers,
  ListChecks,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ModuleFormDialog } from "@/components/cursos/module-form-dialog";
import { LessonFormDialog } from "@/components/cursos/lesson-form-dialog";
import { QuizFormDialog } from "@/components/cursos/quiz-form-dialog";
import { QuestionFormDialog } from "@/components/cursos/question-form-dialog";
import { DeleteConfirmButton } from "@/components/cursos/delete-confirm-button";
import { LESSON_CONTENT_TYPE_LABELS, QUESTION_TYPE_LABELS } from "@/components/cursos/labels";
import {
  createModuleAction,
  updateModuleAction,
  deleteModuleAction,
  reorderModulesAction,
} from "@/app/admin/cursos/module-actions";
import {
  createLessonAction,
  updateLessonAction,
  deleteLessonAction,
  reorderLessonsAction,
} from "@/app/admin/cursos/lesson-actions";
import {
  createQuizAction,
  updateQuizAction,
  deleteQuizAction,
  createQuestionAction,
  updateQuestionAction,
  deleteQuestionAction,
  reorderQuestionsAction,
} from "@/app/admin/cursos/quiz-actions";
import type { LessonContentType, QuestionType } from "@prisma/client";

type LessonItem = {
  id: string;
  title: string;
  contentType: LessonContentType;
  contentBody: string | null;
  videoUrl: string | null;
  externalUrl: string | null;
  fileUrl: string | null;
  isRequired: boolean;
  estimatedMinutes: number | null;
};

type ModuleItem = {
  id: string;
  title: string;
  description: string | null;
  isRequired: boolean;
  lessons: LessonItem[];
};

type OptionItem = { id: string; text: string; isCorrect: boolean };
type QuestionItem = {
  id: string;
  type: QuestionType;
  statement: string;
  score: number;
  explanation: string | null;
  options: OptionItem[];
};
type QuizItem = {
  id: string;
  moduleId: string | null;
  title: string;
  description: string | null;
  passingScore: number;
  maxAttempts: number;
  timeLimitMinutes: number | null;
  randomizeQuestions: boolean;
  randomizeAnswers: boolean;
  showResultsNow: boolean;
  questions: QuestionItem[];
};

const CONTENT_ICONS: Record<LessonContentType, React.ElementType> = {
  TEXT: FileText,
  YOUTUBE: Video,
  PDF: FileText,
  IMAGE: FileImage,
  LINK: Link2,
  MIXED: Layers,
};

export function ModuleLessonEditor({
  courseId,
  initialModules,
  initialQuizzes,
}: {
  courseId: string;
  initialModules: ModuleItem[];
  initialQuizzes: QuizItem[];
}) {
  const [modules, setModules] = useState(initialModules);
  const [quizzes, setQuizzes] = useState(initialQuizzes);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    setModules(initialModules);
  }, [initialModules]);

  useEffect(() => {
    setQuizzes(initialQuizzes);
  }, [initialQuizzes]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function toggleCollapsed(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleModuleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = modules.findIndex((m) => m.id === active.id);
    const newIndex = modules.findIndex((m) => m.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...modules];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    setModules(reordered);
    void reorderModulesAction(courseId, reordered.map((m) => m.id));
  }

  function handleLessonDragEnd(moduleId: string, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setModules((prev) =>
      prev.map((module_) => {
        if (module_.id !== moduleId) return module_;
        const oldIndex = module_.lessons.findIndex((l) => l.id === active.id);
        const newIndex = module_.lessons.findIndex((l) => l.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return module_;
        const reordered = [...module_.lessons];
        const [moved] = reordered.splice(oldIndex, 1);
        reordered.splice(newIndex, 0, moved);
        void reorderLessonsAction(moduleId, reordered.map((l) => l.id));
        return { ...module_, lessons: reordered };
      })
    );
  }

  function handleQuestionDragEnd(quizId: string, event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setQuizzes((prev) =>
      prev.map((quiz) => {
        if (quiz.id !== quizId) return quiz;
        const oldIndex = quiz.questions.findIndex((q) => q.id === active.id);
        const newIndex = quiz.questions.findIndex((q) => q.id === over.id);
        if (oldIndex === -1 || newIndex === -1) return quiz;
        const reordered = [...quiz.questions];
        const [moved] = reordered.splice(oldIndex, 1);
        reordered.splice(newIndex, 0, moved);
        void reorderQuestionsAction(quizId, reordered.map((q) => q.id));
        return { ...quiz, questions: reordered };
      })
    );
  }

  const finalQuizzes = quizzes.filter((q) => !q.moduleId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-foreground">Temario</h3>
        <ModuleFormDialog
          mode="create"
          action={createModuleAction.bind(null, courseId)}
          trigger={
            <Button type="button" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Añadir módulo
            </Button>
          }
        />
      </div>

      {modules.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card py-12 text-center text-muted-foreground">
          Este curso todavía no tiene módulos. Añade el primero para empezar el temario.
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleModuleDragEnd}>
        <SortableContext items={modules.map((m) => m.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {modules.map((module_, index) => (
              <SortableModuleCard
                key={module_.id}
                courseId={courseId}
                module_={module_}
                index={index}
                quizzes={quizzes.filter((q) => q.moduleId === module_.id)}
                collapsed={collapsed.has(module_.id)}
                onToggleCollapse={() => toggleCollapsed(module_.id)}
                onLessonDragEnd={(event) => handleLessonDragEnd(module_.id, event)}
                onQuestionDragEnd={handleQuestionDragEnd}
                sensors={sensors}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="surface space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-display text-sm font-bold text-foreground">Evaluación final del curso</h4>
            <p className="text-xs text-muted-foreground">
              Opcional: un cuestionario que se desbloquea cuando todos los módulos están completos.
            </p>
          </div>
          <QuizFormDialog
            mode="create"
            action={createQuizAction.bind(null, courseId)}
            moduleId={null}
            contextLabel="Evaluación final del curso."
            trigger={
              <Button type="button" variant="outline" size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                Añadir evaluación final
              </Button>
            }
          />
        </div>
        {finalQuizzes.map((quiz) => (
          <QuizCard key={quiz.id} quiz={quiz} contextLabel="Evaluación final del curso." onQuestionDragEnd={handleQuestionDragEnd} sensors={sensors} />
        ))}
      </div>
    </div>
  );
}

function SortableModuleCard({
  courseId,
  module_,
  index,
  quizzes,
  collapsed,
  onToggleCollapse,
  onLessonDragEnd,
  onQuestionDragEnd,
  sensors,
}: {
  courseId: string;
  module_: ModuleItem;
  index: number;
  quizzes: QuizItem[];
  collapsed: boolean;
  onToggleCollapse: () => void;
  onLessonDragEnd: (event: DragEndEvent) => void;
  onQuestionDragEnd: (quizId: string, event: DragEndEvent) => void;
  sensors: ReturnType<typeof useSensors>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: module_.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="surface">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label="Reordenar módulo"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button type="button" onClick={onToggleCollapse} className="flex flex-1 items-center gap-2 text-left">
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-xs font-semibold text-muted-foreground">Módulo {index + 1}</span>
          <span className="font-medium text-foreground">{module_.title}</span>
          {module_.isRequired && <Badge className="bg-primary/10 text-primary">Obligatorio</Badge>}
          <span className="text-xs text-muted-foreground">
            {module_.lessons.length} {module_.lessons.length === 1 ? "lección" : "lecciones"}
          </span>
        </button>
        <ModuleFormDialog
          mode="edit"
          action={updateModuleAction.bind(null, module_.id)}
          defaultValues={{
            title: module_.title,
            description: module_.description ?? "",
            isRequired: module_.isRequired,
          }}
          trigger={
            <Button type="button" variant="ghost" size="icon-sm">
              <Pencil className="h-4 w-4" />
            </Button>
          }
        />
        <DeleteConfirmButton
          title="¿Eliminar este módulo?"
          description="Se eliminarán también todas sus lecciones y su cuestionario. Esta acción no se puede deshacer."
          onConfirm={() => deleteModuleAction(module_.id)}
        />
      </div>

      {!collapsed && (
        <div className="space-y-4 border-t border-border p-4">
          <div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onLessonDragEnd}>
              <SortableContext items={module_.lessons.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {module_.lessons.length === 0 && (
                    <p className="py-4 text-center text-sm text-muted-foreground">Sin lecciones todavía.</p>
                  )}
                  {module_.lessons.map((lesson) => (
                    <SortableLessonRow key={lesson.id} lesson={lesson} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <div className="mt-3">
              <LessonFormDialog
                mode="create"
                action={createLessonAction.bind(null, module_.id)}
                trigger={
                  <Button type="button" variant="outline" size="sm" className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    Añadir lección
                  </Button>
                }
              />
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-dashed border-border p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Cuestionario del módulo
              </p>
              <QuizFormDialog
                mode="create"
                action={createQuizAction.bind(null, courseId)}
                moduleId={module_.id}
                contextLabel={`Cuestionario del módulo: ${module_.title}.`}
                trigger={
                  <Button type="button" variant="outline" size="sm" className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    Añadir cuestionario
                  </Button>
                }
              />
            </div>
            {quizzes.length === 0 && (
              <p className="text-center text-sm text-muted-foreground">Este módulo todavía no tiene cuestionario.</p>
            )}
            {quizzes.map((quiz) => (
              <QuizCard
                key={quiz.id}
                quiz={quiz}
                contextLabel={`Cuestionario del módulo: ${module_.title}.`}
                onQuestionDragEnd={onQuestionDragEnd}
                sensors={sensors}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SortableLessonRow({ lesson }: { lesson: LessonItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lesson.id });
  const Icon = CONTENT_ICONS[lesson.contentType];

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label="Reordenar lección"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Icon className="h-4 w-4 shrink-0 text-primary" />
      <span className="flex-1 text-sm text-foreground">{lesson.title}</span>
      <span className="text-xs text-muted-foreground">{LESSON_CONTENT_TYPE_LABELS[lesson.contentType]}</span>
      {lesson.isRequired && <Badge className="bg-primary/10 text-primary text-xs">Obligatoria</Badge>}
      <LessonFormDialog
        mode="edit"
        action={updateLessonAction.bind(null, lesson.id)}
        defaultValues={{
          title: lesson.title,
          description: "",
          contentType: lesson.contentType,
          contentBody: lesson.contentBody ?? "",
          videoUrl: lesson.videoUrl ?? "",
          externalUrl: lesson.externalUrl ?? "",
          isRequired: lesson.isRequired,
          estimatedMinutes: lesson.estimatedMinutes,
          fileUrl: lesson.fileUrl,
        }}
        trigger={
          <Button type="button" variant="ghost" size="icon-sm">
            <Pencil className="h-4 w-4" />
          </Button>
        }
      />
      <DeleteConfirmButton
        title="¿Eliminar esta lección?"
        description="Esta acción no se puede deshacer."
        onConfirm={() => deleteLessonAction(lesson.id)}
      />
    </div>
  );
}

function QuizCard({
  quiz,
  contextLabel,
  onQuestionDragEnd,
  sensors,
}: {
  quiz: QuizItem;
  contextLabel: string;
  onQuestionDragEnd: (quizId: string, event: DragEndEvent) => void;
  sensors: ReturnType<typeof useSensors>;
}) {
  return (
    <div className="surface space-y-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <ListChecks className="h-4 w-4 shrink-0 text-primary" />
        <span className="font-medium text-foreground">{quiz.title}</span>
        <span className="text-xs text-muted-foreground">
          {quiz.questions.length} {quiz.questions.length === 1 ? "pregunta" : "preguntas"} · mínimo {quiz.passingScore}%
          · {quiz.maxAttempts} intentos
        </span>
        {quiz.timeLimitMinutes && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {quiz.timeLimitMinutes} min
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <QuizFormDialog
            mode="edit"
            action={updateQuizAction.bind(null, quiz.id)}
            moduleId={quiz.moduleId}
            contextLabel={contextLabel}
            defaultValues={{
              title: quiz.title,
              description: quiz.description ?? "",
              passingScore: quiz.passingScore,
              maxAttempts: quiz.maxAttempts,
              timeLimitMinutes: quiz.timeLimitMinutes,
              randomizeQuestions: quiz.randomizeQuestions,
              randomizeAnswers: quiz.randomizeAnswers,
              showResultsNow: quiz.showResultsNow,
            }}
            trigger={
              <Button type="button" variant="ghost" size="icon-sm">
                <Pencil className="h-4 w-4" />
              </Button>
            }
          />
          <DeleteConfirmButton
            title="¿Eliminar este cuestionario?"
            description="Se eliminarán también todas sus preguntas y los intentos registrados. Esta acción no se puede deshacer."
            onConfirm={() => deleteQuizAction(quiz.id)}
          />
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => onQuestionDragEnd(quiz.id, event)}>
        <SortableContext items={quiz.questions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {quiz.questions.length === 0 && (
              <p className="py-2 text-center text-sm text-muted-foreground">Sin preguntas todavía.</p>
            )}
            {quiz.questions.map((question, index) => (
              <SortableQuestionRow key={question.id} question={question} index={index} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <QuestionFormDialog
        mode="create"
        action={createQuestionAction.bind(null, quiz.id)}
        trigger={
          <Button type="button" variant="outline" size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Añadir pregunta
          </Button>
        }
      />
    </div>
  );
}

function SortableQuestionRow({ question, index }: { question: QuestionItem; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border border-border bg-background px-3 py-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label="Reordenar pregunta"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="text-xs font-semibold text-muted-foreground">P{index + 1}</span>
        <span className="flex-1 text-sm text-foreground">{question.statement}</span>
        <span className="text-xs text-muted-foreground">{QUESTION_TYPE_LABELS[question.type]}</span>
        <Badge className="bg-muted text-muted-foreground text-xs">{question.score} pts</Badge>
        <QuestionFormDialog
          mode="edit"
          action={updateQuestionAction.bind(null, question.id)}
          defaultValues={{
            type: question.type,
            statement: question.statement,
            score: question.score,
            explanation: question.explanation ?? "",
            options: question.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })),
          }}
          trigger={
            <Button type="button" variant="ghost" size="icon-sm">
              <Pencil className="h-4 w-4" />
            </Button>
          }
        />
        <DeleteConfirmButton
          title="¿Eliminar esta pregunta?"
          description="Esta acción no se puede deshacer."
          onConfirm={() => deleteQuestionAction(question.id)}
        />
      </div>
    </div>
  );
}
