import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Video, Users2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireTrainingActivityAccess } from "@/lib/auth-helpers";
import { getActivityLiveMetrics } from "@/lib/training-plans";
import { firmarTokenJitsi } from "@/lib/jitsi";
import { SalaVirtual } from "@/components/training-plans/sala-virtual";
import { PanelEnVivo } from "@/components/training-plans/panel-en-vivo";
import { etiquetaJornada } from "@/components/training-plans/labels";

/**
 * PANEL DE JORNADA EN VIVO del tutor de área.
 *
 * Una sola pantalla para el rato en que la capacitación está ocurriendo: la
 * videollamada y las cifras de participación juntas, para no tener que
 * alternar entre la llamada y un tablero aparte.
 *
 * El layout depende de la modalidad de la jornada vigente, no de una
 * preferencia: si hay sala virtual, video a la izquierda y tarjetas a la
 * derecha; si la jornada es presencial no hay columna de video y las
 * tarjetas ocupan el ancho, que es igual de útil para ver quién va entrando
 * y presentando desde el salón.
 *
 * El permiso se hereda de la ruta: requireTrainingActivityAccess ya limita
 * cada tutor a las actividades de su área.
 */
export default async function JornadaEnVivoPage({
  params,
}: {
  params: Promise<{ id: string; activityId: string }>;
}) {
  const { id, activityId } = await params;
  const { session } = await requireTrainingActivityAccess(activityId);

  const actividad = await prisma.trainingActivity.findUnique({
    where: { id: activityId },
    select: {
      id: true,
      title: true,
      status: true,
      modality: true,
      area: { select: { name: true } },
      sessions: {
        where: { status: { not: "CLOSED" } },
        orderBy: { startsAt: "asc" },
        take: 1,
        select: { startsAt: true, endsAt: true, shift: true, modality: true, meetingUrl: true, location: true },
      },
    },
  });
  if (!actividad) notFound();

  const metricas = await getActivityLiveMetrics(activityId);
  if (!metricas) notFound();

  const jornada = actividad.sessions[0] ?? null;
  // La modalidad de la JORNADA manda sobre la de la línea del plan: una
  // actividad mixta puede dictarse hoy presencial y la semana entrante
  // virtual, y lo que importa aquí es la de hoy.
  const modalidad = jornada?.modality ?? actividad.modality;
  const conVideo = modalidad === "VIRTUAL" || modalidad === "MIXTA";

  // Mismo mecanismo que la sala: el personal entra con token firmado (puede
  // moderar); no se duplica nada de la lógica de Jitsi.
  const jitsiDomain = process.env.NEXT_PUBLIC_JITSI_DOMAIN ?? "meet.jit.si";
  const tokenSala = conVideo ? await firmarTokenJitsi(session.user.name ?? "Tutor") : null;

  return (
    <main className="canvas-vivo min-h-full flex-1">
      <div className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8">
        <Link
          href={`/tutor/planes-capacitacion/${id}/actividades/${activityId}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Volver a la ficha
        </Link>

        <header className="mt-4 mb-6">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
            {actividad.area?.name ?? "Capacitación"}
          </p>
          <h1 className="mt-1.5 font-display text-[clamp(1.6rem,3.2vw,2.1rem)] font-extrabold leading-[1.1] tracking-tight text-foreground">
            {actividad.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {jornada && (
              <span className="flex items-center gap-1.5">
                <Users2 className="h-4 w-4 text-primary" aria-hidden="true" />
                {etiquetaJornada(jornada)}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              {conVideo ? (
                <>
                  <Video className="h-4 w-4 text-primary" aria-hidden="true" />
                  Sesión virtual
                </>
              ) : (
                <>
                  <MapPin className="h-4 w-4 text-primary" aria-hidden="true" />
                  {jornada?.location ?? "Jornada presencial"}
                </>
              )}
            </span>
            {actividad.status === "CLOSED" && (
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                Jornada cerrada · cifras definitivas
              </span>
            )}
          </div>
        </header>

        {conVideo ? (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            {/* El embed NO lleva vidrio: el glass se reserva para las tarjetas
                de estado, donde aporta jerarquía. */}
            <div className="min-w-0">
              <SalaVirtual
                domain={jitsiDomain}
                roomName={`RedSaludTeForma-${actividad.id}`}
                activityId={actividad.id}
                displayName={session.user.name ?? "Tutor"}
                subject={actividad.title}
                jwt={tokenSala}
                esPresentador
              />
            </div>
            <PanelEnVivo activityId={activityId} inicial={metricas} conVideo />
          </div>
        ) : (
          <PanelEnVivo activityId={activityId} inicial={metricas} conVideo={false} />
        )}
      </div>
    </main>
  );
}
