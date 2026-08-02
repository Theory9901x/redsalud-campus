/**
 * La máquina de estados del ciclo presaber/postsaber, como funciones puras.
 *
 * Sin Prisma a propósito, igual que lib/formacion.ts: la usan tanto páginas
 * de servidor como componentes de cliente (el banner que le dice al
 * estudiante qué está presentando), y no todo lo que la necesita puede
 * importar el cliente de Prisma.
 */

export type VentanasEvaluacion = {
  presaberOpenedAt: Date | null;
  presaberClosedAt: Date | null;
  postsaberOpenedAt: Date | null;
  postsaberClosedAt: Date | null;
};

export type MomentoEvaluacion = "PRESABER" | "POSTSABER";

export type EstadoMomento = "NO_CONFIGURADO" | "DISPONIBLE" | "CERRADO";

/**
 * Estado de una ventana puntual: sin abrir nunca, abierta, o abierta y ya
 * cerrada. No distingue "cerrada antes de que nadie la presentara" de
 * "cerrada después de mucha gente": eso lo dice la lista de intentos, no la
 * ventana en sí.
 */
function estadoVentana(abierta: Date | null, cerrada: Date | null): EstadoMomento {
  if (!abierta) return "NO_CONFIGURADO";
  if (cerrada) return "CERRADO";
  return "DISPONIBLE";
}

export function estadoPresaber(v: VentanasEvaluacion): EstadoMomento {
  return estadoVentana(v.presaberOpenedAt, v.presaberClosedAt);
}

export function estadoPostsaber(v: VentanasEvaluacion): EstadoMomento {
  return estadoVentana(v.postsaberOpenedAt, v.postsaberClosedAt);
}

/**
 * Puede habilitarse el postsaber: solo cuando el presaber ya cerró. Se
 * presenta antes de la capacitación y luego después, no en paralelo -si
 * ambos quedaran abiertos a la vez, alguien podría "mejorar" su presaber
 * mirando el postsaber, o al revés-.
 */
export function puedeHabilitarPostsaber(v: VentanasEvaluacion): boolean {
  return estadoPresaber(v) === "CERRADO" && estadoPostsaber(v) === "NO_CONFIGURADO";
}

/**
 * Qué momento está presentando alguien que entra a la evaluación AHORA, o
 * null si ninguna ventana está abierta -la evaluación no está disponible-.
 * El postsaber manda si las dos llegaran a estar abiertas a la vez (no
 * debería pasar por la regla de arriba, pero si pasa, es la más reciente).
 */
export function momentoActivo(v: VentanasEvaluacion): MomentoEvaluacion | null {
  if (estadoPostsaber(v) === "DISPONIBLE") return "POSTSABER";
  if (estadoPresaber(v) === "DISPONIBLE") return "PRESABER";
  return null;
}

export const MOMENTO_LABEL: Record<MomentoEvaluacion, string> = {
  PRESABER: "Presaber",
  POSTSABER: "Postsaber",
};

/** Diferencia y variación entre dos promedios, redondeadas para mostrar. */
export function compararAdherencia(presaberPct: number, postsaberPct: number) {
  const diferencia = Math.round(postsaberPct - presaberPct);
  const variacion = presaberPct > 0 ? Math.round(((postsaberPct - presaberPct) / presaberPct) * 100) : null;
  return { diferencia, variacion };
}
