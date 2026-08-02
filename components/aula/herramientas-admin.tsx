"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Loader2, RotateCcw, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { completarMiCursoAction, reiniciarMiCursoAction } from "@/app/aula/[courseId]/acciones-prueba";

type Accion = "reiniciar" | "completar";

const TEXTOS: Record<Accion, { titulo: string; descripcion: string; boton: string }> = {
  reiniciar: {
    titulo: "¿Reiniciar tu avance en este curso?",
    descripcion:
      "Se borrará TU progreso: lecciones vistas, intentos de evaluación y el certificado si lo tienes. Vuelves al principio, con el desbloqueo secuencial desde cero. No afecta al avance de ninguna otra persona.",
    boton: "Sí, reiniciar",
  },
  completar: {
    titulo: "¿Dar el curso por completado?",
    descripcion:
      "Se marcarán todas TUS lecciones como vistas y todas las evaluaciones como aprobadas, para llegar al certificado sin recorrer el curso entero. No afecta al avance de ninguna otra persona.",
    boton: "Sí, completar",
  },
};

/**
 * Atajos de prueba del administrador dentro del aula.
 *
 * Están aquí y no en el panel de gestión porque es aquí donde se prueba: se
 * recorre el curso como estudiante y se necesita volver al principio o saltar
 * al final sin salir de la vista.
 *
 * El aviso de que son herramientas de prueba es parte del diseño: quien las
 * ve tiene que entender de un vistazo que no son funciones del curso, y que
 * lo que tocan es su propio expediente.
 */
export function HerramientasAdmin({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState<Accion | null>(null);
  const [pendiente, iniciar] = useTransition();

  function ejecutar(accion: Accion) {
    iniciar(async () => {
      const r = accion === "reiniciar"
        ? await reiniciarMiCursoAction(courseId)
        : await completarMiCursoAction(courseId);

      setAbierto(null);

      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(r.mensaje ?? "Listo.");

      // Al completar se va derecho al certificado: es justo el momento que se
      // quiere comprobar.
      if (r.certificateId) router.push(`/mi-aula/certificados/${r.certificateId}?justIssued=1`);
      else router.push(`/aula/${courseId}`);
      router.refresh();
    });
  }

  return (
    <>
      <div className="surface-inset space-y-2.5 p-3">
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
          Pruebas de administrador
        </p>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Solo afectan a tu propio avance. Nadie más lo nota.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pendiente}
            onClick={() => setAbierto("reiniciar")}
            className="gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reiniciar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pendiente}
            onClick={() => setAbierto("completar")}
            className="gap-1.5"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Completar
          </Button>
        </div>
      </div>

      <Dialog open={abierto !== null} onOpenChange={(v) => !v && setAbierto(null)}>
        <DialogContent className="sm:max-w-md">
          {abierto && (
            <>
              <DialogHeader>
                <DialogTitle>{TEXTOS[abierto].titulo}</DialogTitle>
                <DialogDescription>{TEXTOS[abierto].descripcion}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAbierto(null)} disabled={pendiente}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  variant={abierto === "reiniciar" ? "destructive" : "default"}
                  onClick={() => ejecutar(abierto)}
                  disabled={pendiente}
                  className="gap-1.5"
                >
                  {pendiente && <Loader2 className="h-4 w-4 animate-spin" />}
                  {pendiente ? "Aplicando…" : TEXTOS[abierto].boton}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
