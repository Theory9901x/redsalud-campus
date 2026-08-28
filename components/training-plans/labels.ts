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

/*
 * FECHAS DETERMINISTAS.
 *
 * Estas etiquetas se pintan tanto en el servidor como en componentes
 * cliente (el cronograma), así que NO pueden depender de dos cosas que
 * cambian entre Node y el navegador: el literal que cada ICU pone entre la
 * fecha y la hora ("2026, 7:42" en Node, "2026 a las 7:42" en Chrome) y la
 * zona horaria (UTC en el VPS, Colombia en el equipo de la persona). Ambas
 * hacían fallar la hidratación (React #418). Se toman solo las PARTES
 * numéricas/nominales en zona Bogotá y el texto se arma a mano.
 */
const ZONA = "America/Bogota";

function partes(fecha: Date, opciones: Intl.DateTimeFormatOptions): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat("es-CO", { timeZone: ZONA, ...opciones }).formatToParts(fecha)) {
    if (p.type !== "literal") salida[p.type] = p.value;
  }
  return salida;
}

/**
 * "7:42 p. m." — el "a. m./p. m." se arma a mano: el ICU de Node lo separa
 * con un espacio normal y el de Chrome con un espacio estrecho (U+202F), y
 * esa diferencia invisible también rompía la hidratación.
 */
export function etiquetaHora(fecha: Date): string {
  const p = partes(fecha, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const hora24 = Number(p.hour);
  const hora12 = hora24 % 12 === 0 ? 12 : hora24 % 12;
  return `${hora12}:${p.minute} ${hora24 < 12 ? "a. m." : "p. m."}`;
}

/** "25 de agosto de 2026" */
export function etiquetaFecha(fecha: Date): string {
  const p = partes(fecha, { day: "numeric", month: "long", year: "numeric" });
  return `${p.day} de ${p.month} de ${p.year}`;
}

/** "12 de mayo de 2026, 8:00 a. m. – 10:00 a. m." — la jornada real, no el trimestre del plan. */
export function etiquetaJornada(sesion: { startsAt: Date; endsAt: Date | null }): string {
  const inicio = `${etiquetaFecha(sesion.startsAt)}, ${etiquetaHora(sesion.startsAt)}`;
  return sesion.endsAt ? `${inicio} – ${etiquetaHora(sesion.endsAt)}` : inicio;
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
    const inicio = etiquetaFecha(activity.startDate);
    return activity.endDate ? `${inicio} — ${etiquetaFecha(activity.endDate)}` : inicio;
  }
  return etiquetaTrimestres(activity.quarters ?? []) ?? "Sin programar";
}

/**
 * Bajo qué trimestre conviene LISTAR una capacitación hoy.
 *
 * El cronograma la archivaba bajo su primer trimestre, y eso hacía que una
 * línea marcada "T1,2,3" -que sigue vigente y abierta- apareciera dentro del
 * primer trimestre, ya vencido. Quien abría el cronograma en agosto veía el
 * apartado del I trimestre lleno de capacitaciones abiertas y concluía, con
 * razón, que había contenido viejo mezclado.
 *
 * Se archiva bajo el primer trimestre suyo que no haya pasado; si todos
 * pasaron, bajo el último, que es donde de verdad terminó. La programación
 * completa se sigue viendo en la fila ("Trimestres I, II y III"), así que no
 * se pierde el dato de que también cubría los anteriores.
 */
export function trimestreParaListar(quarters: number[], hoy: Date = new Date()): number {
  if (quarters.length === 0) return 0;
  const enCurso = Math.floor(hoy.getMonth() / 3) + 1;
  const vigentes = quarters.filter((q) => q >= enCurso).sort((a, b) => a - b);
  return vigentes[0] ?? Math.max(...quarters);
}
