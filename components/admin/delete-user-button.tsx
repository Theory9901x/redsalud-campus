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
import { deleteUserAction } from "@/app/admin/usuarios/actions";

/**
 * Elimina definitivamente a un usuario. Si la operación se bloquea (la persona
 * tiene historia que se perdería) el servidor devuelve un mensaje y aquí se
 * muestra como aviso, en vez de borrar en silencio o romper.
 */
export function DeleteUserButton({ userId, userName }: { userId: string; userName: string }) {
  const [pending, startTransition] = useTransition();

  function confirmar() {
    startTransition(async () => {
      const res = await deleteUserAction(userId);
      if (res.error) toast.error(res.error);
      else toast.success(`${userName} fue eliminado.`);
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            title="Eliminar usuario"
            aria-label="Eliminar usuario"
            className="text-destructive hover:bg-destructive/10"
          />
        }
      >
        <Trash2 className="h-4 w-4" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar a {userName}?</AlertDialogTitle>
          <AlertDialogDescription>
            Se elimina la cuenta de forma definitiva, junto con sus inscripciones y su progreso. Esta acción no se
            puede deshacer. Si solo quieres quitarle el acceso —por rotación de personal— usa <strong>Desactivar</strong>,
            que conserva su historia.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmar}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Eliminar definitivamente
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
