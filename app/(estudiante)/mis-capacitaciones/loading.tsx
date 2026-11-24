/** Esqueleto de la agenda: encabezado y dos paneles de filas, sin cifras inventadas. */
export default function CargandoAgenda() {
  return (
    <main className="canvas-formacion min-h-full flex-1" aria-busy="true" aria-label="Cargando">
      <div className="mx-auto w-full max-w-[1280px] space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-3">
          <div className="h-9 w-72 animate-pulse rounded-xl bg-foreground/10" />
          <div className="h-4 w-full max-w-lg animate-pulse rounded-full bg-foreground/[0.07]" />
        </div>
        {[3, 2].map((filas, i) => (
          <div key={i} className="agenda-panel">
            <div className="agenda-cabecera">
              <div className="h-5 w-40 animate-pulse rounded-lg bg-foreground/10" />
            </div>
            {Array.from({ length: filas }, (_, j) => (
              <div key={j} className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-b-0">
                <div className="h-14 w-14 shrink-0 animate-pulse rounded-xl bg-foreground/[0.07]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 animate-pulse rounded-full bg-foreground/10" />
                  <div className="h-3 w-1/3 animate-pulse rounded-full bg-foreground/[0.07]" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}
