"use client";

import { useActionState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerAction, type RegisterState } from "./actions";

const initialState: RegisterState = { error: null };

const DOCUMENT_TYPES = [
  { value: "CC", label: "Cédula de ciudadanía" },
  { value: "CE", label: "Cédula de extranjería" },
  { value: "TI", label: "Tarjeta de identidad" },
  { value: "PA", label: "Pasaporte" },
];

export function RegisterForm({ municipios }: { municipios: { id: string; nombre: string }[] }) {
  const [state, formAction, pending] = useActionState(registerAction, initialState);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="surface relative w-full max-w-md overflow-hidden rounded-3xl p-8"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(43,166,222,0.10),transparent_55%)]" />

      <div className="relative space-y-6">
      <div className="flex items-center gap-2 lg:hidden">
        <Activity className="h-6 w-6 text-primary" strokeWidth={2.5} />
        <span className="font-display text-lg font-extrabold text-foreground">RedSalud Te Forma</span>
      </div>

      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground">
          Crea tu cuenta
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Regístrate como estudiante para acceder a los cursos institucionales.
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="fullName">Nombre completo</Label>
          <Input id="fullName" name="fullName" required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="documentType">Tipo de documento</Label>
            <select
              id="documentType"
              name="documentType"
              defaultValue="CC"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {DOCUMENT_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="documentNumber">Número de documento</Label>
            <Input id="documentNumber" name="documentNumber" required />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Teléfono (opcional)</Label>
            <Input id="phone" name="phone" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profession">Profesión (opcional)</Label>
            <Input id="profession" name="profession" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="position">Cargo (opcional)</Label>
            <Input id="position" name="position" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="personnelType">Tipo de personal</Label>
            <select
              id="personnelType"
              name="personnelType"
              required
              defaultValue="ADMINISTRATIVO"
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="ADMINISTRATIVO">Administrativo</option>
              <option value="ASISTENCIAL">Asistencial</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="municipioId">Municipio</Label>
            <select
              id="municipioId"
              name="municipioId"
              required
              defaultValue=""
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="" disabled>
                Selecciona tu municipio
              </option>
              {municipios.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
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

        <Button
          type="submit"
          className="w-full bg-gradient-to-r from-primary to-teal-400 text-white transition-transform hover:opacity-90 active:scale-[0.98]"
          disabled={pending}
        >
          {pending ? "Creando cuenta..." : "Crear cuenta"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Inicia sesión
        </Link>
      </p>
      </div>
    </motion.div>
  );
}
