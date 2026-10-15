/**
 * Las fichas verticales que vivían aquí se reemplazaron por el submódulo de
 * indicadores (components/indicadores/**): tablero de vidrio en
 * /indicadores y una ficha por indicador en /indicadores/[codigo] con
 * Seguimiento · Ficha técnica · Análisis · Mediciones · Planes de mejora.
 *
 * Se conserva el nombre exportado por compatibilidad con cualquier import
 * antiguo; apunta al tablero nuevo.
 */
export { TableroIndicadores as PanelIndicadores } from "@/components/indicadores/tablero-indicadores";
