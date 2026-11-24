import Link from "next/link";
import { ArrowRight, CircleCheck } from "lucide-react";
import { requireSession } from "@/lib/auth-helpers";
import { getAgendaEstudiante } from "@/lib/agenda-estudiante";
import { getHistorialEvaluaciones } from "@/lib/training-plans";
import { etiquetaFecha } from "@/components/training-plans/labels";
import { FilaDeAgenda, SeccionAgenda } from "@/components/agenda/fila-agenda";

export const dynamic = "force-dynamic";

const TIPO_LABEL = { PRESABER: "Presaber", POSTSABER: "Postsaber", ENCUESTA: "Encuesta" } as const;

/**
 * «Evaluaciones»: dos preguntas y nada más. ¿Qué tengo que presentar AHORA?
 * y ¿cómo me fue en lo que ya presenté?
 *
 * Antes era un tablero con cinco formas de agrupar, cuatro filtros y una
 * tarjeta por cada línea del plan -55 tarjetas, casi todas con un «Presentar
 * presaber» de una capacitación que ni siquiera tenía fecha-. Ahora solo
 * aparece lo que de verdad se puede presentar: evaluaciones de jornadas en
 * curso, próximas o de las últimas 24 horas (misma agenda que «Mis
 * capacitaciones», lib/agenda-estudiante.ts).
 */
export default async function EvaluacionesPage() {
  const session = await requireSession("/evaluaciones");
  const primerNombre = session.user.name?.split(" ")[0];

  const [agenda, historial] = await Promise.all([
    getAgendaEstudiante(session.user.id),
    getHistorialEvaluaciones(session.user.id, 30),
  ]);

  const porPresentar = agenda.filter((f) => f.pendientes > 0);
  const total = porPresentar.reduce((s, f) => s + f.pendientes, 0);

  return (
    <main className="canvas-formacion min-h-full flex-1">
      <div className="mx-auto w-full max-w-[1280px] space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="max-w-2xl">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">Evaluaciones</h1>
          <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
            {primerNombre ? `${primerNombre}, aquí` : "Aquí"} está lo que puedes presentar ahora —presaber, postsaber y
            encuestas de tus capacitaciones— y los resultados de lo que ya presentaste.
          </p>
        </header>

        <SeccionAgenda
          titulo="Por presentar"
          conteo={total}
          tono={total > 0 ? "accion" : undefined}
          ayuda="Cada evaluación se presenta alrededor de su jornada y deja de aparecer 24 horas después."
        >
          {porPresentar.length === 0 ? (
            <div className="agenda-vacio">
              <CircleCheck className="mx-auto mb-2 h-7 w-7 text-success" aria-hidden="true" />
              <b>No tienes nada pendiente por presentar</b>
              Las evaluaciones aparecen aquí cuando tu capacitación tiene fecha.
              <Link
                href="/mis-capacitaciones"
                className="mt-3 inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
              >
                Ver mi agenda de capacitaciones
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          ) : (
            <ul>
              {porPresentar.map((f) => (
                <FilaDeAgenda key={f.id} fila={f} foco="evaluar" />
              ))}
            </ul>
          )}
        </SeccionAgenda>

        <SeccionAgenda titulo="Mis resultados" ayuda="Lo que ya presentaste o respondiste, de lo más reciente a lo más antiguo.">
          {historial.length === 0 ? (
            <p className="agenda-vacio">
              <b>Aún no tienes resultados</b>
              Lo que presentes quedará aquí con su fecha y su nota.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-[13px] text-muted-foreground">
                    <th scope="col" className="px-5 py-3 font-semibold">Capacitación</th>
                    <th scope="col" className="px-3 py-3 font-semibold">Evaluación</th>
                    <th scope="col" className="px-3 py-3 font-semibold">Fecha</th>
                    <th scope="col" className="px-5 py-3 text-right font-semibold">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map((h, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="max-w-[420px] truncate px-5 py-3.5 font-medium text-foreground">{h.titulo}</td>
                      <td className="px-3 py-3.5 text-muted-foreground">{TIPO_LABEL[h.tipo]}</td>
                      <td className="whitespace-nowrap px-3 py-3.5 text-muted-foreground">{etiquetaFecha(h.fecha)}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right">
                        {h.tipo === "ENCUESTA" ? (
                          <span className="font-semibold text-success">Respondida</span>
                        ) : (
                          <>
                            <b className="text-base tabular-nums text-foreground">{h.resultado}%</b>
                            <span className={`ml-2 text-[13px] font-semibold ${h.aprobado ? "text-success" : "text-destructive"}`}>
                              {h.aprobado ? "Aprobado" : "No aprobado"}
                            </span>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SeccionAgenda>
      </div>
    </main>
  );
}
