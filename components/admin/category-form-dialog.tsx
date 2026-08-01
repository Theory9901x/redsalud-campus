"use client";

import { useActionState, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CategoryFormState } from "@/app/admin/cursos/categorias/actions";
import { useAlTenerExito } from "@/lib/use-exito-accion";

const initialState: CategoryFormState = { error: null };

export function CategoryFormDialog({
  mode,
  action,
  defaultValues,
}: {
  mode: "create" | "edit";
  action: (prevState: CategoryFormState, formData: FormData) => Promise<CategoryFormState>;
  defaultValues?: { name: string; description: string };
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, initialState);

  // Cierra el diálogo cuando el envío acaba de terminar bien.
  useAlTenerExito(state, () => setOpen(false));

  return (
    <>
      {mode === "create" ? (
        <Button onClick={() => setOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          Nueva categoría
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)} variant="outline" size="sm">
          <Pencil className="h-4 w-4" />
          Editar
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === "create" ? "Nueva categoría" : "Editar categoría"}</DialogTitle>
            <DialogDescription>
              Las categorías organizan el catálogo público de cursos.
            </DialogDescription>
          </DialogHeader>
          <form action={formAction} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" required defaultValue={defaultValues?.name} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Descripción</Label>
              <Textarea id="description" name="description" defaultValue={defaultValues?.description} />
            </div>
            {state.error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Guardando..." : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
