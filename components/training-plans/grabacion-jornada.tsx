"use client";

import { useEffect, useRef, useState } from "react";
import { CircleDot, Square, Loader2, CheckCircle2, RotateCcw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

type Estado = "inactivo" | "grabando" | "subiendo" | "guardada" | "error";

/**
 * Graba la jornada y la deja GUARDADA en la capacitación.
 *
 * Captura la pestaña o pantalla que elija quien graba (con su audio) y le
 * mezcla el micrófono propio; al detener, el archivo se sube directo a los
 * documentos de la capacitación -no queda regado en el equipo de nadie-.
 * El bitrate va limitado (~1 Mbps) para que una hora pese ~500 MB y la
 * subida sea viable desde la red institucional.
 */
export function GrabacionJornada({ activityId }: { activityId: string }) {
  const [estado, setEstado] = useState<Estado>("inactivo");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const flujos = useRef<MediaStream[]>([]);
  const trozos = useRef<Blob[]>([]);
  /*
   * La grabación terminada se CONSERVA hasta que el servidor confirma que la
   * guardó. Antes se descartaba antes de subirla y, si la subida fallaba,
   * se perdía la jornada entera sin forma de recuperarla.
   */
  const pendiente = useRef<{ blob: Blob; nombre: string } | null>(null);

  // Mientras se graba o hay una grabación sin guardar, avisar antes de cerrar la pestaña.
  useEffect(() => {
    if (estado !== "grabando" && estado !== "subiendo" && estado !== "error") return;
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [estado]);

  function descargarCopia() {
    const g = pendiente.current;
    if (!g) return;
    const url = URL.createObjectURL(g.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = g.nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function iniciar() {
    setMensaje(null);
    try {
      const pantalla = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 15 },
        audio: true,
      });
      let micro: MediaStream | null = null;
      try {
        micro = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        // Sin micrófono no se cancela: la pestaña compartida ya trae el audio de la sala.
      }

      // Mezcla de audio (audio de la sala + micrófono propio) en una sola pista.
      const ctx = new AudioContext();
      const destino = ctx.createMediaStreamDestination();
      if (pantalla.getAudioTracks().length > 0) {
        ctx.createMediaStreamSource(new MediaStream(pantalla.getAudioTracks())).connect(destino);
      }
      if (micro && micro.getAudioTracks().length > 0) {
        ctx.createMediaStreamSource(micro).connect(destino);
      }

      const mezcla = new MediaStream([...pantalla.getVideoTracks(), ...destino.stream.getAudioTracks()]);
      flujos.current = [pantalla, micro, destino.stream].filter((s): s is MediaStream => !!s);

      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";
      const r = new MediaRecorder(mezcla, { mimeType: mime, videoBitsPerSecond: 1_000_000, audioBitsPerSecond: 128_000 });
      trozos.current = [];
      r.ondataavailable = (e) => {
        if (e.data.size > 0) trozos.current.push(e.data);
      };
      r.onstop = subir;
      // Si quien graba corta el "compartir pantalla" desde el navegador, la grabación se cierra sola y se sube.
      pantalla.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (recorder.current?.state === "recording") recorder.current.stop();
      });
      r.start(1000);
      recorder.current = r;
      setEstado("grabando");
    } catch {
      setEstado("inactivo");
      setMensaje("No se inició la grabación: debes permitir compartir la pestaña de la sala.");
    }
  }

  function detener() {
    recorder.current?.stop();
  }

  function subir() {
    for (const s of flujos.current) s.getTracks().forEach((t) => t.stop());
    const fecha = new Date().toISOString().slice(0, 16).replace("T", " ").replace(":", "h");
    pendiente.current = { blob: new Blob(trozos.current, { type: "video/webm" }), nombre: `Grabación jornada ${fecha}.webm` };
    trozos.current = [];
    void enviar(true);
  }

  async function enviar(primerIntento = false) {
    const g = pendiente.current;
    if (!g) return;
    setEstado("subiendo");
    setMensaje(`Guardando la grabación (${Math.round(g.blob.size / 1_048_576)} MB)… no cierres esta pestaña.`);
    try {
      const datos = new FormData();
      datos.append("file", new File([g.blob], g.nombre, { type: "video/webm" }));
      const r = await fetch(`/api/planes-capacitacion/actividades/${activityId}/grabacion`, { method: "POST", body: datos });
      if (!r.ok) throw new Error();
      pendiente.current = null;
      setEstado("guardada");
      setMensaje("La grabación quedó guardada en los documentos de esta capacitación.");
    } catch {
      setEstado("error");
      setMensaje("No se pudo guardar en la plataforma. La grabación NO se perdió: reintenta, o descarga la copia a este equipo. No cierres la pestaña.");
      // Red de seguridad: en el primer fallo se descarga sola una copia al equipo.
      if (primerIntento) descargarCopia();
    }
  }

  return (
    <div className="surface-glass flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-foreground">
          <CircleDot className={`h-4 w-4 ${estado === "grabando" ? "animate-pulse text-destructive" : "text-primary"}`} aria-hidden="true" />
          Grabación de la jornada
        </p>
        <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
          {mensaje ??
            (estado === "grabando"
              ? "Grabando… al detener, el archivo se guarda solo en la capacitación."
              : "Elige la pestaña de la sala (con «compartir audio») y la grabación quedará en los documentos de la capacitación.")}
        </p>
      </div>
      {estado === "grabando" ? (
        <Button type="button" size="sm" variant="destructive" onClick={detener} className="gap-1.5">
          <Square className="h-3.5 w-3.5" aria-hidden="true" /> Detener y guardar
        </Button>
      ) : estado === "subiendo" ? (
        <Button type="button" size="sm" disabled className="gap-1.5">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Guardando…
        </Button>
      ) : estado === "error" && pendiente.current ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={() => void enviar()} className="gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reintentar guardar
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={descargarCopia} className="gap-1.5">
            <Download className="h-3.5 w-3.5" aria-hidden="true" /> Descargar copia
          </Button>
        </div>
      ) : estado === "guardada" ? (
        <span className="flex items-center gap-1.5 text-xs font-semibold text-success">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Guardada
        </span>
      ) : (
        <Button type="button" size="sm" onClick={iniciar} className="gap-1.5">
          <CircleDot className="h-3.5 w-3.5" aria-hidden="true" /> Grabar jornada
        </Button>
      )}
    </div>
  );
}
