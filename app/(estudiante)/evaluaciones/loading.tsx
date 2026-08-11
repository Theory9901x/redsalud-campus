/**
 * Esqueleto de "Evaluaciones de capacitación": misma maqueta que llega
 * después -encabezado, cuatro indicadores, tarjetas disponibles e
 * historial-, para que la pantalla no salte al cargar.
 */
export default function CargandoEvaluaciones() {
  return (
    <main
      className="canvas-formacion min-h-full flex-1"
      aria-busy="true"
      aria-label="Cargando tus evaluaciones"
    >
      <div className="mx-auto w-full max-w-[1480px] space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="w-full max-w-2xl space-y-3">
            <div className="h-3 w-40 animate-pulse rounded-full bg-foreground/10" />
            <div className="h-9 w-96 max-w-full animate-pulse rounded-xl bg-foreground/10" />
            <div className="h-4 w-full max-w-lg animate-pulse rounded-full bg-foreground/[0.07]" />
          </div>
          <div className="h-10 w-52 animate-pulse rounded-full bg-foreground/[0.07]" />
        </header>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="surface-lumen flex items-center gap-4 p-5">
              <div className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-foreground/10" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-6 w-12 animate-pulse rounded-lg bg-foreground/10" />
                <div className="h-3 w-28 animate-pulse rounded-full bg-foreground/[0.07]" />
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-5">
          <div className="h-6 w-56 animate-pulse rounded-lg bg-foreground/10" />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="surface-lumen lumen-edge space-y-4 p-6">
                <div className="flex items-start justify-between">
                  <div className="h-12 w-12 animate-pulse rounded-2xl bg-foreground/10" />
                  <div className="h-5 w-20 animate-pulse rounded-full bg-foreground/[0.07]" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-32 animate-pulse rounded-full bg-foreground/[0.07]" />
                  <div className="h-5 w-3/4 animate-pulse rounded-lg bg-foreground/10" />
                  <div className="h-3 w-full animate-pulse rounded-full bg-foreground/[0.07]" />
                </div>
                <div className="h-10 w-full animate-pulse rounded-xl bg-foreground/[0.07]" />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="h-6 w-40 animate-pulse rounded-lg bg-foreground/10" />
          <div className="surface-lumen space-y-4 p-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-4 flex-1 animate-pulse rounded-full bg-foreground/[0.07]" />
                <div className="h-5 w-20 animate-pulse rounded-full bg-foreground/10" />
                <div className="h-4 w-24 animate-pulse rounded-full bg-foreground/[0.07]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
