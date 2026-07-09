"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, LogIn, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotHelp, setShowForgotHelp] = useState(false);

  return (
    <div className="surface surface-accent-top relative w-full max-w-sm animate-in fade-in slide-in-from-bottom-4 rounded-3xl p-8 shadow-xl duration-700">
      <div className="pointer-events-none absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_15%_0%,rgba(43,166,222,0.10),transparent_55%)]" />

      <div className="relative space-y-6">
        <div className="text-center">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            Iniciar sesión
          </h1>
          <p className="mt-1.5 text-base text-muted-foreground">
            Accede a tus cursos, evaluaciones y certificados.
          </p>
        </div>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />

          <div className="space-y-1.5">
            <Label htmlFor="email">Correo electrónico</Label>
            <div className="group relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="nombre@redsaludcasanare.gov.co"
                className="h-11 rounded-xl pl-10 transition-shadow focus-visible:shadow-md"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Contraseña</Label>
              <button
                type="button"
                onClick={() => setShowForgotHelp((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
            <div className="group relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                placeholder="••••••••"
                className="h-11 rounded-xl px-10 transition-shadow focus-visible:shadow-md"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {showForgotHelp && (
              <p className="flex items-start gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs text-foreground/80 animate-in fade-in slide-in-from-top-1 duration-300">
                <HelpCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                Contacta al administrador de la plataforma para restablecer tu contraseña.
              </p>
            )}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <Checkbox name="remember" defaultChecked />
            Recordarme
          </label>

          {state.error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive animate-in fade-in slide-in-from-top-1 duration-300">
              {state.error}
            </p>
          )}

          <Button
            type="submit"
            disabled={pending}
            className={cn(
              // El Button base ya trae transition-all + la firma de movimiento
              // (duration-(--duration-signature-fast)/ease-(--ease-signature));
              // repetir "duration-300" acá la pisaba en silencio (tailwind-merge
              // resuelve el conflicto quedándose con el último de la cadena).
              "h-11 w-full gap-2 rounded-xl bg-gradient-to-r from-primary to-success text-white shadow-md",
              "hover:-translate-y-0.5 hover:shadow-lg hover:opacity-95 active:translate-y-0 active:scale-[0.98]"
            )}
          >
            {pending ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Ingresando...
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                Iniciar sesión
              </>
            )}
          </Button>
        </form>

        <div className="space-y-2 text-center text-sm text-muted-foreground">
          <p>
            ¿No tienes cuenta?{" "}
            <Link href="/registro" className="font-medium text-primary hover:underline">
              Regístrate aquí
            </Link>
          </p>
          <p className="text-xs text-muted-foreground/70">
            ¿Necesitas ayuda? Contacta a Talento Humano de Red Salud Casanare E.S.E.
          </p>
        </div>
      </div>
    </div>
  );
}
