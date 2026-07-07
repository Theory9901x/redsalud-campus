import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RoleBadge } from "@/components/admin/role-badge";
import { StatusBadge } from "@/components/admin/status-badge";
import { ToggleStatusButton } from "@/components/admin/toggle-status-button";
import type { Prisma, Role, UserStatus } from "@prisma/client";

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "ADMIN", label: "Administrador" },
  { value: "TUTOR", label: "Tutor" },
  { value: "STUDENT", label: "Estudiante" },
];

const STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
  { value: "ACTIVE", label: "Activo" },
  { value: "INACTIVE", label: "Inactivo" },
  { value: "BLOCKED", label: "Bloqueado" },
];

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; status?: string }>;
}) {
  const { q, role, status } = await searchParams;

  const where: Prisma.UserWhereInput = {};

  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { documentNumber: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }
  if (role) {
    where.role = role as Role;
  }
  if (status) {
    where.status = status as UserStatus;
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-foreground">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            {users.length} {users.length === 1 ? "usuario encontrado" : "usuarios encontrados"}
          </p>
        </div>
        <Link href="/admin/usuarios/nuevo" className={cn(buttonVariants(), "gap-1.5")}>
          <Plus className="h-4 w-4" />
          Nuevo usuario
        </Link>
      </div>

      <form
        method="get"
        className="surface flex flex-wrap items-end gap-3 p-4"
      >
        <div className="flex-1 min-w-[200px] space-y-1.5">
          <label htmlFor="q" className="text-xs font-medium text-muted-foreground">
            Buscar por nombre, cédula o correo
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Ej. María Gutiérrez, 1015469107..."
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="role" className="text-xs font-medium text-muted-foreground">
            Rol
          </label>
          <select
            id="role"
            name="role"
            defaultValue={role ?? ""}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Todos</option>
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="status" className="text-xs font-medium text-muted-foreground">
            Estado
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status ?? ""}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Todos</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit" variant="secondary">
          Filtrar
        </Button>
        {(q || role || status) && (
          <Link href="/admin/usuarios" className={cn(buttonVariants({ variant: "ghost" }))}>
            Limpiar
          </Link>
        )}
      </form>

      <div className="surface overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No se encontraron usuarios con esos filtros.
                </TableCell>
              </TableRow>
            )}
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium text-foreground">
                  <Link href={`/admin/usuarios/${user.id}`} className="hover:underline">
                    {user.fullName}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {user.documentType} {user.documentNumber}
                </TableCell>
                <TableCell className="text-muted-foreground">{user.email}</TableCell>
                <TableCell>
                  <RoleBadge role={user.role} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={user.status} />
                </TableCell>
                <TableCell className="flex justify-end gap-2">
                  <Link
                    href={`/admin/usuarios/${user.id}`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    Editar
                  </Link>
                  <ToggleStatusButton userId={user.id} status={user.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
