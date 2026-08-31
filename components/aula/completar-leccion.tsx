"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { markLessonCompleteAction } from "@/app/aula/[courseId]/actions";
import { ReproductorVideo } from "@/components/aula/reproductor-video";
import type { LessonContentType } from "@prisma/client";

type Estado = "inactivo" | "guardando" | "error";

/**
 * Marcado de completitud de una lección.
 *
 * El botón está disponible DESDE EL PRIMER MOMENTO, sea cual sea el tipo de
 * contenido. Antes los documentos exigían medio minuto en pantalla antes de
 * habilitarse; la espera no medía nada -abrir el PDF y no leerlo cuesta lo
 * mismo- y sí estorbaba a quien ya conocía el material o volvía a repasarlo.
 *
 * El video subido además se marca solo al llegar al 90 % de reproducción,
 * pero eso es una comodidad, no una condición: se puede marcar antes.
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
  const enCurso = useRef(false);

  const esVideoArchivo = contentType === "VIDEO" && Boolean(fileUrl);

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

  return (
    <div className="space-y-4">
      {esVideoArchivo && (
        <div className="player-shell">
        <ReproductorVideo
          courseId={courseId}
          lessonId={lessonId}
          src={fileUrl!}
          posicionInicial={posicionInicial}
          yaCompletada={completada}
          onCompletar={completar}
        />
        </div>
      )}

      <div className={esVideoArchivo ? "flex flex-col items-center gap-2" : "flex flex-col items-center gap-2 sm:items-stretch"}>
        <button
          type="button"
          onClick={completar}
          disabled={completada || estado === "guardando"}
          data-completada={completada}
          className="btn-cta-leccion w-full sm:w-auto sm:min-w-[280px]"
        >
          <span className="flex items-center gap-2.5">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/20">
              {estado === "guardando" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : estado === "error" ? (
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              )}
            </span>
            {completada
              ? "Lección completada"
              : estado === "guardando"
                ? "Guardando…"
                : estado === "error"
                  ? "Reintentar"
                  : "Marcar como completada"}
          </span>
          <span className="micro">
            {completada ? "Registrada en tu avance" : "Avanza en tu aprendizaje"}
          </span>
        </button>

        {esVideoArchivo && !completada && (
          <p className="text-xs text-muted-foreground">
            También se marca sola al llegar al 90 % del video.
          </p>
        )}
        {estado === "error" && (
          <p className="text-xs text-destructive">Tu avance no se guardó. Vuelve a intentarlo.</p>
        )}
      </div>
    </div>
  );
}
