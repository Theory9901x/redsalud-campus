import { Star } from "lucide-react";
import type { TipoVinculacion } from "@prisma/client";

export const VINCULACION_LABELS: Record<TipoVinculacion, string> = {
  CARRERA_ADMINISTRATIVA: "Carrera administrativa",
  PROVISIONALIDAD: "Provisionalidad",
  TEMPORAL: "Temporal",
  TRABAJADOR_OFICIAL: "Trabajador oficial",
  LIBRE_NOMBRAMIENTO: "Libre nombramiento y remoción",
  PERIODO_FIJO: "Periodo fijo",
  CONTRATO_PRESTACION: "Contrato de prestación de servicios",
  OTRO: "Otro",
};

/** Es de planta todo el que está en el plan de cargos, es decir, quien no es contratista. */
export function esPlanta(tipo: TipoVinculacion) {
  return tipo !== "CONTRATO_PRESTACION";
}

/**
 * Estrella que identifica al personal de planta, con el tipo de vinculación
 * en el tooltip. Los contratistas no la llevan, pero su vinculación sí se
 * muestra en la ficha.
 */
export function MarcaPlanta({ tipo, className }: { tipo: TipoVinculacion; className?: string }) {
  if (!esPlanta(tipo)) return null;
  return (
    <span title={`Personal de planta · ${VINCULACION_LABELS[tipo]}`} className={className}>
      <Star className="inline h-3.5 w-3.5 fill-warning text-warning" aria-label="Personal de planta" />
    </span>
  );
}
