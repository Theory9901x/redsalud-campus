/**
 * Encabezado de página del admin: título + descripción encerrados en una
 * caja con acento de marca (misma superficie que paneles/tablas), en vez de
 * un <h1> suelto flotando sobre el fondo. La barra de la izquierda y la malla
 * de la derecha vienen de .encabezado-tech (globals.css).
 */
export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="surface-panel surface-accent-top encabezado-tech flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
      <div className="flex min-w-0 items-stretch gap-3.5">
        <span className="encabezado-barra shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
