"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ensureEnrollment, getMomentoParaUsuario, AVISO_POR_BLOQUEO } from "@/lib/training-plans";

/**
 * Entrar a una capacitación del plan desde el cronograma.
 *
 * Es el mismo camino que el QR (/c/...): inscribe bajo demanda, deja el
 * rastro de asistencia y aterriza directo donde toca. La diferencia con
 * antes es que ya no hay una parada intermedia en la ficha pública del curso
 * para dar un segundo clic en «Inscribirse»: la persona ya dijo que quiere
 * entrar cuando pulsó el botón.
 *
 * Va como server action y no como enlace porque crea la inscripción: un
 * <Link> lo prefetchea el navegador con solo pasar el cursor por encima, y
 * eso inscribiría gente que nunca hizo clic.
 */
export async function entrarACapacitacionAction(planId: string, activityId: string) {
  const session = await auth();
  if (!session?.user) redirect(`/login?callbackUrl=${encodeURIComponent(`/mis-capacitaciones/${planId}`)}`);

  const entrada = await ensureEnrollment(session.user.id, activityId);
  if (!entrada.ok) {
    redirect(`/mis-capacitaciones/${entrada.planId || planId}?aviso=${AVISO_POR_BLOQUEO[entrada.motivo]}`);
  }

  // A dónde aterriza lo decide el ciclo de ESTA persona, con la misma función
  // que usa el resto del módulo: si tiene un momento vigente va a presentarlo,
  // y si no, al aula a estudiar el contenido.
  const momento = entrada.quizId ? (await getMomentoParaUsuario(entrada.quizId, session.user.id)).momento : null;
  redirect(momento && entrada.quizId ? `/aula/${entrada.courseId}/quiz/${entrada.quizId}` : `/aula/${entrada.courseId}`);
}
