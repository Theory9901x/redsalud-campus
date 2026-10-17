import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { FormularioNuevaEncuesta } from "@/components/encuestas/formulario-nueva";
import { CODIGO_SIAU } from "@/lib/encuestas/metrics";

/**
 * Crear una encuesta. El formulario pide lo mínimo -título, audiencia y,
 * opcionalmente, su lugar en el sistema: área › plan › capacitación, o una
 * plantilla de la que partir-; todo lo demás se define en el constructor.
 *
 * Para el TUTOR (un área del plan) es siempre la encuesta de «Satisfacción
 * de la capacitación», adscrita a una capacitación de su área y opcional: la
 * crea solo si el área lo desea. Nunca ve las plantillas de la SIAU.
 */
export default async function NuevaEncuestaPage({ searchParams }: { searchParams: Promise<{ plan?: string; actividad?: string }> }) {
  const { plan: planInicial, actividad: actividadInicial } = await searchParams;
  const sesion = await requireTutorOrAdmin();
  const esAdmin = sesion.user.role === "ADMIN";
  const deMiArea = { OR: [{ area: { tutorId: sesion.user.id } }, { plan: { tutorId: sesion.user.id } }] };

  // Un tutor solo ve sus áreas y lo que cuelga de ellas; el administrador,
  // todo. Es la misma trazabilidad área › plan › capacitación del resto
  // del sistema.
  const [areas, actividades] = await Promise.all([
    prisma.trainingArea.findMany({
      where: esAdmin ? {} : { tutorId: sesion.user.id },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.trainingActivity.findMany({
      where: esAdmin
        ? { status: { not: "CLOSED" } }
        : { status: { not: "CLOSED" }, plan: { kind: "CAPACITACION" }, ...deMiArea },
      select: {
        id: true,
        title: true,
        planId: true,
        areaId: true,
        plan: { select: { title: true } },
      },
      orderBy: { title: "asc" },
    }),
  ]);

  const planes = await prisma.trainingPlan.findMany({
    where: esAdmin ? {} : { kind: "CAPACITACION", activities: { some: { status: { not: "CLOSED" }, ...deMiArea } } },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });

  const plantillas = await prisma.survey.findMany({
    where: esAdmin ? { isTemplate: true } : { isTemplate: true, NOT: { code: { startsWith: CODIGO_SIAU } } },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });

  return (
    <div>
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <Link
          href="/encuestas"
          className="mb-5 flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Encuestas
        </Link>

        <p className="mono-label flex items-center gap-1.5 text-primary">
          <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
          Módulo de encuestas · Paso 1 de 2
        </p>
        <h1 className="mt-2 font-display text-[clamp(1.6rem,3.2vw,2rem)] font-bold leading-tight tracking-tight text-foreground">
          {esAdmin ? "Nueva encuesta" : "Satisfacción de la capacitación"}
        </h1>
        <p className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
          {esAdmin
            ? "Define lo esencial; los bloques y las preguntas se arman en el constructor."
            : "Opcional: créala solo si el área así lo desea, para conocer cómo valoraron la capacitación quienes asistieron. Elige la capacitación; los bloques y las preguntas se arman en el constructor."}
        </p>

        <div className="barra-modulo mt-6">
          <div className="p-6">
            <FormularioNuevaEncuesta
              areas={areas.map((a) => ({ id: a.id, nombre: a.name }))}
              planes={planes.map((p) => ({ id: p.id, titulo: p.title }))}
              actividades={actividades.map((a) => ({
                id: a.id,
                titulo: a.title,
                planId: a.planId,
                areaId: a.areaId,
                plan: a.plan.title,
              }))}
              plantillas={plantillas.map((p) => ({ id: p.id, titulo: p.title }))}
              inicial={{ planId: planInicial, actividadId: actividadInicial }}
              modo={esAdmin ? "libre" : "satisfaccion"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
