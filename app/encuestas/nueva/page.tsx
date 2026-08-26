import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { FormularioNuevaEncuesta } from "@/components/encuestas/formulario-nueva";

/**
 * Crear una encuesta. El formulario pide lo mínimo -título, audiencia y,
 * opcionalmente, la capacitación a la que pertenece o una plantilla de la
 * que partir-; todo lo demás se define en el constructor.
 */
export default async function NuevaEncuestaPage() {
  const sesion = await requireTutorOrAdmin();

  // Un tutor solo puede colgar la encuesta de jornadas de sus áreas.
  const actividades = await prisma.trainingActivity.findMany({
    where:
      sesion.user.role === "ADMIN"
        ? { status: { not: "CLOSED" } }
        : { status: { not: "CLOSED" }, area: { tutorId: sesion.user.id } },
    select: { id: true, title: true, plan: { select: { title: true } } },
    orderBy: { title: "asc" },
  });

  const plantillas = await prisma.survey.findMany({
    where: { isTemplate: true },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });

  return (
    <main className="canvas-vivo min-h-screen">
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <Link
          href="/encuestas"
          className="mb-5 flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Encuestas
        </Link>

        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
          <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
          Módulo de encuestas
        </p>
        <h1 className="mt-2 font-display text-[clamp(1.7rem,3.5vw,2.2rem)] font-extrabold leading-tight tracking-tight text-foreground">
          Nueva{" "}
          <span className="bg-gradient-to-r from-primary to-success bg-clip-text text-transparent">encuesta</span>
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          Define lo esencial; los bloques y las preguntas se arman en el constructor.
        </p>

        <div className="surface-vivo mt-7">
          <div className="p-6">
            <FormularioNuevaEncuesta
              actividades={actividades.map((a) => ({ id: a.id, titulo: a.title, plan: a.plan.title }))}
              plantillas={plantillas.map((p) => ({ id: p.id, titulo: p.title }))}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
