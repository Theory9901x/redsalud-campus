import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleDashed, Download, FileSpreadsheet, PencilLine, Plus, Search } from "lucide-react";
import { requireTutorOrAdmin } from "@/lib/auth-helpers";
import { alcanceAdscripcion } from "@/lib/encuestas/adscripcion";
import { prisma } from "@/lib/prisma";
import { veComoAdmin } from "@/lib/roles";

export const metadata = { title: "Evaluaciones" };

type Parametros = { q?: string; estado?: string };

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * EVALUACIONES: el punto de entrada para armar la evaluación presaber /
 * postsaber de cada capacitación. Lista las capacitaciones que la persona
 * gestiona (su área, o todas si es administrador), dice cuáles ya tienen
 * evaluación y lleva directo al constructor, que vive en la pestaña
 * «Evaluación» de la capacitación. Arriba: crear una capacitación nueva y
 * descargar la plantilla de Excel.
 */
export default async function EvaluacionesPage({ searchParams }: { searchParams: Promise<Parametros> }) {
  const session = await requireTutorOrAdmin();
  const esAdmin = veComoAdmin(session.user.role);
  const [scope, params] = await Promise.all([alcanceAdscripcion(session.user), searchParams]);

  const actividades = await prisma.trainingActivity.findMany({
    where: { AND: [scope.actividades, { plan: { kind: "CAPACITACION", status: { not: "CLOSED" } } }] },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      planId: true,
      courseId: true,
      status: true,
      area: { select: { name: true } },
      plan: { select: { title: true, isIndependent: true } },
    },
  });
  const courseIds = [...new Set(actividades.map((a) => a.courseId).filter((x): x is string => !!x))];
  const quizzes = courseIds.length
    ? await prisma.quiz.findMany({
        where: { courseId: { in: courseIds }, moduleId: null, isActive: true },
        select: { courseId: true, _count: { select: { questions: { where: { isActive: true } }, attempts: true } } },
      })
    : [];
  const porCurso = new Map(quizzes.map((q) => [q.courseId, q._count]));

  const filas = actividades.map((a) => {
    const conteo = a.courseId ? porCurso.get(a.courseId) : undefined;
    const base = a.plan.isIndependent ? "/tutor/capacitaciones" : esAdmin ? "/admin/planes-capacitacion" : "/tutor/planes-capacitacion";
    return {
      id: a.id,
      titulo: a.title,
      area: a.area?.name ?? null,
      plan: a.plan.isIndependent ? "Capacitación del área" : a.plan.title,
      cerrada: a.status === "CLOSED",
      preguntas: conteo?.questions ?? 0,
      intentos: conteo?.attempts ?? 0,
      href: `${base}/${a.planId}/actividades/${a.id}?pestana=evaluacion`,
    };
  });

  const q = (params.q ?? "").trim().slice(0, 80);
  const estado = params.estado === "sin" || params.estado === "con" ? params.estado : "todas";
  const sin = filas.filter((f) => f.preguntas === 0).length;
  const visibles = filas
    .filter((f) => estado === "todas" || (estado === "sin" ? f.preguntas === 0 : f.preguntas > 0))
    .filter((f) => !q || sinTildes(`${f.titulo} ${f.area ?? ""} ${f.plan}`).includes(sinTildes(q)))
    // Primero las que faltan por armar.
    .sort((a, b) => Number(a.preguntas > 0) - Number(b.preguntas > 0));

  const enlace = (e: string) => {
    const sp = new URLSearchParams();
    if (e !== "todas") sp.set("estado", e);
    if (q) sp.set("q", q);
    const s = sp.toString();
    return s ? `/tutor/evaluaciones?${s}` : "/tutor/evaluaciones";
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Evaluaciones</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
            Arma la evaluación presaber y postsaber de cada capacitación. Es una sola evaluación que la persona presenta antes y después, para medir lo aprendido.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/planes-capacitacion/evaluacion/plantilla" className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[14.5px] font-semibold text-foreground hover:border-primary/60">
            <Download className="h-4 w-4" aria-hidden="true" />
            Plantilla de Excel
          </a>
          <Link href="/tutor/capacitaciones/nueva" className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-[14.5px] font-semibold text-primary-foreground hover:opacity-90">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Crear capacitación
          </Link>
        </div>
      </header>

      <ol className="grid gap-3 md:grid-cols-3">
        {[
          { Icono: Plus, titulo: "1. Elige la capacitación", texto: "Búscala en la lista de abajo, o créala si todavía no existe." },
          { Icono: PencilLine, titulo: "2. Escribe las preguntas", texto: "Una por una en la misma página, marcando cuál es la respuesta correcta." },
          { Icono: FileSpreadsheet, titulo: "…o cárgalas desde Excel", texto: "Descarga la plantilla, llénala y súbela. Antes de guardar ves qué se va a cargar." },
        ].map(({ Icono, titulo, texto }) => (
          <li key={titulo} className="flex gap-3 rounded-xl border border-border bg-card p-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icono className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-[14.5px] font-bold text-foreground">{titulo}</span>
              <span className="block text-[13.5px] leading-snug text-muted-foreground">{texto}</span>
            </span>
          </li>
        ))}
      </ol>

      <section className="overflow-hidden rounded-xl border border-border bg-card" aria-label="Capacitaciones">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-3 sm:p-4">
          <nav className="inline-flex rounded-lg border border-border p-0.5" aria-label="Filtrar por estado">
            {[
              { valor: "todas", texto: `Todas (${filas.length})` },
              { valor: "sin", texto: `Sin evaluación (${sin})` },
              { valor: "con", texto: `Con evaluación (${filas.length - sin})` },
            ].map((o) => (
              <Link
                key={o.valor}
                href={enlace(o.valor)}
                aria-current={estado === o.valor ? "true" : undefined}
                className={`rounded-md px-3 py-2 text-[13.5px] font-semibold ${estado === o.valor ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {o.texto}
              </Link>
            ))}
          </nav>
          <form action="/tutor/evaluaciones" role="search" className="flex h-10 min-w-[240px] flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 sm:max-w-sm">
            {estado !== "todas" && <input type="hidden" name="estado" value={estado} />}
            <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <input type="search" name="q" defaultValue={q} placeholder="Buscar una capacitación" aria-label="Buscar una capacitación" className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none" />
          </form>
        </div>

        {visibles.length === 0 ? (
          <p className="p-10 text-center text-[14.5px] text-muted-foreground">
            {filas.length === 0 ? "Todavía no tienes capacitaciones. Crea la primera con el botón «Crear capacitación»." : "Ninguna capacitación coincide con ese filtro."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {visibles.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 sm:p-4">
                <div className="min-w-0 flex-1 basis-64">
                  <p className="text-[15px] font-semibold leading-snug text-foreground">{f.titulo}</p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">{[f.area, f.plan, f.cerrada ? "Cerrada" : null].filter(Boolean).join(" · ")}</p>
                </div>
                {f.preguntas > 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-[13px] font-semibold text-foreground">
                    <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
                    {f.preguntas} {f.preguntas === 1 ? "pregunta" : "preguntas"}
                    {f.intentos > 0 ? ` · ${f.intentos} ${f.intentos === 1 ? "presentación" : "presentaciones"}` : ""}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-warning/50 bg-warning/15 px-3 py-1 text-[13px] font-semibold text-foreground">
                    <CircleDashed className="h-4 w-4" aria-hidden="true" />
                    Sin evaluación
                  </span>
                )}
                <Link
                  href={f.href}
                  className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-[14px] font-semibold ${f.preguntas > 0 ? "border border-border text-foreground hover:border-primary/60" : "bg-primary text-primary-foreground hover:opacity-90"}`}
                >
                  {f.preguntas > 0 ? "Editar evaluación" : "Armar evaluación"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
