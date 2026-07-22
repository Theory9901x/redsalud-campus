import Link from "next/link";
import { ClipboardList, CheckCircle2 } from "lucide-react";
import { auth } from "@/auth";
import { getSurveysForUser } from "@/lib/surveys";
import { EmptyState } from "@/components/brand/empty-state";
import { StaggerSections } from "@/components/brand/stagger-sections";

export default async function MisEncuestasPage() {
  const session = await auth();
  const userId = session!.user.id;

  const { pending, answered } = await getSurveysForUser(userId);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
      <StaggerSections className="space-y-10">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-foreground">Mis encuestas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Encuestas de opinión de tus capacitaciones: no tienen nota, solo buscan conocer tu punto de vista.
          </p>
        </div>

        <section className="surface-panel p-6 sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/[0.07] blur-3xl" />
          <div className="relative space-y-4">
            <div className="flex items-center gap-3">
              <span className="h-8 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-primary to-success" />
              <h2 className="font-display text-2xl font-extrabold text-foreground">Pendientes</h2>
            </div>
            {pending.length === 0 ? (
              <EmptyState icon={ClipboardList} title="Sin encuestas pendientes" description="Cuando tengas una asignada, aparecerá aquí." />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {pending.map((survey) => (
                  <Link
                    key={survey.id}
                    href={`/mis-encuestas/${survey.id}`}
                    className="surface-clay flex items-center gap-4 p-5 transition-all duration-200 hover:-translate-y-0.5"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <ClipboardList className="h-6 w-6" />
                    </span>
                    <div className="flex-1">
                      <p className="font-display text-sm font-bold text-foreground">{survey.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {survey.trainingActivity ? survey.trainingActivity.title : survey.trainingPlan.title} ·{" "}
                        {survey._count.questions} {survey._count.questions === 1 ? "pregunta" : "preguntas"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="surface-panel p-6 sm:p-8">
          <div className="pointer-events-none absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-success/[0.07] blur-3xl" />
          <div className="relative space-y-4">
            <div className="flex items-center gap-3">
              <span className="h-8 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-primary to-success" />
              <h2 className="font-display text-2xl font-extrabold text-foreground">Respondidas</h2>
            </div>
            {answered.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="Aún no respondes ninguna" description="Las que respondas quedarán aquí como constancia." />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {answered.map((survey) => (
                  <div key={survey.id} className="surface-clay flex items-center gap-4 p-5 opacity-80">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-success/15 text-success">
                      <CheckCircle2 className="h-6 w-6" />
                    </span>
                    <div className="flex-1">
                      <p className="font-display text-sm font-bold text-foreground">{survey.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {survey.trainingActivity ? survey.trainingActivity.title : survey.trainingPlan.title}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </StaggerSections>
    </main>
  );
}
