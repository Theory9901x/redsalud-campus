"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cambiarContrasenaObligatoriaAction, type EstadoCambio } from "./actions";

const INICIAL: EstadoCambio = { error: null };

export function FormularioCambioObligatorio({ destino }: { destino: string }) {
  const router = useRouter();
  const [estado, accion, pendiente] = useActionState(cambiarContrasenaObligatoriaAction, INICIAL);

  useEffect(() => {
    if (!estado.exito) return;
    // La sesión se renovó dentro de la acción; hay que recargarla para que el
    // proxy vea la marca ya levantada y deje pasar.
    router.replace(destino);
    router.refresh();
  }, [estado.exito, destino, router]);

  return (
    <div className="w-full max-w-md space-y-6">
      <div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Primer ingreso
        </span>
        <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-foreground">
          Cambia tu contraseña
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
          Estás usando la contraseña temporal que te entregaron. Define una propia para continuar; nadie más
          debería conocerla.
        </p>
      </div>

      <form action={accion} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="currentPassword">Contraseña temporal</Label>
          <div className="group relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              className="pl-9"
              required
              autoFocus
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="newPassword">Nueva contraseña</Label>
          <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={8} />
          <p className="text-xs text-muted-foreground">Mínimo 8 caracteres.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmNewPassword">Confirma la nueva contraseña</Label>
          <Input
            id="confirmNewPassword"
            name="confirmNewPassword"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
          />
        </div>

        {estado.error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {estado.error}
          </p>
        )}

        <Button type="submit" disabled={pendiente} className="w-full gap-2">
          {pendiente && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {pendiente ? "Guardando…" : "Guardar y continuar"}
        </Button>
      </form>
    </div>
  );
}
