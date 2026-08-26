import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSurveyAccess } from "@/lib/auth-helpers";
import { getEncuestaParaConstructor } from "@/lib/encuestas/consultas";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Constructor } from "@/components/encuestas/constructor";

/**
 * CONSTRUCTOR de una encuesta: bloques, preguntas, material embebido,
 * apariencia y publicación, todo en una sola vista de trabajo.
 */
export default async function ConstructorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSurveyAccess(id).catch(() => notFound());

  const encuesta = await getEncuestaParaConstructor(id);
  if (!encuesta) notFound();

  // Opciones de adscripción (plan y capacitación), con el alcance del rol.
  const sesion = await auth();
  const esAdmin = sesion?.user?.role === "ADMIN";
  const [planes, actividades] = await Promise.all([
    prisma.trainingPlan.findMany({
      where: esAdmin ? {} : { activities: { some: { area: { tutorId: sesion?.user?.id } } } },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    prisma.trainingActivity.findMany({
      // La actividad YA adscrita entra siempre, aunque esté cerrada: si no,
      // el select la mostraría vacía y guardar la borraría en silencio.
      where: {
        OR: [
          esAdmin
            ? { status: { not: "CLOSED" } }
            : { status: { not: "CLOSED" }, area: { tutorId: sesion?.user?.id } },
          ...(encuesta.trainingActivityId ? [{ id: encuesta.trainingActivityId }] : []),
        ],
      },
      select: { id: true, title: true, planId: true, plan: { select: { title: true } } },
      orderBy: { title: "asc" },
    }),
  ]);

  return (
    <div>
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <Link
          href="/encuestas"
          className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Encuestas
        </Link>

        <Constructor
          encuesta={JSON.parse(JSON.stringify(encuesta))}
          adscripcion={{
            planes: planes.map((p) => ({ id: p.id, titulo: p.title })),
            actividades: actividades.map((a) => ({
              id: a.id,
              titulo: a.title,
              planId: a.planId,
              plan: a.plan.title,
            })),
          }}
        />
      </div>
    </div>
  );
}
