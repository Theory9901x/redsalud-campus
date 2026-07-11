"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Mail, Lock, Eye, EyeOff, ArrowRight, HelpCircle, ShieldCheck, KeyRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotHelp, setShowForgotHelp] = useState(false);

  return (
    <div className="relative w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="relative space-y-8">
        <div className="relative">
          <span className="absolute -right-1 -top-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-success text-white shadow-[0_8px_20px_-6px_color-mix(in_oklch,var(--primary)_60%,transparent)]">
            <ShieldCheck className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <p className="text-xs font-bold uppercase tracking-wide text-primary">Bienvenido de nuevo</p>
          <h1 className="mt-1.5 font-display text-4xl font-extrabold tracking-tight text-foreground">
            Accede a tu espacio
          </h1>
          <p className="mt-2 max-w-[85%] text-[15px] leading-relaxed text-muted-foreground">
            Continúa tu formación institucional desde una plataforma segura y unificada.
          </p>
        </div>

        <form action={formAction} className="space-y-5">
          <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />

          <div className="space-y-1.5">
            <Label htmlFor="email">Correo institucional</Label>
            <div className="group relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="nombre@redsaludcasanare.gov.co"
                className="h-12 rounded-xl pl-10 transition-shadow focus-visible:shadow-md"
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
                placeholder="Ingresa tu contraseña"
                className="h-12 rounded-xl px-10 transition-shadow focus-visible:shadow-md"
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
            className="group/cta relative flex h-[3.25rem] w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-primary to-success text-[15px] font-semibold text-white shadow-[0_10px_24px_-8px_color-mix(in_oklch,var(--primary)_55%,transparent)] transition-all duration-(--duration-signature-fast) ease-(--ease-signature) hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-8px_color-mix(in_oklch,var(--primary)_65%,transparent)] active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-60"
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

          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              Sesión protegida
            </span>
            <span className="inline-flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-success" />
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
          <p className="text-xs text-muted-foreground/70">
            ¿Necesitas ayuda? Contacta a Talento Humano de Red Salud Casanare E.S.E.
          </p>
        </div>

        <p className="border-t border-border pt-4 text-center text-[11px] text-muted-foreground/60">
          © {new Date().getFullYear()} RedSalud Te Forma · Plataforma institucional
        </p>
      </div>
    </div>
  );
}
