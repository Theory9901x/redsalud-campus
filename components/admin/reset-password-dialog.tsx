"use client";

import { useState } from "react";
import { Check, Copy, Eye, EyeOff, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { resetPasswordAction, setCustomPasswordAction } from "@/app/admin/usuarios/actions";

export function ResetPasswordDialog({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [customPassword, setCustomPassword] = useState("");
  const [showCustomPassword, setShowCustomPassword] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);
  const [customSuccess, setCustomSuccess] = useState(false);

  async function handleReset() {
    setPending(true);
    const result = await resetPasswordAction(userId);
    setTempPassword(result.tempPassword);
    setPending(false);
  }

  async function handleSetCustom() {
    setPending(true);
    setCustomError(null);
    const result = await setCustomPasswordAction(userId, customPassword);
    setPending(false);
    if (result.error) {
      setCustomError(result.error);
      return;
    }
    setCustomSuccess(true);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setTempPassword(null);
      setCopied(false);
      setCustomPassword("");
      setCustomError(null);
      setCustomSuccess(false);
    }
  }

  async function handleCopy() {
    if (!tempPassword) return;
    await navigator.clipboard.writeText(tempPassword);
    setCopied(true);
  }

  const done = tempPassword || customSuccess;

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <KeyRound className="h-4 w-4" />
        Contraseña
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contraseña de {userName}</DialogTitle>
            <DialogDescription>
              {done
                ? "El usuario deberá cambiarla al iniciar sesión por primera vez."
                : "Elige una contraseña específica o genera una aleatoria. No hay envío automático por correo: deberás comunicársela tú por un medio seguro."}
            </DialogDescription>
          </DialogHeader>

          {tempPassword ? (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2">
              <code className="flex-1 font-mono text-sm text-foreground">{tempPassword}</code>
              <Button type="button" variant="ghost" size="icon-sm" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          ) : customSuccess ? (
            <p className="flex items-center gap-1.5 rounded-md bg-success/10 px-3 py-2 text-sm text-success">
              <Check className="h-4 w-4" />
              Contraseña actualizada.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="customPassword">Escribir una contraseña específica</Label>
                <div className="relative">
                  <Input
                    id="customPassword"
                    type={showCustomPassword ? "text" : "password"}
                    minLength={8}
                    placeholder="Mínimo 8 caracteres"
                    value={customPassword}
                    onChange={(e) => setCustomPassword(e.target.value)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCustomPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showCustomPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  >
                    {showCustomPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {customError && <p className="text-xs text-destructive">{customError}</p>}
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSetCustom}
                  disabled={pending || customPassword.length < 8}
                >
                  {pending ? "Guardando..." : "Guardar esta contraseña"}
                </Button>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                o
                <span className="h-px flex-1 bg-border" />
              </div>

              <DialogFooter className="sm:justify-start">
                <Button type="button" variant="outline" onClick={handleReset} disabled={pending}>
                  {pending ? "Generando..." : "Generar una aleatoria"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
