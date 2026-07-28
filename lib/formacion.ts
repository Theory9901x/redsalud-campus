/**
 * Vocabulario del estado de formación, SIN dependencias de servidor.
 *
 * Vive aparte de lib/admin-dashboard.ts a propósito: ese módulo importa
 * Prisma, y un componente de cliente que importara de allí solo para leer una
 * etiqueta arrastraría el driver de Postgres entero al bundle del navegador
 * (y fallaría al compilar). Aquí solo hay un tipo y un diccionario, así que
 * lo pueden importar los dos lados.
 */

/** Estados de formación de una persona. Excluyentes y en orden de avance. */
export type EstadoFormacion =
  | "SIN_ASIGNAR"
  | "SIN_INGRESAR"
  | "SIN_AVANCE"
  | "EN_CURSO"
  | "COMPLETADO";

export const ESTADO_FORMACION_LABEL: Record<EstadoFormacion, string> = {
  SIN_ASIGNAR: "Sin formación asignada",
  SIN_INGRESAR: "Nunca ha ingresado",
  SIN_AVANCE: "Ingresó, sin avance",
  EN_CURSO: "En curso",
  COMPLETADO: "Completó",
};

/**
 * Orden canónico del embudo, del bloqueo más temprano al final.
 *
 * SIN_ASIGNAR va primero y gana sobre SIN_INGRESAR a propósito: si a alguien
 * nadie le asignó un curso, da igual que haya entrado o no -no había nada que
 * hacer-. Meterlo en "ingresó, sin avance" le echaba la culpa a la persona de
 * algo que es tarea de Talento Humano, y son dos acciones distintas:
 * asignarle formación, o recordarle que entre.
 */
export const ORDEN_EMBUDO: EstadoFormacion[] = [
  "SIN_ASIGNAR",
  "SIN_INGRESAR",
  "SIN_AVANCE",
  "EN_CURSO",
  "COMPLETADO",
];

export function esEstadoFormacion(v: unknown): v is EstadoFormacion {
  return typeof v === "string" && (ORDEN_EMBUDO as string[]).includes(v);
}
