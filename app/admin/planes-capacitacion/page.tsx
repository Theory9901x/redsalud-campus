import Link from "next/link";
import { Plus, LayoutDashboard, GraduationCap } from "lucide-react";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { getTrainingPlans } from "@/lib/training-plans";
import { TrainingPlanList } from "@/components/training-plans/training-plan-list";
import { PestanasModulo } from "@/components/comites/pestanas-modulo";
import { ModuloHero } from "@/components/training-plans/modulo-hero";
import { RielTrimestres, conteoPorTrimestre } from "@/components/training-plans/plan-visual";
import { nombreTrimestre, trimestreEnCurso } from "@/components/training-plans/trimestres-chip";

export default async function AdminPlanesCapacitacionPage() {
  const session = await requireTutorOrAdmin();
  const plans = await getTrainingPlans(session.user.role, session.user.id);

  const actividades = plans.flatMap((p) => p.activities);
  const enCurso = trimestreEnCurso();
  const delTrimestre = actividades.filter((a) => a.quarters.includes(enCurso)).length;

  return (
    <div className="space-y-6">
      <PestanasModulo activa="planes" />

      <ModuloHero
        eyebrow="Formación · Talento Humano"
        Icono={GraduationCap}
        titulo="Planes de"
        acento="capacitación"
        descripcion={
          <>
            {plans.length} {plans.length === 1 ? "plan" : "planes"} en toda la institución. Cada plan organiza sus capacitaciones
            por trimestre, área y responsable; entra a uno para gestionar su cronograma, asistencia y métricas.
          </>
        }
        acciones={
          <>
            <Link
              href="/admin/planes-capacitacion/nuevo"
              className="boton-hero"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nuevo plan
            </Link>
            <Link href="/admin/planes-capacitacion/dashboard" className="enlace-hero">
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
              Dashboard del módulo
            </Link>
          </>
        }
        cifras={[
          { valor: plans.filter((p) => p.status === "ACTIVE").length, etiqueta: "Planes activos" },
          { valor: actividades.length, etiqueta: "Capacitaciones" },
          { valor: actividades.filter((a) => a.status === "OPEN").length, etiqueta: "Abiertas hoy" },
          { valor: delTrimestre, etiqueta: `En el ${nombreTrimestre(enCurso, false).toLowerCase()}` },
        ]}
        pie={actividades.length > 0 ? <RielTrimestres conteos={conteoPorTrimestre(actividades)} oscuro conMeses /> : undefined}
      />

      <TrainingPlanList plans={plans} basePath="/admin/planes-capacitacion" showTutorColumn puedeEliminar />
    </div>
  );
}
