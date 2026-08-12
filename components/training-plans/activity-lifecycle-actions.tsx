"use client";

import { useTransition } from "react";
import { Eye, EyeOff, Loader2, Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { TrainingActivityStatus } from "@prisma/client";

export function ActivityLifecycleActions({
  status,
  closedAtLabel,
  puedeReabrir,
  fichaCompleta,
  onClose,
  onReopen,
  onHide,
  onShow,
}: {
  status: TrainingActivityStatus;
  /** Ya formateado en el servidor: formatear un Date aquí (cliente) puede divergir del ICU del servidor en la hidratación. */
  closedAtLabel: string | null;
  /** Solo el administrador puede deshacer un cierre. */
  puedeReabrir: boolean;
  /** Si la ficha tiene lo mínimo para publicarse (título y trimestre o fecha). */
  fichaCompleta: boolean;
  onClose: () => Promise<void>;
  onReopen: () => Promise<{ error: string | null }>;
  onHide: () => Promise<{ error: string | null }>;
  onShow: () => Promise<{ error: string | null }>;
}) {
  const [reabriendo, iniciarReapertura] = useTransition();
  const [cambiandoVisibilidad, iniciarVisibilidad] = useTransition();

  // BORRADOR ya no es una aprobación pendiente: o la ficha está incompleta, o
  // alguien la retiró de la vista a propósito. En ambos casos lo útil es
  // decir cuál de las dos cosas es, no ofrecer un botón de "abrir".
  if (status === "DRAFT") {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
          {fichaCompleta ? "Retirada de la vista" : "Ficha incompleta"}
        </span>
        {fichaCompleta ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={cambiandoVisibilidad}
            onClick={() =>
              iniciarVisibilidad(async () => {
                const r = await onShow();
                if (r.error) toast.error(r.error);
                else toast.success("La capacitación vuelve a aparecer en el cronograma del personal.");
              })
            }
          >
            {cambiandoVisibilidad ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
            Volver a mostrar
          </Button>
        ) : (
          <span className="max-w-[260px] text-right text-[11px] leading-snug text-muted-foreground">
            Se publica sola en cuanto tenga título y el trimestre o la fecha en que se dicta.
          </span>
        )}
      </div>
    );
  }

  if (status === "OPEN") {
    return (
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="gap-1.5 text-muted-foreground"
          disabled={cambiandoVisibilidad}
          onClick={() =>
            iniciarVisibilidad(async () => {
              const r = await onHide();
              if (r.error) toast.error(r.error);
              else toast.success("Retirada de la vista. Deja de aparecer en el cronograma del personal.");
            })
          }
        >
          {cambiandoVisibilidad ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <EyeOff className="h-3.5 w-3.5" />}
          Ocultar
        </Button>
      <AlertDialog>
        <AlertDialogTrigger render={<Button type="button" size="sm" variant="destructive" className="gap-1.5" />}>
          <Lock className="h-4 w-4" />
          Cerrar jornada
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar esta jornada?</AlertDialogTitle>
            <AlertDialogDescription>
              Desde este momento la participación queda congelada: los estudiantes ya no podrán responder la
              evaluación ni se admitirán más registros de asistencia. Los indicadores quedan definitivos, el informe
              se guarda tal como está en este momento y el personal que no respondió se registra nominalmente para
              seguimiento de RRHH. Si te equivocas, solo un administrador puede reabrirla.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onClose()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cerrar jornada
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Lock className="h-3.5 w-3.5" />
        Jornada cerrada{closedAtLabel ? ` · ${closedAtLabel}` : ""}
      </span>

      {puedeReabrir && (
        <AlertDialog>
          <AlertDialogTrigger render={<Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={reabriendo} />}>
            {reabriendo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlock className="h-3.5 w-3.5" />}
            Reabrir jornada
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Reabrir esta jornada?</AlertDialogTitle>
              <AlertDialogDescription>
                La jornada vuelve a admitir participación: los estudiantes podrán presentar la evaluación y se
                seguirá registrando asistencia. El informe que quedó guardado al cerrarla se descarta y las cifras
                vuelven a calcularse en vivo; lo que decía queda anotado en la bitácora. Cuando termines, vuelve a
                cerrarla para que el informe quede definitivo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  iniciarReapertura(async () => {
                    const r = await onReopen();
                    if (r.error) toast.error(r.error);
                    else toast.success("Jornada reabierta. Recuerda cerrarla de nuevo al terminar.");
                  })
                }
              >
                Reabrir jornada
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
