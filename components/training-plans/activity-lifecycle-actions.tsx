"use client";

import { useTransition } from "react";
import { Loader2, Lock, PlayCircle, Unlock } from "lucide-react";
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
  onEnable,
  onClose,
  onReopen,
}: {
  status: TrainingActivityStatus;
  /** Ya formateado en el servidor: formatear un Date aquí (cliente) puede divergir del ICU del servidor en la hidratación. */
  closedAtLabel: string | null;
  /** Solo el administrador puede deshacer un cierre. */
  puedeReabrir: boolean;
  onEnable: () => Promise<void>;
  onClose: () => Promise<void>;
  onReopen: () => Promise<{ error: string | null }>;
}) {
  const [reabriendo, iniciarReapertura] = useTransition();

  if (status === "DRAFT") {
    return (
      <form action={onEnable}>
        <Button type="submit" size="sm" className="gap-1.5">
          <PlayCircle className="h-4 w-4" />
          Habilitar jornada
        </Button>
      </form>
    );
  }

  if (status === "OPEN") {
    return (
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
