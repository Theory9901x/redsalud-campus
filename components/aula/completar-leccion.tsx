"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markLessonCompleteAction } from "@/app/aula/[courseId]/actions";
import { ReproductorVideo } from "@/components/aula/reproductor-video";
import type { LessonContentType } from "@prisma/client";

/**
 * Segundos mínimos en pantalla antes de poder dar por leído un documento.
 * No pretende medir comprensión —eso lo mide la evaluación—, solo evitar el
 * clic reflejo en «completada» sin haber abierto siquiera el PDF.
 */
const SEGUNDOS_MINIMOS_LECTURA = 30;

type Estado = "inactivo" | "guardando" | "error";

/**
 * Marcado de completitud de una lección, por tipo de contenido:
 *
 *  - Video subido: automático al 90 % de reproducción (ver ReproductorVideo).
 *  - PDF e imagen: el botón se habilita tras un tiempo mínimo en pantalla.
 *  - Texto, enlace y YouTube: acción explícita del estudiante.
 *
 * YouTube queda en acción explícita a propósito: saber cuánto se ha visto de
 * un iframe de YouTube exige cargar su API externa, y no vale la pena meter
 * un script de terceros en el aula por eso.
 *
 * El guardado NUNCA se da por hecho en el cliente: si la petición falla, la
 * lección sigue sin completar y el botón ofrece reintentar. Marcarla en
 * pantalla y perderla en el servidor es peor que no marcarla.
 */
export function CompletarLeccion({
  courseId,
  lessonId,
  contentType,
  fileUrl,
  yaCompletada,
  posicionInicial,
}: {
  courseId: string;
  lessonId: string;
  contentType: LessonContentType;
  fileUrl: string | null;
  yaCompletada: boolean;
  posicionInicial: number | null;
}) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>("inactivo");
  const [completada, setCompletada] = useState(yaCompletada);
  const [segundos, setSegundos] = useState(0);
  const enCurso = useRef(false);

  const esLectura = contentType === "PDF" || contentType === "IMAGE";
  const esVideoArchivo = contentType === "VIDEO" && Boolean(fileUrl);

  // Cronómetro de permanencia, solo para documentos y solo si falta marcarla.
  useEffect(() => {
    if (!esLectura || completada) return;
    const id = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [esLectura, completada]);

  async function completar() {
    // Guarda contra el doble clic y contra el reintento que se solapa con la
    // petición que aún está en vuelo.
    if (enCurso.current || completada) return;
    enCurso.current = true;
    setEstado("guardando");
    try {
      const { certificateId } = await markLessonCompleteAction(courseId, lessonId);
      setCompletada(true);
      setEstado("inactivo");
      if (certificateId) {
        router.push(`/mi-aula/certificados/${certificateId}?justIssued=1`);
      } else {
        // Refresca el carril de contenido: el contador del módulo y el anillo
        // de progreso se calculan en el servidor.
        router.refresh();
      }
    } catch {
      setEstado("error");
      toast.error("No se pudo guardar tu avance. Revisa la conexión y reintenta.");
    } finally {
      enCurso.current = false;
    }
  }

  const faltan = Math.max(0, SEGUNDOS_MINIMOS_LECTURA - segundos);
  const bloqueadoPorTiempo = esLectura && !completada && faltan > 0;

  return (
    <div className="space-y-4">
      {esVideoArchivo && (
        <ReproductorVideo
          courseId={courseId}
          lessonId={lessonId}
          src={fileUrl!}
          posicionInicial={posicionInicial}
          yaCompletada={completada}
          onCompletar={completar}
        />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          onClick={completar}
          disabled={completada || estado === "guardando" || bloqueadoPorTiempo}
          className="gap-1.5"
        >
          {estado === "guardando" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : estado === "error" ? (
            <RotateCcw className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          {completada
            ? "Completada"
            : estado === "guardando"
              ? "Guardando…"
              : estado === "error"
                ? "Reintentar"
                : "Marcar como completada"}
        </Button>

        {/* Deshabilitado sin explicación es una pared. Aquí se dice por qué. */}
        {bloqueadoPorTiempo && (
          <p className="text-xs text-muted-foreground">
            Disponible en {faltan} {faltan === 1 ? "segundo" : "segundos"}: tómate un momento para revisar el
            documento.
          </p>
        )}
        {esVideoArchivo && !completada && (
          <p className="text-xs text-muted-foreground">
            Se marca sola cuando llegues al 90 % del video.
          </p>
        )}
        {estado === "error" && (
          <p className="text-xs text-destructive">Tu avance no se guardó. Vuelve a intentarlo.</p>
        )}
      </div>
    </div>
  );
}
