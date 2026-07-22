/**
 * Constantes de paginación compartidas por el Server Component que consulta y
 * el control cliente que navega.
 *
 * Viven aquí y no en table-pagination.tsx porque ese módulo lleva "use client":
 * al importarlo desde un Server Component, sus exportaciones que no son
 * componentes no cruzan como valores reales (PAGE_SIZES llegaba como una
 * referencia sin .includes).
 */
export const PAGE_SIZES = [20, 50, 100, 500, 1000] as const;
export const DEFAULT_PAGE_SIZE = 20;

export type PageSize = (typeof PAGE_SIZES)[number];

/** Normaliza el tamaño de página que llega por searchParams. */
export function parsePageSize(raw: string | undefined): number {
  const n = Number(raw);
  return (PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
}
