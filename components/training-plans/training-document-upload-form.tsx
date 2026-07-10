"use client";

import { useActionState } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TrainingDocumentFormState } from "@/app/admin/planes-capacitacion/actions";

const initialState: TrainingDocumentFormState = { error: null };

export function TrainingDocumentUploadForm({
  action,
}: {
  action: (prevState: TrainingDocumentFormState, formData: FormData) => Promise<TrainingDocumentFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <input
        type="file"
        name="file"
        required
        className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none file:mr-3 file:h-full file:rounded-md file:border-0 file:bg-secondary file:px-3 file:text-sm file:font-medium file:text-secondary-foreground"
      />
      <Button type="submit" disabled={pending} className="gap-1.5">
        <Upload className="h-4 w-4" />
        {pending ? "Subiendo..." : "Subir documento"}
      </Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
