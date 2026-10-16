import type { NivelSemaforo } from "@/components/training-plans/labels";

/*
 * Semaforización institucional del centro de datos SIAU: los mismos colores
 * plenos del módulo de indicadores (sin pastel). Verde ≥ 85 · Amarillo
 * 70–84,9 · Rojo < 70. En pantalla se pinta con [data-siau-sem] (globals.css,
 * sección .siau-); aquí quedan los valores para las gráficas (SVG).
 */

export type SemSiau = "verde" | "amarillo" | "rojo" | "sin-datos";

export const SEM_DE_NIVEL: Record<NivelSemaforo, SemSiau> = {
  success: "verde",
  warning: "amarillo",
  destructive: "rojo",
  muted: "sin-datos",
};

export function semDe(v: number | null | undefined): SemSiau {
  if (v === null || v === undefined) return "sin-datos";
  return v >= 85 ? "verde" : v >= 70 ? "amarillo" : "rojo";
}

export const COLOR_SEM: Record<SemSiau, string> = {
  verde: "#12A537",
  amarillo: "#F5B800",
  rojo: "#E3141B",
  "sin-datos": "var(--muted-foreground)",
};

export const TEXTO_SEM: Record<SemSiau, string> = {
  verde: "Cumple",
  amarillo: "Aceptable",
  rojo: "Crítico",
  "sin-datos": "Sin datos",
};

export function pct(v: number | null | undefined) {
  return v === null || v === undefined ? "—" : `${v}%`;
}

export function pp(v: number | null | undefined) {
  return v === null || v === undefined ? "—" : `${v > 0 ? "+" : ""}${v} pp`;
}

/**
 * Escala de caritas: divergente y anclada en el semáforo institucional.
 * Vive aquí (módulo sin "use client") para que los componentes de servidor
 * reciban el objeto real y no una referencia de cliente.
 */
export const COLOR_TONO: Record<"exc" | "bue" | "reg" | "mal" | "muymal" | "na", string> = {
  exc: "#12A537",
  bue: "#7CC242",
  reg: "#F5B800",
  mal: "#EF7A1A",
  muymal: "#E3141B",
  na: "#A3AEBF",
};
