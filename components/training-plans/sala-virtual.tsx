"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Users } from "lucide-react";

type JitsiApi = {
  dispose: () => void;
  getParticipantsInfo: () => { participantId: string; displayName?: string; formattedDisplayName?: string }[];
  addListener: (evento: string, oyente: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (domain: string, options: Record<string, unknown>) => JitsiApi;
  }
}

/**
 * La videollamada EMBEBIDA dentro de la plataforma, sobre el servidor Jitsi
 * PROPIO de la entidad (el público meet.jit.si corta los embebidos a los 5
 * minutos; el propio no tiene límite: una jornada puede durar la hora
 * completa o más).
 *
 * Debajo de la sala se muestra EN VIVO cuántas personas hay y quiénes son,
 * leyendo los eventos oficiales del iframe (entradas y salidas). La sala se
 * crea sola al entrar el primero; el nombre usa el id de la capacitación
 * (un cuid impredecible), así el enlace no es adivinable.
 *
 * TRAZABILIDAD DE CONEXIÓN: el propio tiempo de la persona se mide en una
 * ref -nunca en estado-, así que medir no dispara ningún render mientras
 * dura la llamada. El tramo (joinedAt → leftAt) se escribe UNA sola vez, al
 * salir, con `navigator.sendBeacon`: no hay sondeo, ni petición mientras la
 * llamada sigue en curso, ni nada que competir con el video por CPU.
 */
export function SalaVirtual({
  domain,
  roomName,
  activityId,
  displayName,
  subject,
  jwt,
  externalParticipantId,
}: {
  /** Dominio del servidor Jitsi (p. ej. campusvirtual.redsaludteforma.com:8443). */
  domain: string;
  roomName: string;
  /** Id de la jornada, para asociar el tramo de conexión a su plan. */
  activityId: string;
  displayName: string;
  subject: string;
  /** Token del personal (moderación). Los invitados externos entran sin token: sin controles de moderación. */
  jwt?: string | null;
  /** Solo para invitados externos: identifica el tramo sin que exista sesión. */
  externalParticipantId?: string;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [participantes, setParticipantes] = useState<string[]>([]);
  const [dentro, setDentro] = useState(false);

  // Ref, no estado: el reloj de la propia conexión no debe re-renderizar
  // nada mientras la llamada está en curso.
  const joinedAtRef = useRef<Date | null>(null);

  useEffect(() => {
    let api: JitsiApi | null = null;
    let cancelado = false;

    function reportarTramo() {
      const joinedAt = joinedAtRef.current;
      joinedAtRef.current = null; // un tramo se reporta una sola vez.
      if (!joinedAt) return;
      const payload = JSON.stringify({
        joinedAt: joinedAt.toISOString(),
        leftAt: new Date().toISOString(),
        displayName,
        ...(externalParticipantId ? { externalParticipantId } : {}),
      });
      navigator.sendBeacon?.(
        `/api/planes-capacitacion/actividades/${activityId}/conexion`,
        new Blob([payload], { type: "application/json" })
      );
    }

    function refrescarParticipantes() {
      if (!api) return;
      const vistos = new Set<string>();
      const lista = api
        .getParticipantsInfo()
        .filter((p) => {
          if (vistos.has(p.participantId)) return false;
          vistos.add(p.participantId);
          return true;
        })
        .map((p) => p.formattedDisplayName ?? p.displayName ?? "Participante")
        .map((n) => n.replace(/ \(me\)$/, " (tú)"));
      // Jitsi a veces reporta al participante local dos veces con ids
      // distintos (pantalla compartida, reconexiones): la etiqueta visible
      // no debe repetirse.
      setParticipantes([...new Set(lista)]);
    }

    function crear() {
      if (cancelado || !contenedor.current || !window.JitsiMeetExternalAPI) return;
      api = new window.JitsiMeetExternalAPI(domain, {
        roomName,
        ...(jwt ? { jwt } : {}),
        parentNode: contenedor.current,
        width: "100%",
        height: "100%",
        userInfo: { displayName },
        configOverwrite: {
          subject,
          prejoinConfig: { enabled: true },
          disableDeepLinking: true,
          // ---- Rendimiento (VPS de 2 CPU y redes institucionales) ----
          // La capacitación es un expositor hablando: los asistentes entran
          // con cámara y micrófono apagados (los prenden si van a
          // intervenir). Video tope 480p -de sobra para una diapositiva o un
          // rostro- y solo se reenvían los últimos 12 videos activos.
          startWithAudioMuted: true,
          startWithVideoMuted: true,
          resolution: 480,
          constraints: { video: { height: { ideal: 480, max: 540, min: 180 } } },
          channelLastN: 12,
          disableAudioLevels: true,
          // VP8 exige menos CPU en los equipos institucionales que VP9/AV1.
          videoQuality: { codecPreferenceOrder: ["VP8", "VP9", "AV1"] },
          p2p: { enabled: true },
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          MOBILE_APP_PROMO: false,
        },
      });
      // Quién está: se refresca con cada entrada/salida real de la sala.
      api.addListener("videoConferenceJoined", () => {
        joinedAtRef.current = new Date();
        setDentro(true);
        refrescarParticipantes();
      });
      api.addListener("videoConferenceLeft", () => {
        reportarTramo();
        setDentro(false);
        setParticipantes([]);
      });
      api.addListener("participantJoined", refrescarParticipantes);
      api.addListener("participantLeft", refrescarParticipantes);
      api.addListener("displayNameChange", refrescarParticipantes);
      setCargando(false);
    }

    if (window.JitsiMeetExternalAPI) {
      crear();
    } else {
      const script = document.createElement("script");
      script.src = `https://${domain}/external_api.js`;
      script.async = true;
      script.onload = crear;
      script.onerror = () => {
        setCargando(false);
        setError(true);
      };
      document.body.appendChild(script);
    }

    // Cerrar pestaña o navegar fuera de la sala también termina el tramo:
    // sin esto, quien cierra la pestaña en vez de darle a "Salir" no
    // quedaría nunca registrado. pagehide es el evento fiable para esto
    // -beforeunload no siempre dispara en móvil-, y sendBeacon está hecho
    // justo para funcionar durante la descarga de la página.
    window.addEventListener("pagehide", reportarTramo);

    return () => {
      cancelado = true;
      window.removeEventListener("pagehide", reportarTramo);
      reportarTramo(); // navegación dentro de la SPA, sin descarga de página.
      api?.dispose();
    };
  }, [domain, roomName, activityId, displayName, subject, jwt, externalParticipantId]);

  return (
    <div className="space-y-3">
      <div className="relative h-[62vh] min-h-[440px] overflow-hidden rounded-2xl border border-border bg-navy">
        {cargando && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white/70">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Preparando la sala…
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/80">
            No se pudo cargar el módulo de videollamada. Verifica tu conexión e intenta de nuevo.
          </div>
        )}
        <div ref={contenedor} className="h-full w-full" />
      </div>

      {/* Quiénes están, en vivo */}
      <div className="surface-glass flex flex-wrap items-center gap-2 px-4 py-3">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-foreground">
          <Users className="h-4 w-4 text-primary" aria-hidden="true" />
          En la llamada ({dentro ? participantes.length : 0})
        </span>
        {!dentro ? (
          <span className="text-xs text-muted-foreground">Únete a la sala para ver quiénes están conectados.</span>
        ) : participantes.length === 0 ? (
          <span className="text-xs text-muted-foreground">Solo estás tú por ahora.</span>
        ) : (
          participantes.map((n, i) => (
            <span key={i} className="rounded-full border border-border/60 bg-card/70 px-2.5 py-1 text-xs font-medium text-foreground">
              {n}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
