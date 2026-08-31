"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { PanelEnLinea, PieFormulario } from "@/components/cursos/panel-en-linea";
import { COURSE_AUDIENCE_LABELS } from "@/components/cursos/labels";
import type { CourseAudience } from "@prisma/client";
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
  defaultValues?: { title: string; description: string; isRequired: boolean; audience?: CourseAudience };
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="mod-audience">Dirigido a</Label>
                <select
                  id="mod-audience"
                  name="audience"
                  defaultValue={defaultValues?.audience ?? "AMBOS"}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  {Object.entries(COURSE_AUDIENCE_LABELS).map(([valor, etiqueta]) => (
                    <option key={valor} value={valor}>
                      {etiqueta}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Solo el grupo elegido ve este módulo en el aula y el catálogo.
                </p>
              </div>
              <div className="flex items-end gap-3 pb-1.5">
                <Switch id="mod-isRequired" name="isRequired" defaultChecked={defaultValues?.isRequired ?? true} />
                <Label htmlFor="mod-isRequired" className="font-normal">
                  Obligatorio
                </Label>
              </div>
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
