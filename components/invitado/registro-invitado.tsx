"use client";

import { useActionState } from "react";
import { UserPlus, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RegistroInvitadoState } from "@/app/invitado/[activityId]/actions";

const INICIAL: RegistroInvitadoState = { error: null };

/**
 * El registro BREVE del invitado externo: nombre y empresa, nada más. Sin
 * contraseña ni cuenta -la decisión institucional es mantener a los externos
 * fuera del login-; este registro es a la vez su acceso y su constancia de
 * asistencia externa a la jornada.
 */
export function RegistroInvitado({
  action,
  titulo,
}: {
  action: (state: RegistroInvitadoState, formData: FormData) => Promise<RegistroInvitadoState>;
  titulo: string;
}) {
  const [state, formAction, pendiente] = useActionState(action, INICIAL);

  return (
    <div className="surface-glass surface-accent-top mx-auto w-full max-w-md p-8">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
        Acceso para invitados externos
      </span>
      <h1 className="mt-3 font-display text-xl font-extrabold leading-snug text-foreground">{titulo}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Regístrate para entrar a la jornada. Solo necesitas tu nombre y la empresa o entidad de la que vienes: con
        eso quedas en la lista de asistencia y puedes ver la reunión y presentar la evaluación.
      </p>

      <form action={formAction} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Nombre completo</Label>
          <div className="relative">
            <UserPlus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="fullName" name="fullName" required placeholder="Ej. María Fernanda Gutiérrez" className="pl-9" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="company">Empresa o entidad</Label>
          <div className="relative">
            <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="company" name="company" required placeholder="Ej. IPS Salud Total" className="pl-9" />
          </div>
        </div>

        {state.error && <p className="text-sm text-destructive">{state.error}</p>}

        <Button type="submit" disabled={pendiente} className="w-full">
          {pendiente ? "Registrando…" : "Entrar a la jornada"}
        </Button>
      </form>
    </div>
  );
}
