"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (
      domain: string,
      options: Record<string, unknown>
    ) => { dispose: () => void };
  }
}

/**
 * La videollamada EMBEBIDA dentro de la plataforma, sobre Jitsi Meet
 * (código abierto). A diferencia de Google Meet -que prohíbe embeberse-,
 * Jitsi expone una API oficial de iframe: la sala vive aquí adentro, con el
 * informe de la capacitación al lado, y la persona nunca sale del campus.
 *
 * La sala se crea sola al entrar el primero: no hay que "generarla" en
 * ningún proveedor ni tener cuenta. El nombre de sala usa el id de la
 * capacitación (un cuid impredecible), así el enlace no es adivinable.
 * La grabación se inicia desde el menú de la propia sala (grabación local:
 * el archivo queda en el equipo de quien graba).
 */
export function SalaVirtual({ roomName, displayName, subject }: { roomName: string; displayName: string; subject: string }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let api: { dispose: () => void } | null = null;
    let cancelado = false;

    function crear() {
      if (cancelado || !contenedor.current || !window.JitsiMeetExternalAPI) return;
      api = new window.JitsiMeetExternalAPI("meet.jit.si", {
        roomName,
        parentNode: contenedor.current,
        width: "100%",
        height: "100%",
        userInfo: { displayName },
        configOverwrite: {
          subject,
          prejoinConfig: { enabled: true },
          disableDeepLinking: true,
          startWithAudioMuted: true,
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          MOBILE_APP_PROMO: false,
        },
      });
      setCargando(false);
    }

    if (window.JitsiMeetExternalAPI) {
      crear();
    } else {
      const script = document.createElement("script");
      script.src = "https://meet.jit.si/external_api.js";
      script.async = true;
      script.onload = crear;
      script.onerror = () => {
        setCargando(false);
        setError(true);
      };
      document.body.appendChild(script);
    }

    return () => {
      cancelado = true;
      api?.dispose();
    };
  }, [roomName, displayName, subject]);

  return (
    <div className="relative h-[68vh] min-h-[480px] overflow-hidden rounded-2xl border border-border bg-navy">
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
  );
}
