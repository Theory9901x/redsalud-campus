"use client";

import { useActionState, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createNotificationAction, type NotificationFormState } from "@/app/admin/notificaciones/actions";

const initialState: NotificationFormState = { error: null };

const SEVERITY_OPTIONS = [
  { value: "INFO", label: "Informativa" },
  { value: "SUCCESS", label: "Buena noticia" },
  { value: "WARNING", label: "Advertencia" },
  { value: "DANGER", label: "Urgente" },
] as const;

export function NotificationForm({ users }: { users: { id: string; fullName: string; email: string }[] }) {
  const [state, formAction, pending] = useActionState(createNotificationAction, initialState);
  const [targetType, setTargetType] = useState<"ALL" | "ROLE" | "USER">("ALL");

  return (
    <form
      action={formAction}
      key={state.success ? "sent" : "form"}
      className="surface surface-accent-top space-y-4 p-6"
    >
      <div>
        <h2 className="font-display text-lg font-bold text-foreground">Emitir notificación</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Aparecerá en la campana de los usuarios destinatarios.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="title">Título</Label>
          <Input id="title" name="title" required placeholder="Ej: Mantenimiento programado" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="severity">Tipo</Label>
          <select
            id="severity"
            name="severity"
            defaultValue="INFO"
            className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {SEVERITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="body">Contenido</Label>
        <Textarea id="body" name="body" required rows={3} placeholder="Describe la novedad para el usuario." />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="targetType">Destinatarios</Label>
          <select
            id="targetType"
            name="targetType"
            value={targetType}
            onChange={(e) => setTargetType(e.target.value as "ALL" | "ROLE" | "USER")}
            className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="ALL">Todos los usuarios</option>
            <option value="ROLE">Un rol específico</option>
            <option value="USER">Un usuario específico</option>
          </select>
        </div>

        {targetType === "ROLE" && (
          <div className="space-y-1.5">
            <Label htmlFor="targetRole">Rol</Label>
            <select
              id="targetRole"
              name="targetRole"
              defaultValue="STUDENT"
              className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="STUDENT">Estudiantes</option>
              <option value="TUTOR">Tutores</option>
              <option value="ADMIN">Administradores</option>
            </select>
          </div>
        )}

        {targetType === "USER" && (
          <div className="space-y-1.5">
            <Label htmlFor="targetUserId">Usuario</Label>
            <select
              id="targetUserId"
              name="targetUserId"
              required
              defaultValue=""
              className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="" disabled>
                Selecciona un usuario
              </option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName} — {u.email}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {state.error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>}
      {state.success && (
        <p className="rounded-lg bg-success/10 px-3 py-2 text-sm text-success">Notificación enviada correctamente.</p>
      )}

      <Button type="submit" disabled={pending} className="gap-2">
        <Send className="h-4 w-4" />
        {pending ? "Enviando..." : "Enviar notificación"}
      </Button>
    </form>
  );
}
