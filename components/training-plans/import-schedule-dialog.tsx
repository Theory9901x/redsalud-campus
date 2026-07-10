"use client";

import { useActionState, useState } from "react";
import { FileSpreadsheet, Download, Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { BulkImportFormState } from "@/app/admin/planes-capacitacion/actions";

const initialState: BulkImportFormState = { error: null };

export function ImportScheduleDialog({
  action,
}: {
  action: (prevState: BulkImportFormState, formData: FormData) => Promise<BulkImportFormState>;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" className="gap-1.5" />}>
        <FileSpreadsheet className="h-4 w-4" />
        Importar desde Excel
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar cronograma desde Excel</DialogTitle>
          <DialogDescription>
            Descarga la plantilla, complétala con las actividades y súbela. Complementa "Agregar actividad": las
            filas válidas se crean como actividades en borrador, igual que si las agregaras una por una.
          </DialogDescription>
        </DialogHeader>

        <a
          href="/api/planes-capacitacion/plantilla-cronograma"
          className="inline-flex w-fit items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <Download className="h-4 w-4" />
          Descargar plantilla (.xlsx)
        </a>

        <form action={formAction} className="flex flex-col gap-3">
          <input
            type="file"
            name="file"
            accept=".xlsx"
            required
            className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none file:mr-3 file:h-full file:rounded-md file:border-0 file:bg-secondary file:px-3 file:text-sm file:font-medium file:text-secondary-foreground"
          />
          <Button type="submit" disabled={pending} className="w-fit gap-1.5">
            <Upload className="h-4 w-4" />
            {pending ? "Importando..." : "Importar"}
          </Button>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          {state.createdCount !== undefined && (
            <div className="space-y-2 rounded-lg border border-border p-3">
              <p className="flex items-center gap-1.5 text-sm font-medium text-success">
                <CheckCircle2 className="h-4 w-4" />
                {state.createdCount} {state.createdCount === 1 ? "actividad creada" : "actividades creadas"}
              </p>
              {state.rowErrors && state.rowErrors.length > 0 && (
                <div className="space-y-1">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    {state.rowErrors.length} {state.rowErrors.length === 1 ? "fila con error" : "filas con error"}
                  </p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {state.rowErrors.map((rowError) => (
                      <li key={rowError.row}>
                        Fila {rowError.row}: {rowError.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </form>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
