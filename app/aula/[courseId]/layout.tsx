import { redirect } from "next/navigation";
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
        <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
