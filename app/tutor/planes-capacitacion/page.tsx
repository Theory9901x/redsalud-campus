import Link from "next/link";
import { Plus, LayoutDashboard, GraduationCap } from "lucide-react";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { getTrainingPlans } from "@/lib/training-plans";
import { TrainingPlanList } from "@/components/training-plans/training-plan-list";
import { ModuloHero } from "@/components/training-plans/modulo-hero";
import { RielTrimestres, conteoPorTrimestre } from "@/components/training-plans/plan-visual";
import { nombreTrimestre, trimestreEnCurso } from "@/components/training-plans/trimestres-chip";
import { PestanasPlanTutor } from "@/components/en-vivo/pestanas-plan-tutor";

export default async function TutorPlanesCapacitacionPage() {
  const session = await requireTutorOrAdmin();
  const plans = await getTrainingPlans(session.user.role, session.user.id);

  const actividades = plans.flatMap((p) => p.activities);
  const enCurso = trimestreEnCurso();

  return (
    <div className="space-y-6">
      <PestanasPlanTutor activa="planes" />
      <ModuloHero
        eyebrow="Tu espacio de tutor"
        Icono={GraduationCap}
        titulo="Mis planes de"
        acento="capacitación"
        descripcion={`${plans.length} ${plans.length === 1 ? "plan" : "planes"} a tu cargo. Entra a uno para gestionar el cronograma, la asistencia y las métricas de tus capacitaciones.`}
        acciones={
          <>

            {session.user.role === "ADMIN" && (
              <Link
                href="/tutor/planes-capacitacion/nuevo"
                className="boton-hero"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Nuevo plan
              </Link>
            )}
            <Link href="/tutor/planes-capacitacion/dashboard" className="enlace-hero">
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
              Dashboard
            </Link>
          </>
        }
        cifras={[
          { valor: plans.length, etiqueta: "Planes" },
          { valor: actividades.length, etiqueta: "Capacitaciones" },
          { valor: actividades.filter((a) => a.status === "OPEN").length, etiqueta: "Abiertas hoy" },
          { valor: actividades.filter((a) => a.quarters.includes(enCurso)).length, etiqueta: `En el ${nombreTrimestre(enCurso, false).toLowerCase()}` },
        ]}
        pie={actividades.length > 0 ? <RielTrimestres conteos={conteoPorTrimestre(actividades)} oscuro conMeses /> : undefined}
      />

      <TrainingPlanList plans={plans} basePath="/tutor/planes-capacitacion" showTutorColumn={false} />
    </div>
  );
}
