import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, BookOpen, CalendarRange, Clock, GraduationCap, Layers, Users } from "lucide-react";
import { requireSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { ModuloHero } from "@/components/training-plans/modulo-hero";
import { FocoCursor } from "@/components/training-plans/plan-dinamico";
import { PildoraEstado, escalon } from "@/components/training-plans/plan-visual";
import { COURSE_STATUS_LABELS } from "@/components/cursos/labels";
import { Medidor, VacioCompacto } from "@/components/tutor/centro-mando";
import { nivelSemaforo } from "@/components/training-plans/labels";

const ESTADO_PILDORA = { PUBLISHED: "ACTIVE", DRAFT: "DRAFT", ARCHIVED: "CLOSED" } as const;

/**
 * MIS CURSOS: cada curso como instrumento -no como póster-: contenido
 * (módulos, lecciones, evaluación final), participación (inscritos,
 * completaron, constancias) y si es contenido del Plan Institucional.
 * Los cursos los crea y asigna el administrador; aquí se entra a gestionar
 * su contenido.
 */
export default async function TutorCursosPage() {
  const session = await requireSession("/tutor/cursos");
  const tutorId = session.user.id;

  const [courses, inscripciones] = await Promise.all([
    prisma.course.findMany({
      where: { tutorId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        status: true,
        courseType: true,
        durationHours: true,
        imageUrl: true,
        category: { select: { name: true } },
        modules: { select: { _count: { select: { lessons: true } } } },
        quizzes: { where: { moduleId: null, isActive: true }, select: { id: true }, take: 1 },
        _count: { select: { certificates: true } },
        trainingActivities: { select: { plan: { select: { title: true } } }, take: 1 },
      },
    }),
    prisma.enrollment.groupBy({ by: ["courseId", "status"], where: { course: { tutorId } }, _count: { _all: true } }),
  ]);

  const porCurso = new Map<string, Record<string, number>>();
  for (const g of inscripciones) {
    const m = porCurso.get(g.courseId) ?? {};
    m[g.status] = g._count._all;
    porCurso.set(g.courseId, m);
  }
  const filas = courses.map((c) => {
    const m = porCurso.get(c.id) ?? {};
    const inscritos = (m.ACTIVE ?? 0) + (m.COMPLETED ?? 0) + (m.FAILED ?? 0);
    return {
      ...c,
      lecciones: c.modules.reduce((s, mo) => s + mo._count.lessons, 0),
      inscritos,
      completados: m.COMPLETED ?? 0,
      finalizacion: inscritos > 0 ? Math.round(((m.COMPLETED ?? 0) / inscritos) * 100) : null,
    };
  });
  const total = (k: "inscritos" | "completados") => filas.reduce((s, f) => s + f[k], 0);

  return (
    <div className="space-y-5">
      <ModuloHero
        eyebrow="Cursos · Contenido a tu cargo"
        Icono={BookOpen}
        titulo="Mis"
        acento="cursos"
        descripcion={`${courses.length} ${courses.length === 1 ? "curso" : "cursos"} a tu cargo. Los crea y asigna el administrador; aquí gestionas su contenido y ves cómo avanza la gente.`}
        cifras={[
          { valor: courses.length, etiqueta: "Cursos", detalle: `Publicados ${filas.filter((f) => f.status === "PUBLISHED").length} · borradores ${filas.filter((f) => f.status === "DRAFT").length}` },
          { valor: total("inscritos"), etiqueta: "Inscritos" },
          { valor: total("completados"), etiqueta: "Completaron" },
          { valor: filas.reduce((s, f) => s + f._count.certificates, 0), etiqueta: "Constancias" },
        ]}
        acciones={
          <>
            <Link href="/tutor/inscritos?vista=cursos" className="boton-hero">
              <Users className="h-4 w-4" aria-hidden="true" />
              Inscritos y progreso
            </Link>
            <Link href="/cursos" className="enlace-hero">
              <Layers className="h-4 w-4" aria-hidden="true" />
              Catálogo institucional
            </Link>
          </>
        }
      />

      {filas.length === 0 ? (
        <VacioCompacto Icono={BookOpen}>No tienes cursos asignados. Cuando el administrador te asigne uno, aparecerá aquí.</VacioCompacto>
      ) : (
        <FocoCursor className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {filas.map((c, i) => {
            const nivel = nivelSemaforo(c.finalizacion);
            return (
              <article key={c.id} className="plan-instancia revelar flex flex-col gap-4 p-5" data-estado={ESTADO_PILDORA[c.status]} style={escalon(i + 1)}>
                <div className="flex items-start gap-3.5">
                  {c.imageUrl ? (
                    <Image src={c.imageUrl} alt="" width={56} height={56} className="h-14 w-14 shrink-0 rounded-xl border border-border object-cover" />
                  ) : (
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary/8 text-primary">
                      <GraduationCap className="h-6 w-6" aria-hidden="true" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="mono-label truncate">{c.category?.name ?? "Sin categoría"}</p>
                    <h2 className="mt-1 font-display text-[1.02rem] font-bold leading-snug tracking-tight text-foreground">
                      <Link href={`/tutor/cursos/${c.id}`} className="enlace-tarjeta">
                        {c.title}
                      </Link>
                    </h2>
                  </div>
                  <span className="flecha grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground" aria-hidden="true">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <PildoraEstado estado={ESTADO_PILDORA[c.status]}>{COURSE_STATUS_LABELS[c.status]}</PildoraEstado>
                  <span className="chip-dato">
                    <Clock aria-hidden="true" />
                    {c.durationHours} h
                  </span>
                  <span className="chip-dato">
                    {c.modules.length} módulos · {c.lecciones} lecciones
                  </span>
                  {c.quizzes.length > 0 ? <span className="chip-dato">Evaluación final</span> : <span className="chip-dato chip-dato-alerta">Sin evaluación final</span>}
                  {c.trainingActivities[0] && (
                    <span className="chip-dato chip-dato-primario" title={c.trainingActivities[0].plan.title}>
                      <CalendarRange aria-hidden="true" />
                      PIC
                    </span>
                  )}
                </div>

                <div className="tut-cifras mt-auto" style={{ ["--cols" as string]: 3 }}>
                  <div>
                    <b>{c.inscritos}</b>
                    <span>Inscritos</span>
                  </div>
                  <div>
                    <b>{c.completados}</b>
                    <span>Completaron</span>
                  </div>
                  <div>
                    <b>{c._count.certificates}</b>
                    <span>Constancias</span>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <Medidor valor={c.finalizacion} nivel={nivel} className="flex-1" />
                    <span className="tut-nivel w-10 text-right text-[12px]" data-nivel={nivel}>
                      {c.finalizacion === null ? "—" : `${c.finalizacion}%`}
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Finalización</p>
                </div>
              </article>
            );
          })}
        </FocoCursor>
      )}
    </div>
  );
}
