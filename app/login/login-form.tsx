"use client";

import { useActionState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="surface relative w-full max-w-sm overflow-hidden rounded-3xl p-8"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(43,166,222,0.10),transparent_55%)]" />

      <div className="relative space-y-6">
        <div className="flex items-center gap-2 lg:hidden">
          <Activity className="h-6 w-6 text-primary" strokeWidth={2.5} />
          <span className="font-display text-lg font-extrabold text-foreground">RedSalud Forma</span>
        </div>

        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground">
            Inicia sesión
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ingresa con tu correo institucional o el que usaste al registrarte.
          </p>
        </div>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />

          <div className="space-y-1.5">
            <Label htmlFor="email">Correo electrónico</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="nombre@redsaludcasanare.gov.co"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
            />
          </div>

          {state.error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-primary to-teal-400 text-white transition-transform hover:opacity-90 active:scale-[0.98]"
            disabled={pending}
          >
            {pending ? "Ingresando..." : "Iniciar sesión"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          ¿No tienes cuenta?{" "}
          <Link href="/registro" className="font-medium text-primary hover:underline">
            Regístrate aquí
          </Link>
        </p>
      </div>
    </motion.div>
  );
}
