/**
 * Sin chrome propio: el catálogo (/cursos) y el detalle de curso (/cursos/[slug])
 * necesitan tratamientos distintos (el catálogo preserva el dashboard del
 * usuario logueado; el detalle siempre es una vista "pública" de ancho
 * completo con solo el header de navegación arriba), y un layout ancestro no
 * puede excluirse selectivamente para una sola subruta. Por eso cada page.tsx
 * arma su propio shell completo.
 */
export default function CursosLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
