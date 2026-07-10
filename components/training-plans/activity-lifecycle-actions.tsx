"use client";

import { Lock, PlayCircle } from "lucide-react";
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
  onEnable,
  onClose,
}: {
  status: TrainingActivityStatus;
  /** Ya formateado en el servidor: formatear un Date aquí (cliente) puede divergir del ICU del servidor en la hidratación. */
  closedAtLabel: string | null;
  onEnable: () => Promise<void>;
  onClose: () => Promise<void>;
}) {
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
              evaluación ni se admitirán más registros de asistencia. Los indicadores quedan definitivos y el
              personal que no respondió se registra nominalmente para seguimiento de RRHH. Esta acción no se puede
              revertir.
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
    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <Lock className="h-3.5 w-3.5" />
      Jornada cerrada{closedAtLabel ? ` · ${closedAtLabel}` : ""}
    </span>
  );
}
