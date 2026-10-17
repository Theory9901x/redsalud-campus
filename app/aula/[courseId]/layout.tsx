import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { getAulaData } from "@/lib/aula";
import { AulaSidebar } from "@/components/aula/aula-sidebar";
import { AulaHeader } from "@/components/aula/aula-header";

export default async function AulaLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const data = await getAulaData(courseId, session.user.id);
  if (!data) redirect("/no-autorizado");

  const lessonCount = data.modules.reduce((total, m) => total + m.lessons.length, 0);

  // Evaluación presaber/postsaber de una capacitación del plan: su
  // contenedor interno NO es un curso. Sin cabecera del aula, sin temario y
  // sin constancia: solo la evaluación, con la vuelta al plan.
  if (data.course.esContenedorCapacitacion) {
    const actividad = await prisma.trainingActivity.findFirst({
      where: { courseId },
      select: { planId: true, area: { select: { name: true } } },
    });
    return (
      <div className="accent-student aula-canvas flex min-h-screen flex-col">
        <div className="mx-auto w-full max-w-[1200px] px-4 pt-5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              href={actividad ? `/mis-capacitaciones/${actividad.planId}` : "/mis-capacitaciones"}
              className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Mis capacitaciones
            </Link>
            <p className="font-mono text-[10.5px] font-bold uppercase tracking-[0.16em] text-primary">
              Capacitación{actividad?.area ? ` · ${actividad.area.name}` : ""} · Evaluación presaber / postsaber
            </p>
          </div>
        </div>
        <main className="mx-auto w-full min-w-0 max-w-[1200px] flex-1 px-4 py-4 pb-8 sm:px-6">{children}</main>
      </div>
    );
  }

  return (
    // aula-canvas: lienzo con blobs de marca desenfocados para que las
    // superficies glass del aula tengan color real que difuminar.
    // accent-student fija --accent (turquesa del rol). Sin esta clase,
    // var(--accent) cae al token neutro de shadcn -casi blanco en claro y
    // gris pizarra en oscuro- y el anillo, los contadores y las barras se
    // ven apagados.
    // En escritorio la página NO se desplaza: la altura es la del viewport y
    // cada columna tiene su propio scroll. Así el carril de módulos se queda
    // quieto -abrir un módulo desplaza solo dentro del carril, no la página
    // entera- y la cabecera no se va. En móvil se mantiene el scroll normal:
    // dos columnas con scroll independiente en una pantalla de 360 px sería
    // peor que el desplazamiento de toda la vida.
    <div className="accent-student aula-canvas flex min-h-screen flex-col lg:h-screen lg:min-h-0 lg:overflow-hidden">
      <AulaHeader
        courseId={courseId}
        title={data.course.title}
        imageUrl={data.course.imageUrl}
        courseType={data.course.courseType}
        durationHours={data.course.durationHours}
        moduleCount={data.modules.length}
        lessonCount={lessonCount}
      />

      {/* min-h-0: sin esto un hijo con overflow dentro de un flex se niega a
          encogerse y desborda el contenedor en vez de desplazarse. */}
      <div className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
        <AulaSidebar
          esAdmin={session.user.role === "ADMIN"}
          courseId={courseId}
          courseTitle={data.course.title}
          courseType={data.course.courseType}
          progreso={data.progreso}
          modules={data.modules}
          finalQuizzes={data.finalQuizzes}
        />
        <main className="min-w-0 flex-1 px-4 py-4 pb-8 sm:px-6 lg:overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
