"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { resetPasswordAction } from "@/app/admin/usuarios/actions";

export function ResetPasswordDialog({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleReset() {
    setPending(true);
    const result = await resetPasswordAction(userId);
    setTempPassword(result.tempPassword);
    setPending(false);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setTempPassword(null);
      setCopied(false);
    }
  }

  async function handleCopy() {
    if (!tempPassword) return;
    await navigator.clipboard.writeText(tempPassword);
    setCopied(true);
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <KeyRound className="h-4 w-4" />
        Resetear contraseña
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resetear contraseña</DialogTitle>
            <DialogDescription>
              {tempPassword
                ? `Comunícale esta contraseña temporal a ${userName} por un medio seguro (teléfono, en persona). Se le pedirá cambiarla al iniciar sesión.`
                : `Se generará una contraseña temporal para ${userName} y quedará obligado a cambiarla en su próximo inicio de sesión. No hay envío automático por correo: deberás comunicársela tú.`}
            </DialogDescription>
          </DialogHeader>

          {tempPassword ? (
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2">
              <code className="flex-1 font-mono text-sm text-foreground">{tempPassword}</code>
              <Button type="button" variant="ghost" size="icon-sm" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          ) : (
            <DialogFooter>
              <Button type="button" onClick={handleReset} disabled={pending}>
                {pending ? "Generando..." : "Generar contraseña temporal"}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
