"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { solicitarCodigoAction, cambiarConCodigoAction } from "./actions";

/**
 * Recuperación de contraseña en tres pasos dentro de la misma pantalla:
 * correo → código → contraseña nueva. Se mantiene el identificador escrito en
 * el paso 1 para reenviarlo con el código, así el servidor puede resolver de
 * qué cuenta se trata sin exponer el id del usuario en el navegador.
 */
export function RecuperarForm() {
  const router = useRouter();
  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [identificador, setIdentificador] = useState("");

  const [estadoSolicitud, solicitar, enviandoSolicitud] = useActionState(solicitarCodigoAction, {
    error: null,
  });
  const [estadoCambio, cambiar, cambiando] = useActionState(cambiarConCodigoAction, { error: null });

  // Avance de paso según lo que respondió el servidor.
  if (estadoSolicitud.enviado && paso === 1) setPaso(2);
  if (estadoCambio.exito && paso !== 3) setPaso(3);

  if (paso === 3) {
    return (
      <div className="space-y-5 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success/15 text-success">
          <CheckCircle2 className="h-7 w-7" />
        </span>
        <div>
          <h1 className="font-display text-xl font-extrabold text-foreground">Contraseña actualizada</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ya puedes entrar a la plataforma con tu contraseña nueva.
          </p>
        </div>
        <Button onClick={() => router.push("/login")} className="w-full">
          Ir a iniciar sesión
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          {paso === 1 ? <Mail className="h-5 w-5" /> : <KeyRound className="h-5 w-5" />}
        </span>
        <h1 className="font-display text-xl font-extrabold text-foreground">
          {paso === 1 ? "Recuperar contraseña" : "Revisa tu correo"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {paso === 1
            ? "Escribe tu correo o usuario y te enviaremos un código de 6 dígitos."
            : "Escribe el código que te llegó y elige tu contraseña nueva. Vence en 15 minutos."}
        </p>
      </div>

      {paso === 1 ? (
        <form action={solicitar} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="identificador">Correo o usuario</Label>
            <Input
              id="identificador"
              name="identificador"
              type="text"
              autoComplete="username"
              required
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
              placeholder="nombre@redsaludcasanare.gov.co"
            />
          </div>
          {estadoSolicitud.error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {estadoSolicitud.error}
            </p>
          )}
          <Button type="submit" disabled={enviandoSolicitud} className="w-full">
            {enviandoSolicitud ? "Enviando..." : "Enviarme el código"}
          </Button>
        </form>
      ) : (
        <form action={cambiar} className="space-y-4">
          <input type="hidden" name="identificador" value={identificador} />
          <div className="space-y-1.5">
            <Label htmlFor="codigo">Código de 6 dígitos</Label>
            <Input
              id="codigo"
              name="codigo"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              placeholder="000000"
              className="text-center text-lg font-bold tracking-[0.5em]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Contraseña nueva</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirmar">Confirmar contraseña</Label>
            <Input id="confirmar" name="confirmar" type="password" autoComplete="new-password" required minLength={8} />
          </div>
          {estadoCambio.error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{estadoCambio.error}</p>
          )}
          <Button type="submit" disabled={cambiando} className="w-full">
            {cambiando ? "Guardando..." : "Cambiar mi contraseña"}
          </Button>
          <button
            type="button"
            onClick={() => setPaso(1)}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            ¿No te llegó? Volver a pedir el código
          </button>
        </form>
      )}

      <div className="flex items-center justify-between border-t border-border pt-4 text-xs">
        <Link href="/login" className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a iniciar sesión
        </Link>
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Conexión segura
        </span>
      </div>
    </div>
  );
}
