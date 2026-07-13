/**
 * Encabezado de página del admin: título + descripción encerrados en una
 * caja con acento de marca (misma superficie que paneles/tablas), en vez de
 * un <h1> suelto flotando sobre el fondo.
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
    <div className="surface-panel surface-accent-top flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
