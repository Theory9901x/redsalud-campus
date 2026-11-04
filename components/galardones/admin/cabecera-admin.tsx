import Link from "next/link";
import { Download, ExternalLink, Trophy, Users2, Vote, Building2, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { NOMBRE_EVENTO, NOMBRE_RECONOCIMIENTO } from "@/lib/galardones/valores";
import type { ResultadosGalardones } from "@/lib/galardones/consultas";

const FECHA = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "America/Bogota" });

/**
 * Cabecera de la gestión de Galardones en el panel admin: vidrio claro con
 * una aurora dorada discreta (es un reconocimiento, no una pantalla de
 * tablas más), estado de la convocatoria y los cuatro números que importan.
 */
export function CabeceraGalardonesAdmin({
  convocatoria,
  resultados,
}: {
  convocatoria: { abierta: boolean; cierraEl: Date | null; anio: number };
  resultados: ResultadosGalardones;
}) {
  const kpis = [
    { Icono: Vote, etiqueta: "Postulaciones", valor: resultados.totalPostulaciones, nota: "una por valor y persona" },
    { Icono: Users2, etiqueta: "Colaboradores", valor: resultados.totalVotantes, nota: "ya postularon" },
    { Icono: UserRound, etiqueta: "Personas postuladas", valor: resultados.totalCandidatos, nota: "agrupadas por nombre" },
    { Icono: Building2, etiqueta: "Centros con participación", valor: resultados.ipsConParticipacion, nota: `de ${resultados.porIps.length} IPS` },
  ];

  return (
    <header className="relative overflow-hidden rounded-[22px] border border-border/70 bg-card/85 p-6 shadow-[var(--shadow-1)] backdrop-blur sm:p-7">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full opacity-70 blur-3xl"
        style={{ background: "radial-gradient(closest-side, oklch(0.86 0.12 85 / 0.55), transparent 70%)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(closest-side, color-mix(in oklch, var(--primary) 35%, transparent), transparent 70%)" }}
      />

      <div className="relative flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-mono text-[10.5px] font-bold uppercase tracking-[0.2em] text-primary">
            <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
            {NOMBRE_EVENTO} {convocatoria.anio} · Reconocimiento al mérito
          </p>
          <h1 className="mt-2 font-display text-[1.9rem] font-extrabold leading-tight tracking-tight text-foreground">{NOMBRE_RECONOCIMIENTO}</h1>
          <p className="mt-1.5 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">
            Postulaciones por centro IPS y por valor del Código de Integridad. Aquí se consultan los resultados, se corrige la agrupación de
            nombres y se administra la base de datos de la convocatoria.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider",
                convocatoria.abierta ? "border-success/30 bg-success/10 text-success" : "border-border bg-muted text-muted-foreground",
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", convocatoria.abierta ? "bg-success" : "bg-muted-foreground/60")} aria-hidden="true" />
              Convocatoria {convocatoria.abierta ? "abierta" : "cerrada"}
            </span>
            {convocatoria.cierraEl && (
              <span className="text-[12px] text-muted-foreground">
                {convocatoria.abierta ? "Cierra el" : "Cerró el"} {FECHA.format(convocatoria.cierraEl)}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link href="/galardones" target="_blank" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            Ver formulario de postulación
          </Link>
          <a href="/api/galardones/excel" download className={cn(buttonVariants({ size: "sm" }), "gap-1.5")}>
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Exportar a Excel
          </a>
        </div>
      </div>

      <dl className="relative mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.etiqueta} className="rounded-2xl border border-border/60 bg-background/70 p-4">
            <dt className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <k.Icono className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              {k.etiqueta}
            </dt>
            <dd className="mt-1.5 font-display text-[1.75rem] font-extrabold leading-none tabular-nums text-foreground">{k.valor}</dd>
            <dd className="mt-1 text-[11.5px] text-muted-foreground">{k.nota}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}

/** Pestañas de la gestión: resultados, postulaciones (fila a fila), candidatos y convocatoria. */
export function PestanasGalardones({ activa }: { activa: "resultados" | "postulaciones" | "candidatos" | "convocatoria" }) {
  const pestanas = [
    { clave: "resultados", etiqueta: "Resultados" },
    { clave: "postulaciones", etiqueta: "Postulaciones" },
    { clave: "candidatos", etiqueta: "Personas postuladas" },
    { clave: "convocatoria", etiqueta: "Convocatoria" },
  ] as const;
  return (
    <nav aria-label="Secciones de Galardones" className="inline-flex max-w-full flex-wrap rounded-[14px] border border-border/70 bg-card/80 p-1 shadow-[var(--shadow-1)]">
      {pestanas.map((p) => {
        const activo = p.clave === activa;
        return (
          <Link
            key={p.clave}
            href={p.clave === "resultados" ? "/admin/galardones" : `/admin/galardones?vista=${p.clave}`}
            aria-current={activo ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-[10px] px-4 py-2 text-[13px] font-semibold transition-all duration-200",
              activo
                ? "bg-[color-mix(in_oklch,var(--navy)_88%,var(--primary))] text-white shadow-[inset_0_-2px_0_var(--primary)]"
                : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground",
            )}
          >
            {p.etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}
