import Link from "next/link";
import { ClipboardList, Layers, Plus, Sparkles, TrendingUp, Users2 } from "lucide-react";
import { requireSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { listarEncuestas, type AlcanceEncuestas } from "@/lib/encuestas/consultas";
import { TarjetaEncuesta } from "@/components/encuestas/tarjeta-encuesta";
import { FiltrosEncuestasBarra } from "@/components/encuestas/filtros-encuestas";
import { EmptyState } from "@/components/brand/empty-state";
import { cn } from "@/lib/utils";
import type { SurveyStatus, SurveyAudience } from "@prisma/client";

/**
 * ESPACIO DE TRABAJO DE ENCUESTAS.
 *
 * Lo ven los tres roles, con alcances distintos y a propósito:
 *
 *  - Administrador: todas las encuestas de la plataforma.
 *  - Tutor: las que él emite y las de las jornadas de sus áreas.
 *  - Estudiante: únicamente aquellas que respondió, con su propio resultado.
 *    Nunca ve la encuesta de otra persona ni resultados agregados.
 */
export default async function EncuestasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string; audiencia?: string; vista?: string }>;
}) {
  const { q, estado, audiencia, vista } = await searchParams;
  const sesion = await requireSession("/encuestas");
  const rol = sesion.user.role;
  const esGestor = rol === "ADMIN" || rol === "TUTOR";

  const alcance: AlcanceEncuestas =
    rol === "ADMIN"
      ? { tipo: "todas" }
      : rol === "TUTOR"
        ? {
            tipo: "emitidas",
            userId: sesion.user.id,
            areaIds: (
              await prisma.trainingArea.findMany({ where: { tutorId: sesion.user.id }, select: { id: true } })
            ).map((a) => a.id),
          }
        : { tipo: "respondidas", userId: sesion.user.id };

  const verPlantillas = esGestor && vista === "plantillas";
  const encuestas = await listarEncuestas(
    {
      buscar: q,
      estado: estado as SurveyStatus | undefined,
      audiencia: audiencia as SurveyAudience | undefined,
      plantillas: verPlantillas,
    },
    alcance
  );

  // KPIs de la cabecera. Se calculan sobre lo que esta persona puede ver, no
  // sobre toda la plataforma: a un tutor no le sirve el total institucional.
  const publicadas = encuestas.filter((e) => e.status === "PUBLISHED").length;
  const respuestas = encuestas.reduce((s, e) => s + e.completadas, 0);
  const iniciadas = encuestas.reduce((s, e) => s + e.respuestas, 0);
  const finalizacion = iniciadas > 0 ? Math.round((respuestas / iniciadas) * 100) : null;

  const kpis = esGestor
    ? [
        { etiqueta: verPlantillas ? "Plantillas" : "Encuestas", valor: String(encuestas.length), Icono: Layers, destacar: false },
        { etiqueta: "Publicadas", valor: String(publicadas), Icono: Sparkles, destacar: publicadas > 0 },
        { etiqueta: "Respuestas", valor: String(respuestas), Icono: Users2, destacar: false },
        {
          etiqueta: "Finalización",
          valor: finalizacion !== null ? `${finalizacion}%` : "—",
          Icono: TrendingUp,
          destacar: false,
        },
      ]
    : [
        { etiqueta: "Encuestas respondidas", valor: String(encuestas.length), Icono: ClipboardList, destacar: false },
      ];

  return (
    <main className="canvas-vivo min-h-screen">
      <div className="mx-auto w-full max-w-[1480px] px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
              <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
              Módulo de encuestas
            </p>
            <h1 className="mt-2 font-display text-[clamp(1.9rem,4vw,2.4rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
              {esGestor ? (
                <>
                  Encuestas{" "}
                  <span className="bg-gradient-to-r from-primary to-success bg-clip-text text-transparent">
                    institucionales
                  </span>
                </>
              ) : (
                <>
                  Mis{" "}
                  <span className="bg-gradient-to-r from-primary to-success bg-clip-text text-transparent">
                    respuestas
                  </span>
                </>
              )}
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
              {esGestor
                ? "Construye encuestas por bloques, publícalas con un enlace estable y consulta los resultados en un solo lugar."
                : "Aquí queda constancia de las encuestas que has respondido, con el resultado de cada una."}
            </p>
          </div>

          {esGestor && (
            <Link
              href="/encuestas/nueva"
              className="inline-flex w-fit shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-success px-5 py-3 text-[14px] font-bold text-white shadow-lg shadow-primary/25 transition-transform hover:translate-y-[-1px]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Nueva encuesta
            </Link>
          )}
        </header>

        {/* Banda de indicadores en vidrio */}
        <section
          aria-label="Resumen de encuestas"
          className={cn("mt-7 grid gap-4", esGestor ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:max-w-xs")}
        >
          {kpis.map((k) => (
            <div key={k.etiqueta} className={cn("surface-vivo", k.destacar && "glow-exito")}>
              <div className="flex h-full flex-col justify-between gap-3 p-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                  <k.Icono className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-[1.75rem] font-extrabold leading-none tracking-tight tabular-nums text-foreground">
                    {k.valor}
                  </p>
                  <p className="mt-1.5 text-[12px] leading-tight text-muted-foreground">{k.etiqueta}</p>
                </div>
              </div>
            </div>
          ))}
        </section>

        {esGestor && (
          <div className="mt-7 flex items-center gap-1 border-b border-border/60">
            {[
              { valor: "mis", etiqueta: "Encuestas" },
              { valor: "plantillas", etiqueta: "Plantillas" },
            ].map((t) => {
              const activo = (vista ?? "mis") === t.valor;
              return (
                <Link
                  key={t.valor}
                  href={t.valor === "mis" ? "/encuestas" : "/encuestas?vista=plantillas"}
                  className={cn(
                    "-mb-px border-b-2 px-4 py-2.5 text-[13px] font-semibold transition-colors",
                    activo
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t.etiqueta}
                </Link>
              );
            })}
          </div>
        )}

        {esGestor && <FiltrosEncuestasBarra />}

        <section className="mt-6">
          {encuestas.length === 0 ? (
            <div className="surface-lumen">
              <EmptyState
                icon={ClipboardList}
                title={
                  esGestor
                    ? verPlantillas
                      ? "Sin plantillas todavía"
                      : "Sin encuestas todavía"
                    : "Aún no has respondido ninguna encuesta"
                }
                description={
                  esGestor
                    ? "Crea la primera y publícala con su enlace y su código QR."
                    : "Cuando respondas una, aparecerá aquí con tu resultado."
                }
                className="py-16"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {encuestas.map((e) => (
                <TarjetaEncuesta key={e.id} encuesta={e} puedeGestionar={esGestor} baseUrl="/encuestas" />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
