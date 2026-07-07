"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePasswordAction, type ChangePasswordState } from "@/app/(estudiante)/perfil/actions";

const initialState: ChangePasswordState = { error: null };

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialState);

  useEffect(() => {
    if (state.success) {
      const form = document.getElementById("change-password-form") as HTMLFormElement | null;
      form?.reset();
    }
  }, [state]);

  return (
    <form id="change-password-form" action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="currentPassword">Contraseña actual</Label>
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="newPassword">Nueva contraseña</Label>
          <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={8} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirmNewPassword">Confirmar nueva contraseña</Label>
          <Input
            id="confirmNewPassword"
            name="confirmNewPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </div>
      </div>

      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">Contraseña actualizada.</p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Guardando..." : "Cambiar contraseña"}
      </Button>
    </form>
  );
}
