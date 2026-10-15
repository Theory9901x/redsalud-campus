import type { Role } from "@prisma/client";

/**
 * SEGUIMIENTO (Control Interno) ve exactamente lo mismo que un administrador
 * -todo el panel, métricas, informes y exportaciones- pero no puede escribir
 * nada: el proxy rechaza cualquier petición que no sea de lectura (todas las
 * acciones de servidor son POST), así que aunque un botón quedara a la vista,
 * no modifica nada. Aquí solo se decide qué se puede VER.
 */
export function veComoAdmin(role: Role | null | undefined): boolean {
  return role === "ADMIN" || role === "SEGUIMIENTO";
}

export function esSoloLectura(role: Role | null | undefined): boolean {
  return role === "SEGUIMIENTO";
}
