import Link from "next/link";
import { ArrowRight, ChevronDown, FolderOpen } from "lucide-react";
import { requireSession } from "@/lib/auth-helpers";
import { getAgendaEstudiante, type FilaAgenda } from "@/lib/agenda-estudiante";
import { getTrainingPlansForStudent } from "@/lib/training-plans";
import { getCapacitacionesEnVivo } from "@/lib/en-vivo";
import { veePruebas } from "@/lib/pruebas";
import { PestanasCapacitaciones } from "@/components/en-vivo/pestanas-capacitaciones";
import { FilaDeAgenda, SeccionAgenda } from "@/components/agenda/fila-agenda";

export const dynamic = "force-dynamic";

/**
 * «Mis capacitaciones»: la AGENDA de la persona. Responde una sola pregunta
 * -¿a qué tengo que asistir?- en orden de tiempo: lo que está pasando ahora,
 * lo que viene con fecha, y lo que el área aún no agenda.
 *
 * Antes era una rejilla de tarjetas de plan con cuatro indicadores y tres
 * pestañas; la persona tenía que entrar al plan y buscar entre 55 líneas para
 * saber qué le tocaba. Lo ya pasado no se muestra (regla de las 24 horas, ver
 * lib/agenda-estudiante.ts).
 */
export default async function MisCapacitacionesPage() {
  const session = await requireSession("/mis-capacitaciones");
  const primerNombre = session.user.name?.split(" ")[0];

  const [agenda, planes, salasEnVivo] = await Promise.all([
    getAgendaEstudiante(session.user.id),
    getTrainingPlansForStudent(session.user.id),
    getCapacitacionesEnVivo({ viewer: session.user, verPruebas: veePruebas(session.user.role) }).then(
      (f) => f.filter((x) => x.estado === "EN_VIVO").length,
    ),
  ]);

  const ahora = agenda.filter((f) => f.momento === "EN_VIVO" || f.momento === "FINALIZADA");
  const proximas = agenda.filter((f) => f.momento === "PROXIMA");
  const sinFecha = agenda.filter((f) => f.momento === "SIN_FECHA");
  const pendientes = agenda.reduce((s, f) => s + f.pendientes, 0);
  const enVivo = agenda.filter((f) => f.momento === "EN_VIVO").length;

  // «Próximas» agrupadas por día, en el orden en que ya vienen (por fecha).
  const grupos: { titulo: string; filas: FilaAgenda[] }[] = [];
  for (const f of proximas) {
    const titulo = f.grupo ?? "Más adelante";
    const ultimo = grupos.at(-1);
    if (ultimo?.titulo === titulo) ultimo.filas.push(f);
    else grupos.push({ titulo, filas: [f] });
  }

  const planesActivos = planes.filter((p) => p.status === "ACTIVE");

  return (
    <main className="canvas-formacion min-h-full flex-1">
      <div className="mx-auto w-full max-w-[1280px] space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">Mis capacitaciones</h1>
            <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">
              {primerNombre ? `${primerNombre}, esta` : "Esta"} es tu agenda: lo que está pasando ahora y lo que viene. Lo
              que ya pasó deja de aparecer 24 horas después.
            </p>
          </div>
          <PestanasCapacitaciones activa="planes" enVivo={salasEnVivo} />
        </header>

        <div className="agenda-resumen">
          <div>
            <b>{enVivo}</b>
            <span>En vivo ahora</span>
          </div>
          <div>
            <b>{proximas.length}</b>
            <span>Próximas con fecha</span>
          </div>
          <Link href="/evaluaciones" data-alerta={pendientes > 0} className="transition-colors hover:bg-muted">
            <b>{pendientes}</b>
            <span>{pendientes === 1 ? "Evaluación por presentar" : "Evaluaciones por presentar"} →</span>
          </Link>
        </div>

        {agenda.length === 0 && (
          <div className="agenda-panel">
            <p className="agenda-vacio">
              <b>No tienes capacitaciones en agenda</b>
              Cuando un área programe una capacitación para tu grupo de personal, aparecerá aquí con su fecha.
            </p>
          </div>
        )}

        {ahora.length > 0 && (
          <SeccionAgenda
            titulo="Ahora"
            conteo={ahora.length}
            tono={enVivo > 0 ? "vivo" : undefined}
            ayuda="En vivo y lo de las últimas 24 horas: aún puedes presentar lo pendiente."
          >
            <ul>
              {ahora.map((f) => (
                <FilaDeAgenda key={f.id} fila={f} />
              ))}
            </ul>
          </SeccionAgenda>
        )}

        {proximas.length > 0 && (
          <SeccionAgenda titulo="Próximas" conteo={proximas.length} ayuda="Con fecha y hora confirmadas, de la más cercana a la más lejana.">
            {grupos.map((g) => (
              <div key={g.titulo}>
                <p className="agenda-grupo">{g.titulo}</p>
                <ul>
                  {g.filas.map((f) => (
                    <FilaDeAgenda key={f.id} fila={f} />
                  ))}
                </ul>
              </div>
            ))}
          </SeccionAgenda>
        )}

        {sinFecha.length > 0 && (
          // Plegada cuando es larga: son las líneas del plan que aún no tienen
          // día; informan, pero no hay nada que hacer con ellas hoy.
          <details className="agenda-panel group" open={sinFecha.length <= 6 && ahora.length + proximas.length === 0}>
            <summary className="agenda-cabecera">
              <h2>
                Programadas, aún sin fecha
                <span className="agenda-conteo">{sinFecha.length}</span>
              </h2>
              <p className="inline-flex items-center gap-1.5">
                Previstas para este trimestre o los siguientes
                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
              </p>
            </summary>
            <ul>
              {sinFecha.map((f) => (
                <FilaDeAgenda key={f.id} fila={f} />
              ))}
            </ul>
          </details>
        )}

        {planesActivos.length > 0 && (
          <SeccionAgenda titulo="Planes y documentos" ayuda="El cronograma completo del año y los documentos de cada plan.">
            <ul>
              {planesActivos.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/mis-capacitaciones/${p.id}`}
                    className="flex items-center gap-3 border-b border-border px-5 py-3.5 transition-colors last:border-b-0 hover:bg-muted"
                  >
                    <FolderOpen className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-foreground">{p.title}</span>
                      <span className="block text-[13px] text-muted-foreground">
                        Vigencia {p.year} · {p.targetDepartment ?? "Todo el personal"} · {p.tutor.fullName}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          </SeccionAgenda>
        )}
      </div>
    </main>
  );
}
