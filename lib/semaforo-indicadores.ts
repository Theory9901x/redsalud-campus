/**
 * Umbrales y semáforo de los indicadores, sin nada de base de datos.
 *
 * Vive aparte de `plan-indicadores.ts` a propósito: allí se consulta Prisma,
 * y el panel es un componente de cliente. Importar el módulo de cálculo desde
 * el navegador arrastraría el driver de Postgres al paquete del cliente y el
 * build falla al no poder resolver los módulos de Node ('dns', 'net'…).
 */
export const UMBRAL_VERDE = 85;
export const UMBRAL_AMARILLO = 70;

export type Semaforo = "verde" | "amarillo" | "rojo" | "sin-datos";

export function semaforo(valor: number | null): Semaforo {
  if (valor === null) return "sin-datos";
  if (valor >= UMBRAL_VERDE) return "verde";
  if (valor >= UMBRAL_AMARILLO) return "amarillo";
  return "rojo";
}
