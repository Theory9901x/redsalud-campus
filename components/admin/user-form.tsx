"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UserFormState } from "@/app/admin/usuarios/actions";
import type { DocumentType, Role, UserStatus } from "@prisma/client";

const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: "CC", label: "Cédula de ciudadanía" },
  { value: "CE", label: "Cédula de extranjería" },
  { value: "TI", label: "Tarjeta de identidad" },
  { value: "PA", label: "Pasaporte" },
];

const ROLES: { value: Role; label: string }[] = [
  { value: "STUDENT", label: "Estudiante" },
  { value: "TUTOR", label: "Tutor" },
  { value: "ADMIN", label: "Administrador" },
];

const STATUSES: { value: UserStatus; label: string }[] = [
  { value: "ACTIVE", label: "Activo" },
  { value: "INACTIVE", label: "Inactivo" },
  { value: "BLOCKED", label: "Bloqueado" },
];

type UserFormValues = {
  fullName: string;
  documentType: DocumentType;
  documentNumber: string;
  email: string;
  phone: string;
  profession: string;
  position: string;
  department: string;
  role: Role;
  status: UserStatus;
};

const EMPTY_VALUES: UserFormValues = {
  fullName: "",
  documentType: "CC",
  documentNumber: "",
  email: "",
  phone: "",
  profession: "",
  position: "",
  department: "",
  role: "STUDENT",
  status: "ACTIVE",
};

const initialState: UserFormState = { error: null };

export function UserForm({
  mode,
  action,
  defaultValues,
  submitLabel,
}: {
  mode: "create" | "edit";
  action: (prevState: UserFormState, formData: FormData) => Promise<UserFormState>;
  defaultValues?: Partial<UserFormValues>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const values = { ...EMPTY_VALUES, ...defaultValues };

  return (
    <form action={formAction} className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="fullName">Nombre completo</Label>
          <Input id="fullName" name="fullName" required defaultValue={values.fullName} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="documentType">Tipo de documento</Label>
          <select
            id="documentType"
            name="documentType"
            defaultValue={values.documentType}
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
          <Input id="documentNumber" name="documentNumber" required defaultValue={values.documentNumber} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Correo electrónico</Label>
          <Input id="email" name="email" type="email" required defaultValue={values.email} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="phone">Teléfono</Label>
          <Input id="phone" name="phone" defaultValue={values.phone} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="profession">Profesión</Label>
          <Input id="profession" name="profession" defaultValue={values.profession} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="position">Cargo</Label>
          <Input id="position" name="position" defaultValue={values.position} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="department">Dependencia / área</Label>
          <Input id="department" name="department" defaultValue={values.department} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="role">Rol</Label>
          <select
            id="role"
            name="role"
            defaultValue={values.role}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            {ROLES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {mode === "edit" && (
          <div className="space-y-1.5">
            <Label htmlFor="status">Estado</Label>
            <select
              id="status"
              name="status"
              defaultValue={values.status}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              {STATUSES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {mode === "create" && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="password">Contraseña temporal</Label>
            <Input id="password" name="password" type="text" required minLength={8} />
            <p className="text-xs text-muted-foreground">
              El usuario deberá cambiarla al iniciar sesión por primera vez.
            </p>
          </div>
        )}
      </div>

      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Guardando..." : submitLabel}
      </Button>
    </form>
  );
}
