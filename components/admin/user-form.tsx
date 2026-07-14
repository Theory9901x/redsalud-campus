"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { UserFormState } from "@/app/admin/usuarios/actions";
import type { AdminSection, DocumentType, PersonnelType, Role, UserStatus } from "@prisma/client";

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

const PERSONNEL_TYPES: { value: PersonnelType; label: string }[] = [
  { value: "ADMINISTRATIVO", label: "Administrativo" },
  { value: "ASISTENCIAL", label: "Asistencial" },
];

const ADMIN_SECTION_LABELS: { value: AdminSection; label: string }[] = [
  { value: "USUARIOS", label: "Usuarios" },
  { value: "CURSOS", label: "Cursos" },
  { value: "PLANES_CAPACITACION", label: "Planes de capacitación" },
  { value: "INSCRIPCIONES", label: "Inscripciones" },
  { value: "CERTIFICADOS", label: "Certificados" },
  { value: "NOTIFICACIONES", label: "Notificaciones" },
  { value: "REPORTES", label: "Reportes" },
  { value: "CONFIGURACION", label: "Configuración" },
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
  personnelType: PersonnelType;
  role: Role;
  status: UserStatus;
  restrictedAdminSections: AdminSection[];
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
  personnelType: "ADMINISTRATIVO",
  role: "STUDENT",
  status: "ACTIVE",
  restrictedAdminSections: [],
};

const initialState: UserFormState = { error: null };

export function UserForm({
  mode,
  action,
  defaultValues,
  submitLabel,
  isOwnAccount,
}: {
  mode: "create" | "edit";
  action: (prevState: UserFormState, formData: FormData) => Promise<UserFormState>;
  defaultValues?: Partial<UserFormValues>;
  submitLabel: string;
  /** Si esta ficha es la del propio admin que la está editando: no puede quitarse a sí mismo Usuarios. */
  isOwnAccount?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const values = { ...EMPTY_VALUES, ...defaultValues };
  const [role, setRole] = useState<Role>(values.role);

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
          <Label htmlFor="personnelType">Tipo de personal</Label>
          <select
            id="personnelType"
            name="personnelType"
            required
            defaultValue={values.personnelType}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            {PERSONNEL_TYPES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="role">Rol</Label>
          <select
            id="role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            {ROLES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {role === "ADMIN" && (
          <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4 sm:col-span-2">
            <div>
              <Label>Nivel de administrador</Label>
              <p className="text-xs text-muted-foreground">
                Marca las secciones a las que <strong>este admin NO</strong> debe tener acceso. Déjalas todas
                sin marcar para un administrador principal, con acceso total.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              {ADMIN_SECTION_LABELS.map((section) => {
                const isSelfUsuarios = isOwnAccount && section.value === "USUARIOS";
                return (
                  <label
                    key={section.value}
                    className={`group flex items-center gap-2 text-sm ${isSelfUsuarios ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                  >
                    <Checkbox
                      name="restrictedAdminSections"
                      value={section.value}
                      disabled={isSelfUsuarios}
                      defaultChecked={values.restrictedAdminSections.includes(section.value)}
                    />
                    {section.label}
                  </label>
                );
              })}
            </div>
            {isOwnAccount && (
              <p className="text-xs text-muted-foreground">
                No puedes quitarte a ti mismo el acceso a Usuarios.
              </p>
            )}
          </div>
        )}

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
