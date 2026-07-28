import { Users, ClipboardList, CheckCircle2, UserX, Award, Percent } from "lucide-react";
import { KpiCard } from "@/components/dashboard/dashboard-kit";
import { getIndicadores } from "@/lib/admin-dashboard";
import type { FiltrosPanel } from "@/lib/admin-dashboard";

/**
 * Los seis indicadores de cabecera.
 *
 * Los porcentajes muestran "—" cuando no hay ni un dato del que sacarlos. Un
 * "0 %" en su lugar se lee como "todos reprobaron" o "nadie completó", que es
 * una afirmación distinta a "todavía no ha pasado nada" y llevaría a Talento
 * Humano a tomar decisiones sobre un fracaso que no ha ocurrido.
 */
export async function Indicadores({ filtros }: { filtros: FiltrosPanel }) {
  const d = await getIndicadores(filtros);

  return (
    <div className="grid-densidad">
      <KpiCard label="Personas activas" value={d.personas} icon={Users} href="/admin/usuarios" />
      <KpiCard label="Inscripciones" value={d.inscripciones} icon={ClipboardList} href="/admin/inscripciones" />
      <KpiCard
        label="Formación completada"
        value={d.porcentajeCompletado !== null ? `${d.porcentajeCompletado}%` : "—"}
        icon={CheckCircle2}
        trend={
          d.porcentajeCompletado !== null
            ? { text: `${d.completadas} de ${d.inscripciones}`, positive: d.porcentajeCompletado >= 60 }
            : undefined
        }
      />
      <KpiCard
        label="Nunca han ingresado"
        value={d.sinIngresar}
        icon={UserX}
        trend={
          d.personas > 0
            ? {
                text: `${Math.round((d.sinIngresar / d.personas) * 100)}% del personal`,
                positive: d.sinIngresar === 0,
              }
            : undefined
        }
      />
      <KpiCard label="Certificados emitidos" value={d.certificados} icon={Award} href="/admin/certificados" />
      <KpiCard
        label="Promedio de aprobación"
        value={d.promedioAprobacion !== null ? `${d.promedioAprobacion}%` : "—"}
        icon={Percent}
      />
    </div>
  );
}
