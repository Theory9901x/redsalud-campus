import type { FaseSesion } from "@prisma/client";

/**
 * Fases de la sesión presencial, SIN nada de base de datos: el panel en
 * vivo es un componente de cliente y arrastrar el módulo de consultas
 * metería el driver de Postgres al paquete del navegador (mismo caso que
 * semaforo-indicadores).
 */
export const ORDEN_FASES: FaseSesion[] = ["REGISTRO", "PRESABER", "CAPACITACION", "POSTSABER", "CERRADA"];

export const ETIQUETA_FASE: Record<FaseSesion, string> = {
  REGISTRO: "Registro de asistencia",
  PRESABER: "Presaber abierto",
  CAPACITACION: "Capacitación en curso",
  POSTSABER: "Postsaber abierto",
  CERRADA: "Sesión cerrada",
};

export function faseSiguiente(actual: FaseSesion): FaseSesion | null {
  const i = ORDEN_FASES.indexOf(actual);
  return i >= 0 && i < ORDEN_FASES.length - 1 ? ORDEN_FASES[i + 1] : null;
}

export function faseAnterior(actual: FaseSesion): FaseSesion | null {
  const i = ORDEN_FASES.indexOf(actual);
  // De CERRADA no se vuelve por aquí: reabrir un acta es decisión aparte.
  return i > 0 && actual !== "CERRADA" ? ORDEN_FASES[i - 1] : null;
}
