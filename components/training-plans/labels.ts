import { GraduationCap, Presentation } from "lucide-react";
import type {
  TrainingPlanStatus,
  TrainingActivityType,
  TrainingActivityStatus,
  TrainingModality,
  SessionShift,
} from "@prisma/client";

export const TRAINING_PLAN_STATUS_LABELS: Record<TrainingPlanStatus, string> = {
  DRAFT: "Borrador",
  ACTIVE: "Activo",
  CLOSED: "Cerrado",
  ARCHIVED: "Archivado",
};

export const TRAINING_PLAN_STATUS_CLASSES: Record<TrainingPlanStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ACTIVE: "bg-success/10 text-success",
  CLOSED: "bg-navy/10 text-navy",
  ARCHIVED: "bg-destructive/10 text-destructive",
};

export const TRAINING_ACTIVITY_TYPE_LABELS: Record<TrainingActivityType, string> = {
  COURSE: "Curso de la plataforma",
  EXTERNAL_EVENT: "Evento externo",
};

export const TRAINING_ACTIVITY_TYPE_ICONS: Record<TrainingActivityType, typeof GraduationCap> = {
  COURSE: GraduationCap,
  EXTERNAL_EVENT: Presentation,
};

/** Ciclo de vida de la jornada (Etapa 6 construye el flujo; el label ya existe desde la Etapa 1). */
export const TRAINING_ACTIVITY_STATUS_LABELS: Record<TrainingActivityStatus, string> = {
  DRAFT: "Borrador",
  OPEN: "Abierta",
  CLOSED: "Cerrada",
};

export const TRAINING_ACTIVITY_STATUS_CLASSES: Record<TrainingActivityStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  OPEN: "bg-success/10 text-success",
  CLOSED: "bg-navy/10 text-navy",
};

export const TRAINING_MODALITY_LABELS: Record<TrainingModality, string> = {
  VIRTUAL: "Virtual",
  PRESENCIAL: "Presencial",
  MIXTA: "Mixta",
};

export const SESSION_SHIFT_LABELS: Record<SessionShift, string> = {
  MANANA: "Mañana",
  TARDE: "Tarde",
};

const FORMATO_FECHA_HORA = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const FORMATO_HORA = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit" });

/** "12 de mayo de 2026, 8:00 a. m. – 10:00 a. m." — la jornada real, no el trimestre del plan. */
export function etiquetaJornada(sesion: { startsAt: Date; endsAt: Date | null }): string {
  const inicio = FORMATO_FECHA_HORA.format(sesion.startsAt);
  return sesion.endsAt ? `${inicio} – ${FORMATO_HORA.format(sesion.endsAt)}` : inicio;
}

/**
 * Semaforización única para todo el módulo: verde cumple el objetivo,
 * amarillo requiere seguimiento, rojo requiere acción, gris es "todavía sin
 * datos" -no es lo mismo que 0%, que sí es una medición real-.
 *
 * Un solo lugar para el umbral evita que cada pantalla invente su propio
 * corte y dos tableros digan cosas distintas del mismo número.
 */
export type NivelSemaforo = "success" | "warning" | "destructive" | "muted";

export function nivelSemaforo(porcentaje: number | null): NivelSemaforo {
  if (porcentaje === null) return "muted";
  if (porcentaje >= 85) return "success";
  if (porcentaje >= 70) return "warning";
  return "destructive";
}

export const SEMAFORO_CLASSES: Record<NivelSemaforo, string> = {
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  destructive: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

const NUMERO_ROMANO = ["I", "II", "III", "IV"] as const;
const FORMATO_FECHA = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric" });

/** "I", "I y III", "I, II y IV" — como los nombra el PIC. */
export function etiquetaTrimestres(quarters: number[]): string | null {
  const romanos = [...quarters]
    .sort((a, b) => a - b)
    .map((q) => NUMERO_ROMANO[q - 1])
    .filter(Boolean);
  if (romanos.length === 0) return null;
  if (romanos.length === 1) return `Trimestre ${romanos[0]}`;
  return `Trimestres ${romanos.slice(0, -1).join(", ")} y ${romanos[romanos.length - 1]}`;
}

/**
 * Cómo se anuncia CUÁNDO ocurre una actividad.
 *
 * El PIC programa por trimestre, no por fecha: la mayoría de las actividades
 * no tiene día hasta que alguien agenda la jornada. Antes de esto la fecha
 * era obligatoria y había que inventarse una para poder importar el plan
 * —un 1 de enero falso en el cronograma es peor que decir "Trimestre I"—.
 */
export function etiquetaProgramacion(activity: {
  startDate: Date | null;
  endDate?: Date | null;
  quarters?: number[];
  /** La próxima jornada agendada, si ya hay una: manda sobre la fecha/trimestre del plan. */
  sessions?: { startsAt: Date }[];
  _count?: { sessions: number };
}): string {
  const proxima = activity.sessions?.[0];
  if (proxima) {
    const restantes = (activity._count?.sessions ?? 1) - 1;
    const fecha = etiquetaJornada({ startsAt: proxima.startsAt, endsAt: null });
    return restantes > 0 ? `${fecha} (+${restantes})` : fecha;
  }
  if (activity.startDate) {
    const inicio = FORMATO_FECHA.format(activity.startDate);
    return activity.endDate ? `${inicio} — ${FORMATO_FECHA.format(activity.endDate)}` : inicio;
  }
  return etiquetaTrimestres(activity.quarters ?? []) ?? "Sin programar";
}
