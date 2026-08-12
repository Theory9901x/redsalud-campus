import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { estadoPresaber, estadoPostsaber, cicloEsAutomatico } from "@/lib/presaber-postsaber";
import { ensureEnrollment, AVISO_POR_BLOQUEO } from "@/lib/training-plans";

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
      status: true,
      presaberOpenedAt: true,
      presaberClosedAt: true,
      postsaberOpenedAt: true,
      postsaberClosedAt: true,
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
    // Sin jornada agendada con enlace propio, el destino natural es la sala
    // integrada de la capacitación: existe siempre y se crea sola al entrar.
    const url = actividad.sessions[0]?.meetingUrl;
    return NextResponse.redirect(url ?? `${base}/sala/${activityId}`);
  }

  // ---- Presaber / postsaber: cada enlace responde por SU momento ----------
  // Son dos accesos distintos aunque la evaluación sea la misma: el QR de
  // postsaber jamás debe aterrizar en el presaber (ni al revés).
  const automatico = cicloEsAutomatico(actividad);

  // Modo MANUAL: las ventanas del área mandan y se validan aquí, antes del
  // login, con el aviso correspondiente en el cronograma del plan.
  if (!automatico) {
    const estadoVentana = destino === "presaber" ? estadoPresaber(actividad) : estadoPostsaber(actividad);
    if (estadoVentana !== "DISPONIBLE") {
      const aviso = `${destino}-${estadoVentana === "CERRADO" ? "cerrado" : "sin-habilitar"}`;
      return NextResponse.redirect(`${base}/mis-capacitaciones/${actividad.planId}?aviso=${aviso}`);
    }
  } else if (actividad.status === "CLOSED") {
    // Modo automático con la jornada cerrada: el ciclo quedó congelado.
    const aviso = `${destino}-cerrado`;
    return NextResponse.redirect(`${base}/mis-capacitaciones/${actividad.planId}?aviso=${aviso}`);
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(`${base}/login?callbackUrl=${encodeURIComponent(`/c/${activityId}/${destino}`)}`);
  }

  // Modo AUTOMÁTICO: el momento depende del recorrido de ESTA persona, así
  // que solo puede validarse después de saber quién es. El QR de postsaber
  // exige haber presentado el presaber; el de presaber avisa si ya se
  // presentó (su momento vigente ya es el postsaber).
  if (automatico && actividad.courseId) {
    const quizAuto = await prisma.quiz.findFirst({
      where: { courseId: actividad.courseId, moduleId: null, isActive: true },
      select: { id: true },
    });
    if (quizAuto) {
      const prePresentado =
        (await prisma.quizAttempt.count({
          where: { quizId: quizAuto.id, userId: session.user.id, moment: "PRESABER", score: { not: null } },
        })) > 0;
      if (destino === "postsaber" && !prePresentado) {
        return NextResponse.redirect(`${base}/mis-capacitaciones/${actividad.planId}?aviso=postsaber-requiere-presaber`);
      }
      if (destino === "presaber" && prePresentado) {
        return NextResponse.redirect(`${base}/mis-capacitaciones/${actividad.planId}?aviso=presaber-ya-presentado`);
      }
    }
  }

  // Validación de entrada e inscripción: la misma función que usa el botón
  // del cronograma. Quien escanea en el salón tal vez nunca abrió el curso;
  // se le inscribe aquí, que es el equivalente electrónico de firmar la
  // planilla al entrar.
  const entrada = await ensureEnrollment(session.user.id, activityId);
  if (!entrada.ok) {
    return NextResponse.redirect(`${base}/mis-capacitaciones/${actividad.planId}?aviso=${AVISO_POR_BLOQUEO[entrada.motivo]}`);
  }
  if (!entrada.quizId) {
    return NextResponse.redirect(`${base}/mis-capacitaciones/${actividad.planId}`);
  }

  // El destino final es la evaluación; qué momento corre (presaber,
  // postsaber, ninguno) lo decide la propia página con sus ventanas, con
  // los avisos que ya explican cada caso.
  return NextResponse.redirect(`${base}/aula/${entrada.courseId}/quiz/${entrada.quizId}`);
}
