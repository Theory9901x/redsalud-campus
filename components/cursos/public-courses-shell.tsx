import { SiteHeader } from "@/components/public/site-header";
import { cn } from "@/lib/utils";

/**
 * Envoltorio de "sitio público" (header flotante + fondo con profundidad),
 * usado por el catálogo cuando no hay sesión de dashboard que preservar, y
 * siempre por el detalle de un curso: esa vista no tiene sentido metida en
 * el sidebar del dashboard (compite por ancho con el contenido del curso),
 * así que solo lleva este header de navegación arriba, para cualquier rol.
 */
export function PublicCoursesShell({
  children,
  maxWidth = "max-w-5xl",
}: {
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="page-canvas relative min-h-screen">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 0%, color-mix(in oklch, var(--primary) 18%, transparent), transparent 55%), radial-gradient(circle at 85% 10%, color-mix(in oklch, var(--success) 14%, transparent), transparent 45%)",
        }}
      />
      <div className="relative pb-20 pt-6">
        <SiteHeader />
        <main className={cn("mx-auto mt-8 w-full px-4", maxWidth)}>{children}</main>
      </div>
    </div>
  );
}
