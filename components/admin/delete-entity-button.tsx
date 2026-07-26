"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
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

/**
 * Botón de eliminar reutilizable para cualquier módulo del panel.
 *
 * La acción devuelve `{ error }` en vez de lanzar: cuando el borrado se bloquea
 * —porque perdería historia (certificados, asistencias, etc.)— el servidor
 * explica por qué y aquí se muestra como aviso, en lugar de romper la pantalla.
 */
export function DeleteEntityButton({
  action,
  nombre,
  titulo,
  descripcion,
  etiquetaBoton = "Eliminar definitivamente",
  size = "icon-sm",
}: {
  action: () => Promise<{ error: string | null }>;
  /** Qué se elimina, para el aviso de éxito. */
  nombre: string;
  titulo?: string;
  descripcion: string;
  etiquetaBoton?: string;
  size?: "icon-sm" | "sm";
}) {
  const [pending, startTransition] = useTransition();

  function confirmar() {
    startTransition(async () => {
      const res = await action();
      if (res.error) toast.error(res.error);
      else toast.success(`${nombre} se eliminó.`);
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size={size}
            disabled={pending}
            title="Eliminar"
            aria-label="Eliminar"
            className="gap-1.5 text-destructive hover:bg-destructive/10"
          />
        }
      >
        <Trash2 className="h-4 w-4" />
        {size === "sm" && "Eliminar"}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo ?? `¿Eliminar ${nombre}?`}</AlertDialogTitle>
          <AlertDialogDescription>{descripcion}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmar}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {etiquetaBoton}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
