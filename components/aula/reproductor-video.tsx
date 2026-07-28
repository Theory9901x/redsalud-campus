"use client";

import { useEffect, useRef, useState } from "react";
import { guardarPosicionLeccionAction } from "@/app/aula/[courseId]/actions";

/** A partir de aquí se considera visto: el final suele ser créditos o cierre. */
const UMBRAL_COMPLETADO = 0.9;
/** Cada cuánto se persiste la posición mientras reproduce. */
const INTERVALO_GUARDADO_MS = 10_000;

/**
 * Reproductor de video subido, con marcado automático de completitud.
 *
 * La lección se marca completada al alcanzar el 90 % de reproducción, no al
 * terminar: casi nadie se queda hasta el último fotograma, y exigirlo dejaba
 * lecciones vistas sin marcar.
 *
 * La posición se guarda en el servidor cada 10 segundos, no en el navegador,
 * para que quien empiece el video en el computador de la sede pueda
 * terminarlo en otro equipo.
 */
export function ReproductorVideo({
  courseId,
  lessonId,
  src,
  posicionInicial,
  yaCompletada,
  onCompletar,
}: {
  courseId: string;
  lessonId: string;
  src: string;
  posicionInicial: number | null;
  yaCompletada: boolean;
  /** Marca la lección como completada. Lo provee el contenedor. */
  onCompletar: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const ultimoGuardado = useRef(0);
  const yaDisparado = useRef(yaCompletada);
  const [reanudado, setReanudado] = useState(false);

  // Reanudar donde quedó. Solo una vez y solo si falta un trecho: reabrir un
  // video casi terminado en el segundo 0 es lo esperable.
  useEffect(() => {
    const video = ref.current;
    if (!video || reanudado || !posicionInicial) return;
    const alCargar = () => {
      if (posicionInicial < video.duration * UMBRAL_COMPLETADO) {
        video.currentTime = posicionInicial;
      }
      setReanudado(true);
    };
    if (video.readyState >= 1) alCargar();
    else video.addEventListener("loadedmetadata", alCargar, { once: true });
  }, [posicionInicial, reanudado]);

  function alAvanzar() {
    const video = ref.current;
    if (!video || !video.duration) return;

    const ahora = Date.now();
    if (ahora - ultimoGuardado.current > INTERVALO_GUARDADO_MS) {
      ultimoGuardado.current = ahora;
      // Sin await ni reintento: si este guardado se pierde, el siguiente (10 s
      // después) lo corrige. Reintentar aquí solo acumularía peticiones.
      void guardarPosicionLeccionAction(courseId, lessonId, video.currentTime);
    }

    if (!yaDisparado.current && video.currentTime / video.duration >= UMBRAL_COMPLETADO) {
      yaDisparado.current = true;
      onCompletar();
    }
  }

  // Guardar al salir de la página: sin esto se pierden hasta 10 segundos de
  // avance cada vez que alguien cierra la pestaña a mitad del video.
  useEffect(() => {
    return () => {
      const video = ref.current;
      if (video && video.currentTime > 0) {
        void guardarPosicionLeccionAction(courseId, lessonId, video.currentTime);
      }
    };
  }, [courseId, lessonId]);

  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl border border-border bg-black shadow-sm">
      {/* src apunta a /api/media/[id], que soporta Range/206 para poder
          adelantar sin descargar el archivo entero. */}
      <video ref={ref} controls className="h-full w-full" src={src} onTimeUpdate={alAvanzar}>
        Tu navegador no soporta la reproducción de este video.
      </video>
    </div>
  );
}
