"use client";

import { useActionState, useEffect, useState } from "react";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { revokeCertificateAction, type RevokeCertificateState } from "@/app/admin/certificados/actions";

const initialState: RevokeCertificateState = { error: null };

export function RevokeCertificateDialog({ certificateId, studentName }: { certificateId: string; studentName: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(revokeCertificateAction.bind(null, certificateId), initialState);

  useEffect(() => {
    if (state.success) setOpen(false);
  }, [state]);

  return (
    <>
      <Button type="button" variant="ghost" size="icon-sm" className="text-destructive hover:bg-destructive/10" onClick={() => setOpen(true)}>
        <Ban className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular certificado</DialogTitle>
            <DialogDescription>
              El certificado de {studentName} quedará marcado como anulado y la validación pública lo mostrará de
              inmediato. Esta acción se puede revertir después.
            </DialogDescription>
          </DialogHeader>
          <form action={formAction} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="reason">Motivo</Label>
              <Textarea id="reason" name="reason" rows={3} required placeholder="Ej: emitido por error, curso no aprobado realmente..." />
            </div>
            {state.error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
            )}
            <DialogFooter>
              <Button type="submit" variant="destructive" disabled={pending}>
                {pending ? "Anulando..." : "Anular certificado"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
