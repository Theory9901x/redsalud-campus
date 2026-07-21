"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  ListTree,
  Lock,
  ListChecks,
  X,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SIGNATURE_DURATION, SIGNATURE_EASE, staggerContainer, fadeSlideUp } from "@/lib/motion";
import type { AulaModule, AulaQuiz } from "@/lib/aula";

/**
 * Nodo de la línea de tiempo de una lección/quiz: completada = check verde,
 * actual = anillo pulsante (pariente del pulso ECG), pendiente = círculo
 * gris, bloqueada = candado. El nodo vive SOBRE la línea vertical (z-10 +
 * fondo sólido) para que la línea no lo atraviese.
 */
function TimelineNode({
  state,
}: {
  state: "completed" | "current" | "pending" | "locked" | "failed";
}) {
  return (
    <span
      className={cn(
        "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 bg-card",
        state === "completed" && "border-success bg-success text-white",
        state === "current" && "pulse-node border-primary text-primary",
        state === "pending" && "border-black/15 text-muted-foreground",
        state === "locked" && "border-black/10 bg-muted text-muted-foreground/60",
        state === "failed" && "border-destructive text-destructive"
      )}
    >
      {state === "completed" && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      {state === "current" && <span className="h-2 w-2 rounded-full bg-primary" />}
      {state === "pending" && <span className="h-2 w-2 rounded-full bg-black/15" />}
      {state === "locked" && <Lock className="h-3 w-3" />}
      {state === "failed" && <XCircle className="h-3.5 w-3.5" />}
    </span>
  );
}

function timelineRowClass(active: boolean, unlocked: boolean) {
  return cn(
    "group relative flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition-[background-color,transform,box-shadow] duration-200",
    active && "bg-primary/10 font-medium text-primary",
    !active && unlocked && "text-foreground/80 hover:bg-black/5 hover:translate-x-0.5",
    !unlocked && "cursor-default text-muted-foreground/60"
  );
}

function QuizTimelineItem({ courseId, quiz, pathname }: { courseId: string; quiz: AulaQuiz; pathname: string }) {
  const href = `/aula/${courseId}/quiz/${quiz.id}`;
  const isActive = pathname === href;
  const failed = !quiz.passed && quiz.attemptsRemaining <= 0;
  const state = !quiz.unlocked ? "locked" : quiz.passed ? "completed" : failed ? "failed" : isActive ? "current" : "pending";

  const inner = (
    <>
      <TimelineNode state={state} />
      <span className="line-clamp-2 flex-1">{quiz.title}</span>
      <ListChecks className="h-3.5 w-3.5 shrink-0 opacity-50" />
    </>
  );

  if (!quiz.unlocked) {
    return <div className={timelineRowClass(false, false)}>{inner}</div>;
  }
  return (
    <Link href={href} className={timelineRowClass(isActive, true)}>
      {inner}
    </Link>
  );
}

/** Tarjeta claymórfica de un módulo: cabecera clicable + timeline desplegable. */
function ModuleCard({
  courseId,
  module_,
  moduleIndex,
  pathname,
  open,
  onToggle,
}: {
  courseId: string;
  module_: AulaModule;
  moduleIndex: number;
  pathname: string;
  open: boolean;
  onToggle: () => void;
}) {
  const total = module_.lessons.length + (module_.quiz ? 1 : 0);
  const done =
    module_.lessons.filter((l) => l.completed).length + (module_.quiz?.passed ? 1 : 0);
  const allDone = total > 0 && done === total;

  return (
    <motion.div variants={fadeSlideUp} className="clay-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-black/[0.03] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
      >
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold",
            allDone ? "bg-success/15 text-success" : "bg-primary/10 text-primary"
          )}
        >
          {allDone ? <Check className="h-4 w-4" strokeWidth={3} /> : moduleIndex + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-sm font-bold text-foreground">{module_.title}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {done}/{total} completadas
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300",
            open && "rotate-180"
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: SIGNATURE_DURATION, ease: SIGNATURE_EASE }}
            className="overflow-hidden"
          >
            <div className="border-t border-black/10 px-3 pb-3 pt-2">
              {/* Timeline vertical: línea de acento detrás de los nodos. */}
              <div className="relative">
                <span
                  aria-hidden="true"
                  className="absolute bottom-3 left-[19px] top-3 w-[2.5px] rounded-full bg-primary/20"
                />
                <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-0.5">
                  {module_.lessons.map((lesson) => {
                    const href = `/aula/${courseId}/${lesson.id}`;
                    const isActive = pathname === href;
                    const state = !lesson.unlocked
                      ? "locked"
                      : lesson.completed
                        ? "completed"
                        : isActive
                          ? "current"
                          : "pending";

                    const inner = (
                      <>
                        <TimelineNode state={state} />
                        <span className="line-clamp-2 flex-1">{lesson.title}</span>
                        {lesson.estimatedMinutes !== null && lesson.estimatedMinutes > 0 && (
                          <span className="shrink-0 text-[11px] text-muted-foreground">{lesson.estimatedMinutes} min</span>
                        )}
                      </>
                    );

                    if (!lesson.unlocked) {
                      return (
                        <motion.div key={lesson.id} variants={fadeSlideUp} className={timelineRowClass(false, false)}>
                          {inner}
                        </motion.div>
                      );
                    }
                    return (
                      <motion.div key={lesson.id} variants={fadeSlideUp}>
                        <Link href={href} className={timelineRowClass(isActive, true)}>
                          {inner}
                        </Link>
                      </motion.div>
                    );
                  })}
                  {module_.quiz && (
                    <motion.div variants={fadeSlideUp}>
                      <QuizTimelineItem courseId={courseId} quiz={module_.quiz} pathname={pathname} />
                    </motion.div>
                  )}
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
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

  // Módulo abierto por defecto: el que contiene la lección/quiz activa (o el
  // primero). Se re-sincroniza al navegar para que el acordeón siga al usuario.
  const findActiveModule = () =>
    modules.find(
      (m) =>
        m.lessons.some((l) => pathname === `/aula/${courseId}/${l.id}`) ||
        (m.quiz && pathname === `/aula/${courseId}/quiz/${m.quiz.id}`)
    )?.id ??
    modules[0]?.id ??
    null;

  const [openModuleId, setOpenModuleId] = useState<string | null>(findActiveModule);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const active = findActiveModule();
    if (active) setOpenModuleId(active);
    setDrawerOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const nav = (
    <motion.nav variants={staggerContainer} initial="hidden" animate="show" className="flex-1 space-y-3 overflow-y-auto p-4">
      {modules.map((module_, moduleIndex) => (
        <ModuleCard
          key={module_.id}
          courseId={courseId}
          module_={module_}
          moduleIndex={moduleIndex}
          pathname={pathname}
          open={openModuleId === module_.id}
          onToggle={() => setOpenModuleId((prev) => (prev === module_.id ? null : module_.id))}
        />
      ))}

      {finalQuizzes.length > 0 && (
        <motion.div variants={fadeSlideUp} className="clay-card overflow-hidden p-3">
          <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Evaluación final
          </p>
          <div className="space-y-0.5">
            {finalQuizzes.map((quiz) => (
              <QuizTimelineItem key={quiz.id} courseId={courseId} quiz={quiz} pathname={pathname} />
            ))}
          </div>
        </motion.div>
      )}
    </motion.nav>
  );

  const header = (
    <div className="border-b border-black/10 p-4">
      <p className="font-display text-sm font-bold leading-snug text-foreground">{courseTitle}</p>
      <div className="mt-2.5 flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/10">
          <div className="progress-fill-animated h-full rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-xs font-semibold text-foreground/70">{progress}%</span>
      </div>
    </div>
  );

  return (
    <>
      {/* Móvil: botón flotante que abre el temario como drawer deslizante. */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="clay-card fixed bottom-5 left-4 z-40 flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-foreground transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-primary lg:hidden"
      >
        <ListTree className="h-4 w-4 text-primary" />
        Contenido del curso
      </button>

      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-navy/40 backdrop-blur-sm lg:hidden"
              onClick={() => setDrawerOpen(false)}
              aria-hidden="true"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: SIGNATURE_DURATION, ease: SIGNATURE_EASE }}
              className="surface-glass fixed inset-y-0 left-0 z-50 flex w-[85vw] max-w-sm flex-col rounded-none rounded-r-[22px] lg:hidden"
            >
              <div className="flex items-center justify-between border-b border-black/10 p-4">
                <p className="font-display text-sm font-bold text-foreground">Contenido del curso</p>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Cerrar temario"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/5 hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {header}
              {nav}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Escritorio: panel glass fijo a la izquierda. */}
      <aside className="surface-glass sticky top-0 hidden h-screen w-80 shrink-0 flex-col self-start overflow-hidden rounded-none rounded-r-[22px] border-l-0 lg:flex">
        {header}
        {nav}
      </aside>
    </>
  );
}
