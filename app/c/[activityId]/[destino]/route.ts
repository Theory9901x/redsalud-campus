import { coincideAudienciaCapacitacion } from "@/lib/audiencia-capacitacion";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { estadoPresaber, estadoPostsaber, cicloEsAutomatico } from "@/lib/presaber-postsaber";
import { ensureEnrollment, AVISO_POR_BLOQUEO } from "@/lib/training-plans";
import { registrarAsistenciaSesion } from "@/lib/sesiones-presenciales";
import { jornadaDeEnlace, jornadaCerrada, jornadaEnCurso, COOKIE_JORNADA, DURACION_COOKIE_JORNADA_S } from "@/lib/jornadas";

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
 *
 * ACCESOS POR JORNADA: cada jornada tiene su propio juego de enlaces, que
 * llevan `?s=<token de la jornada>`. Lo que entra por ellos -asistencia,
 * intentos, conexiones- queda en ESA jornada. Sin `?s=` (QR generales ya
 * impresos) se resuelve a la jornada vigente (lib/jornadas).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ activityId: string; destino: string }> }
) {
  const { activityId, destino } = await params;
  // Detrás del proxy (nginx) el origin de la petición es localhost:3200;
  // los redirects deben salir con el dominio público, no con el interno.
  const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  // Enlace de UNA jornada: ?s=<token de la jornada> (los genera la tarjeta
  // de cada jornada y la puerta /s/<token>). Sin él, enlace general.
  const tokenPedido = new URL(request.url).searchParams.get("s");

  if (!["meet", "presaber", "postsaber"].includes(destino)) {
    return NextResponse.redirect(`${base}/mis-capacitaciones`);
  }

  const actividad = await prisma.trainingActivity.findUnique({
    where: { id: activityId },
    select: {
      planId: true,
      targetAudience: true,
      plan: { select: { kind: true, isIndependent: true } },
      courseId: true,
      status: true,
      presaberOpenedAt: true,
      presaberClosedAt: true,
      postsaberOpenedAt: true,
      postsaberClosedAt: true,
    },
  });
  if (!actividad) return NextResponse.redirect(`${base}/mis-capacitaciones`);
  const destinoListado = actividad.plan.isIndependent ? "/mis-capacitaciones/independientes" : `/mis-capacitaciones/${actividad.planId}`;
  const viewer = await auth();
  if (viewer?.user.role === "STUDENT" && actividad.plan.kind === "CAPACITACION" && (actividad.status !== "OPEN" || !coincideAudienciaCapacitacion(actividad.targetAudience, viewer.user.personnelType))) return NextResponse.redirect(`${base}/mis-capacitaciones`);

  // La jornada del enlace: la del token, o -enlace general- la vigente.
  const { jornada, explicita } = await jornadaDeEnlace(activityId, tokenPedido);
  const tokenSesion = jornada?.tokenPublico ?? null;
  /** Redirige dejando la cookie que atribuye a ESTA jornada lo que la persona haga después. */
  const conJornada = (url: string) => {
    const res = NextResponse.redirect(url);
    if (jornada) {
      res.cookies.set(COOKIE_JORNADA(activityId), jornada.id, {
        httpOnly: true,
        sameSite: "lax",
        maxAge: DURACION_COOKIE_JORNADA_S,
        path: "/",
      });
    }
    return res;
  };

  // ---- Meet: no exige sesión iniciada -------------------------------------
  // El enlace de la sala ya es semipúblico -está proyectado en el mismo
  // salón-; obligar a autenticarse aquí solo haría más lento entrar a una
  // reunión que empieza ya. La asistencia con identidad la registra la
  // evaluación, no la sala.
  if (destino === "meet") {
    const session = await auth();
    if (!session?.user) return NextResponse.redirect(`${base}/login?callbackUrl=${encodeURIComponent(new URL(request.url).pathname + new URL(request.url).search)}`);
    if (jornada?.audience === "EXTERNAL" && session.user.role === "STUDENT") return NextResponse.redirect(`${base}/invitado/${activityId}?s=${jornada.tokenPublico}`);
    // La jornada con sala externa propia (Meet, Teams) va a ella; si no, a la
    // sala integrada de la capacitación, con la jornada en el enlace para que
    // cada conexión quede en ESA jornada.
    const externa = jornada?.meetingUrl && !jornada.meetingUrl.includes(`/sala/${activityId}`) ? jornada.meetingUrl : null;
    if (externa) return conJornada(externa);
    return conJornada(`${base}/sala/${activityId}${tokenSesion ? `?s=${tokenSesion}` : ""}`);
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
      return NextResponse.redirect(`${base}${destinoListado}?aviso=${aviso}`);
    }
  } else if (actividad.status === "CLOSED") {
    // Modo automático con la jornada cerrada: el ciclo quedó congelado.
    const aviso = `${destino}-cerrado`;
    return NextResponse.redirect(`${base}${destinoListado}?aviso=${aviso}`);
  }

  // ---- Gate por FASE de la jornada (server-side) --------------------------
  // Solo con el enlace PROPIO de la jornada. Si el tutor está conduciendo la
  // jornada por fases (presaber → capacitación → postsaber), la fase manda:
  // pedir el postsaber en fase presaber (o cualquier otro salto) rebota a la
  // puerta de la jornada, que muestra lo que SÍ está abierto ahora. En fase
  // REGISTRO -jornada que no se conduce por fases, p. ej. virtual- rige el
  // ciclo normal de la capacitación. Jornada cerrada: no admite registros.
  if (explicita && jornada) {
    const faseEsperada = destino === "presaber" ? "PRESABER" : "POSTSABER";
    const conducidaPorFases = jornada.fase === "PRESABER" || jornada.fase === "CAPACITACION" || jornada.fase === "POSTSABER";
    if (jornadaCerrada(jornada) || (conducidaPorFases && jornada.fase !== faseEsperada)) {
      return NextResponse.redirect(`${base}/s/${jornada.tokenPublico}`);
    }
  }

  const session = await auth();
  if (!session?.user) {
    const destinoConSesion = tokenPedido ? `/c/${activityId}/${destino}?s=${tokenPedido}` : `/c/${activityId}/${destino}`;
    return NextResponse.redirect(`${base}/login?callbackUrl=${encodeURIComponent(destinoConSesion)}`);
  }

  // Entrar a la evaluación por el enlace de una jornada registra la
  // asistencia a ESA jornada si aún no estaba (quien llega directo al
  // postsaber no se queda sin asistencia). Idempotente. Con el enlace
  // general solo si la jornada vigente está ocurriendo: presentar el
  // presaber días antes no es haber asistido.
  if (jornada && !jornadaCerrada(jornada) && (explicita || jornadaEnCurso(jornada))) {
    await registrarAsistenciaSesion(jornada.id, session.user.id, "QR").catch(() => null);
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
        return NextResponse.redirect(`${base}${destinoListado}?aviso=postsaber-requiere-presaber`);
      }
      if (destino === "presaber" && prePresentado) {
        return NextResponse.redirect(`${base}${destinoListado}?aviso=presaber-ya-presentado`);
      }
    }
  }

  // Validación de entrada e inscripción: la misma función que usa el botón
  // del cronograma. Quien escanea en el salón tal vez nunca abrió el curso;
  // se le inscribe aquí, que es el equivalente electrónico de firmar la
  // planilla al entrar.
  const entrada = await ensureEnrollment(session.user.id, activityId);
  if (!entrada.ok) {
    return NextResponse.redirect(`${base}${destinoListado}?aviso=${AVISO_POR_BLOQUEO[entrada.motivo]}`);
  }
  if (!entrada.quizId) {
    return NextResponse.redirect(`${base}${destinoListado}`);
  }

  // El destino final es la evaluación; qué momento corre (presaber,
  // postsaber, ninguno) lo decide la propia página con sus ventanas, con
  // los avisos que ya explican cada caso. La cookie de jornada atribuye el
  // intento a la jornada del enlace.
  return conJornada(`${base}/aula/${entrada.courseId}/quiz/${entrada.quizId}`);
}
