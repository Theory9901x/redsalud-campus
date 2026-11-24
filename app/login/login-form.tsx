"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, KeyRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [showPassword, setShowPassword] = useState(false);

  // Enlaces de capacitación (/c/...): navegación completa, no interna.
  useEffect(() => {
    if (state.irA) window.location.assign(state.irA);
  }, [state.irA]);

  return (
    <div className="relative w-full animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="relative space-y-8">
        <div>
          <p className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-[13px] font-semibold text-[color-mix(in_oklch,var(--primary)_62%,var(--foreground))]">
            <ShieldCheck className="h-4 w-4" strokeWidth={2.25} />
            Acceso seguro
          </p>
          <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-foreground">
            Accede a tu espacio
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
            Continúa tu formación institucional desde una plataforma segura y unificada.
          </p>
        </div>

        <form action={formAction} className="space-y-5">
          <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />

          <div className="space-y-1.5">
            <Label htmlFor="email">Correo o usuario</Label>
            <div className="group relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
              {/* type="text" y no "email": el personal sin correo propio entra
                  con un usuario "nombre.apellido", que el navegador rechazaría
                  como correo inválido. */}
              <Input
                id="email"
                name="email"
                type="text"
                autoComplete="username"
                required
                placeholder="nombre@redsaludcasanare.gov.co o nombre.apellido"
                className="auth-campo pl-10"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Contraseña</Label>
              <Link href="/recuperar" className="text-xs font-medium text-primary hover:underline">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <div className="group relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                placeholder="Ingresa tu contraseña"
                className="auth-campo px-10"
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
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <Checkbox name="remember" defaultChecked />
            Recordar acceso
          </label>

          {state.error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive animate-in fade-in slide-in-from-top-1 duration-300">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="btn-acceso group/cta"
          >
            {pending ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Ingresando...
              </>
            ) : (
              <>
                Iniciar sesión
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/cta:translate-x-1" />
              </>
            )}
          </button>

          <div className="grid grid-cols-2 gap-2 pt-1 text-[13px] text-muted-foreground">
            <span className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-1.5">
              <ShieldCheck className="h-4 w-4 text-success" />
              Sesión protegida
            </span>
            <span className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-border px-2 py-1.5">
              <KeyRound className="h-4 w-4 text-success" />
              Acceso por roles
            </span>
          </div>
        </form>

        <div className="space-y-2 text-center text-sm text-muted-foreground">
          <p>
            ¿No tienes cuenta?{" "}
            <Link href="/registro" className="font-medium text-primary hover:underline">
              Regístrate aquí
            </Link>
          </p>
          <p className="text-xs text-muted-foreground">
            ¿Necesitas ayuda? Contacta a Talento Humano de Red Salud Casanare E.S.E.
          </p>
        </div>

        <p className="border-t border-border pt-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} RedSalud Te Forma · Plataforma institucional
        </p>
      </div>
    </div>
  );
}
