import Link from "next/link";
import { UserX, LogIn, PlayCircle, CheckCircle2, FolderX } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/brand/empty-state";
import { ESTADO_FORMACION_LABEL, getEmbudo } from "@/lib/admin-dashboard";
import type { EstadoFormacion, FiltrosPanel } from "@/lib/admin-dashboard";

/**
 * Cada paso lleva ícono y color propios: la separación de la serie de datos
 * con daltonismo está en la banda mínima, así que el color nunca es la única
 * forma de distinguir un paso de otro (ver --data-* en globals.css).
 */
const PASOS: Record<EstadoFormacion, { icono: LucideIcon; color: string; ayuda: string }> = {
  SIN_ASIGNAR: {
    icono: FolderX,
    color: "var(--data-2)",
    ayuda: "Nadie les asignó un curso todavía. Depende de Talento Humano, no de ellos.",
  },
  SIN_INGRESAR: {
    icono: UserX,
    color: "var(--data-4)",
    ayuda: "Nunca abrieron la plataforma. Necesitan que les llegue el acceso.",
  },
  SIN_AVANCE: {
    icono: LogIn,
    color: "var(--data-5)",
    ayuda: "Entraron pero no empezaron ningún contenido.",
  },
  EN_CURSO: {
    icono: PlayCircle,
    color: "var(--data-3)",
    ayuda: "Ya están avanzando en algún curso.",
  },
  COMPLETADO: {
    icono: CheckCircle2,
    color: "var(--data-1)",
    ayuda: "Terminaron al menos un curso completo.",
  },
};

export async function EmbudoParticipacion({ filtros }: { filtros: FiltrosPanel }) {
  const pasos = await getEmbudo(filtros);
  const total = pasos.reduce((a, p) => a + p.personas, 0);

  if (total === 0) {
    return (
      <EmptyState
        icon={UserX}
        title="Sin personal en este filtro"
        description="Ajusta los filtros para ver el estado de participación."
      />
    );
  }

  return (
    <ul className="space-y-3">
      {pasos.map((paso) => {
        const { icono: Icono, color, ayuda } = PASOS[paso.estado];
        const pct = Math.round((paso.personas / total) * 100);
        return (
          <li key={paso.estado}>
            <Link
              href={`/admin?estado=${paso.estado}`}
              className="group block rounded-xl px-2 py-1.5 transition-colors hover:bg-muted/60"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    backgroundColor: `color-mix(in oklch, ${color} 16%, transparent)`,
                    color,
                  }}
                >
                  <Icono className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {ESTADO_FORMACION_LABEL[paso.estado]}
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-foreground">{paso.personas}</span>
                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{pct}%</span>
              </div>
              <div className="mt-1.5 ml-[38px] h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
              </div>
              <p className="ml-[38px] mt-1 text-[11px] leading-tight text-muted-foreground">{ayuda}</p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
