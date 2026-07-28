/**
 * Catálogo de reportes imprimibles, SIN dependencias de servidor.
 *
 * Igual que lib/formacion.ts: lib/reportes-imprimibles.ts importa Prisma, así
 * que el botón de exportar -que es de cliente- no puede leer de allí sin
 * arrastrar el driver de Postgres al bundle del navegador.
 */

export const TIPOS_REPORTE = ["panel", "personal", "cobertura"] as const;
export type TipoReporte = (typeof TIPOS_REPORTE)[number];

export const REPORTE_META: Record<TipoReporte, { titulo: string; descripcion: string }> = {
  panel: {
    titulo: "Informe general de formación",
    descripcion: "Indicadores, participación, cobertura territorial y avance por curso.",
  },
  personal: {
    titulo: "Estado de formación por persona",
    descripcion: "Listado nominal del personal con su estado y porcentaje de avance.",
  },
  cobertura: {
    titulo: "Cobertura territorial",
    descripcion: "Cumplimiento de la formación por municipio, de menor a mayor.",
  },
};

export function esTipoReporte(v: unknown): v is TipoReporte {
  return typeof v === "string" && (TIPOS_REPORTE as readonly string[]).includes(v);
}
