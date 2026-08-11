/**
 * Esqueleto de "Mis capacitaciones": la misma maqueta que llega después
 * -encabezado, cuatro indicadores y las tarjetas de plan-, para que la
 * pantalla no salte al cargar. Solo formas, sin cifras inventadas.
 */
export default function CargandoMisCapacitaciones() {
  return (
    <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 py-8 sm:px-6 lg:px-8" aria-busy="true" aria-label="Cargando tus capacitaciones">
      <div className="space-y-8">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="w-full max-w-2xl space-y-3">
            <div className="h-3 w-40 animate-pulse rounded-full bg-foreground/10" />
            <div className="h-9 w-72 animate-pulse rounded-xl bg-foreground/10" />
            <div className="h-4 w-full max-w-lg animate-pulse rounded-full bg-foreground/[0.07]" />
          </div>
          <div className="h-10 w-44 animate-pulse rounded-full bg-foreground/[0.07]" />
        </header>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="surface-lumen flex items-center gap-4 p-5">
              <div className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-foreground/10" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-6 w-14 animate-pulse rounded-lg bg-foreground/10" />
                <div className="h-3 w-24 animate-pulse rounded-full bg-foreground/[0.07]" />
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-5">
          <div className="h-6 w-48 animate-pulse rounded-lg bg-foreground/10" />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {[0, 1].map((i) => (
              <div key={i} className="surface-lumen lumen-edge space-y-5 p-6 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div className="h-14 w-14 animate-pulse rounded-2xl bg-foreground/10" />
                  <div className="h-6 w-20 animate-pulse rounded-full bg-foreground/[0.07]" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-28 animate-pulse rounded-full bg-foreground/[0.07]" />
                  <div className="h-6 w-3/4 animate-pulse rounded-lg bg-foreground/10" />
                  <div className="h-3 w-1/2 animate-pulse rounded-full bg-foreground/[0.07]" />
                </div>
                <div className="flex gap-6">
                  {[0, 1, 2].map((j) => (
                    <div key={j} className="h-3 w-24 animate-pulse rounded-full bg-foreground/[0.07]" />
                  ))}
                </div>
                <div className="space-y-2 border-t border-border/60 pt-5">
                  <div className="h-3 w-32 animate-pulse rounded-full bg-foreground/[0.07]" />
                  <div className="h-2 w-full animate-pulse rounded-full bg-foreground/10" />
                </div>
                <div className="flex items-end justify-between gap-4 border-t border-border/60 pt-5">
                  <div className="space-y-2">
                    <div className="h-3 w-28 animate-pulse rounded-full bg-foreground/[0.07]" />
                    <div className="h-4 w-40 animate-pulse rounded-full bg-foreground/10" />
                  </div>
                  <div className="h-10 w-40 animate-pulse rounded-xl bg-foreground/10" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
