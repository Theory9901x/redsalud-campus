"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { PanelEnLinea, PieFormulario } from "@/components/cursos/panel-en-linea";
import type { ModuleFormState } from "@/app/admin/cursos/module-actions";
import { useAlTenerExito } from "@/lib/use-exito-accion";

const initialState: ModuleFormState = { error: null };

/**
 * Formulario de módulo EN LÍNEA (el nombre "Dialog" es histórico: ya no es
 * un diálogo flotante, se despliega debajo del disparador, dentro del temario).
 */
export function ModuleFormDialog({
  mode,
  action,
  defaultValues,
  trigger,
}: {
  mode: "create" | "edit";
  action: (prevState: ModuleFormState, formData: FormData) => Promise<ModuleFormState>;
  defaultValues?: { title: string; description: string; isRequired: boolean };
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, initialState);

  // Cierra el panel cuando el envío acaba de terminar bien.
  useAlTenerExito(state, () => setOpen(false));

  return (
    <>
      <span onClick={() => setOpen((v) => !v)}>{trigger}</span>
      {open && (
        <PanelEnLinea
          titulo={mode === "create" ? "Nuevo módulo" : "Editar módulo"}
          descripcion="Los módulos agrupan las lecciones del curso."
          onCerrar={() => setOpen(false)}
        >
          <form action={formAction} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="mod-title">Título</Label>
              <Input id="mod-title" name="title" required defaultValue={defaultValues?.title} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mod-description">Descripción</Label>
              <Textarea id="mod-description" name="description" rows={2} defaultValue={defaultValues?.description} />
            </div>
            <div className="flex items-center gap-3">
              <Switch id="mod-isRequired" name="isRequired" defaultChecked={defaultValues?.isRequired ?? true} />
              <Label htmlFor="mod-isRequired" className="font-normal">
                Obligatorio
              </Label>
            </div>
            {state.error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
            )}
            <PieFormulario pending={pending} etiqueta="Guardar módulo" onCancelar={() => setOpen(false)} />
          </form>
        </PanelEnLinea>
      )}
    </>
  );
}
