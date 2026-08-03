import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { estadoPresaber, estadoPostsaber } from "@/lib/presaber-postsaber";

/**
 * Enlaces cortos y ESTABLES de cada capacitación del plan, pensados para
 * imprimirse como código QR y proyectarse en el salón:
 *
 *   /c/<actividad>/meet      -> la sesión virtual vigente
 *   /c/<actividad>/presaber  -> la evaluación, en su momento presaber
 *   /c/<actividad>/postsaber -> la evaluación, en su momento postsaber
 *
 * La gracia es que el QR no cambia nunca: se resuelve AQUÍ, en el momento
 * del escaneo, contra lo que exista en ese instante. Un cartel impreso en
 * enero sigue sirviendo en octubre aunque el área haya cambiado la sala de
 * Meet o rehecho su evaluación.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ activityId: string; destino: string }> }
) {
  const { activityId, destino } = await params;
  // Detrás del proxy (nginx) el origin de la petición es localhost:3200;
  // los redirects deben salir con el dominio público, no con el interno.
  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  if (!["meet", "presaber", "postsaber"].includes(destino)) {
    return NextResponse.redirect(`${base}/mis-capacitaciones`);
  }

  const actividad = await prisma.trainingActivity.findUnique({
    where: { id: activityId },
    select: {
      planId: true,
      courseId: true,
      presaberOpenedAt: true,
      presaberClosedAt: true,
      postsaberOpenedAt: true,
      postsaberClosedAt: true,
      course: { select: { targetAudience: true } },
      sessions: {
        where: { meetingUrl: { not: null }, status: { not: "CLOSED" } },
        orderBy: { startsAt: "asc" },
        take: 1,
        select: { meetingUrl: true },
      },
    },
  });
  if (!actividad) return NextResponse.redirect(`${base}/mis-capacitaciones`);

  // ---- Meet: no exige sesión iniciada -------------------------------------
  // El enlace de la sala ya es semipúblico -está proyectado en el mismo
  // salón-; obligar a autenticarse aquí solo haría más lento entrar a una
  // reunión que empieza ya. La asistencia con identidad la registra la
  // evaluación, no la sala.
  if (destino === "meet") {
    const url = actividad.sessions[0]?.meetingUrl;
    return NextResponse.redirect(url ?? `${base}/mis-capacitaciones/${actividad.planId}`);
  }

  // ---- Presaber / postsaber: cada enlace responde por SU momento ----------
  // Son dos accesos distintos aunque la evaluación sea la misma: el QR de
  // postsaber jamás debe aterrizar en el presaber (ni al revés). Si la
  // ventana de ESTE enlace no está abierta, se avisa en el cronograma del
  // plan en vez de mostrar la evaluación del otro momento.
  const estadoVentana = destino === "presaber" ? estadoPresaber(actividad) : estadoPostsaber(actividad);
  if (estadoVentana !== "DISPONIBLE") {
    const aviso = `${destino}-${estadoVentana === "CERRADO" ? "cerrado" : "sin-habilitar"}`;
    return NextResponse.redirect(`${base}/mis-capacitaciones/${actividad.planId}?aviso=${aviso}`);
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(`${base}/login?callbackUrl=${encodeURIComponent(`/c/${activityId}/${destino}`)}`);
  }

  if (!actividad.courseId) {
    // Sin contenido montado todavía: al cronograma del plan, que lo explica.
    return NextResponse.redirect(`${base}/mis-capacitaciones/${actividad.planId}`);
  }

  // La audiencia se respeta también por QR: una capacitación asistencial no
  // se le abre a personal administrativo solo porque escaneó el cartel.
  if (
    session.user.role === "STUDENT" &&
    actividad.course &&
    actividad.course.targetAudience !== "AMBOS" &&
    actividad.course.targetAudience !== session.user.personnelType
  ) {
    return NextResponse.redirect(`${base}/mis-capacitaciones/${actividad.planId}`);
  }

  const quiz = await prisma.quiz.findFirst({
    where: { courseId: actividad.courseId, moduleId: null, isActive: true },
    select: { id: true },
  });
  if (!quiz) {
    return NextResponse.redirect(`${base}/mis-capacitaciones/${actividad.planId}`);
  }

  // Quien escanea en el salón tal vez nunca ha abierto el curso: se le
  // inscribe aquí mismo. Es el equivalente electrónico de firmar la planilla
  // al entrar; sin esto el QR aterrizaría en un "no estás inscrito".
  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: session.user.id, courseId: actividad.courseId } },
    update: {},
    create: { userId: session.user.id, courseId: actividad.courseId, status: "ACTIVE", startedAt: new Date() },
  });

  // El destino final es la evaluación; qué momento corre (presaber,
  // postsaber, ninguno) lo decide la propia página con sus ventanas, con
  // los avisos que ya explican cada caso.
  return NextResponse.redirect(`${base}/aula/${actividad.courseId}/quiz/${quiz.id}`);
}
