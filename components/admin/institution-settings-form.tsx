"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  updateInstitutionSettingsAction,
  type SettingsFormState,
} from "@/app/admin/configuracion/actions";

const initialState: SettingsFormState = { error: null };

export function InstitutionSettingsForm({
  defaultValues,
}: {
  defaultValues: {
    institutionName: string;
    contactEmail: string;
    contactPhone: string;
    city: string;
    certificateText: string;
    signerName: string;
    signerPosition: string;
  };
}) {
  const [state, formAction, pending] = useActionState(updateInstitutionSettingsAction, initialState);

  return (
    <form action={formAction} className="surface space-y-4 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="institutionName">Nombre de la institución</Label>
          <Input id="institutionName" name="institutionName" required defaultValue={defaultValues.institutionName} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city">Ciudad (aparece en el certificado)</Label>
          <Input id="city" name="city" required defaultValue={defaultValues.city} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactEmail">Correo de contacto</Label>
          <Input id="contactEmail" name="contactEmail" type="email" defaultValue={defaultValues.contactEmail} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactPhone">Teléfono de contacto</Label>
          <Input id="contactPhone" name="contactPhone" defaultValue={defaultValues.contactPhone} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="signerName">Nombre del responsable que certifica</Label>
          <Input id="signerName" name="signerName" defaultValue={defaultValues.signerName} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="signerPosition">Cargo del responsable</Label>
          <Input id="signerPosition" name="signerPosition" defaultValue={defaultValues.signerPosition} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="certificateText">Texto adicional del certificado (opcional)</Label>
        <Textarea
          id="certificateText"
          name="certificateText"
          rows={3}
          placeholder="Ej: nota legal o de vigencia que aparece debajo del curso en el PDF."
          defaultValue={defaultValues.certificateText}
        />
      </div>

      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">Configuración guardada.</p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Guardando..." : "Guardar configuración"}
      </Button>
    </form>
  );
}
