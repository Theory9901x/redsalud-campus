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
import { StaggerSections } from "@/components/brand/stagger-sections";
import { AdminPageHeader } from "@/components/admin/page-header";
import { TablePagination } from "@/components/admin/table-pagination";
import { parsePageSize } from "@/lib/pagination";
import { PERSONNEL_TYPE_LABELS } from "@/lib/personnel-labels";
import type { PersonnelType, Prisma, Role, UserStatus } from "@prisma/client";

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

const PERSONNEL_TYPE_OPTIONS: { value: PersonnelType; label: string }[] = [
  { value: "ADMINISTRATIVO", label: "Administrativo" },
  { value: "ASISTENCIAL", label: "Asistencial" },
];

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    role?: string;
    status?: string;
    personnelType?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const { q, role, status, personnelType, page: pageParam, pageSize: pageSizeParam } = await searchParams;

  const where: Prisma.UserWhereInput = {};

  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { documentNumber: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { position: { contains: q, mode: "insensitive" } },
    ];
  }
  if (role) {
    where.role = role as Role;
  }
  if (status) {
    where.status = status as UserStatus;
  }
  if (personnelType) {
    where.personnelType = personnelType as PersonnelType;
  }

  // Paginado: con cientos de personas cargadas, traer la tabla entera hacía
  // lenta la vista y la consulta. Se pide solo la página visible y las
  // columnas que la tabla realmente usa (antes venían todas, passwordHash
  // incluido).
  const pageSize = parsePageSize(pageSizeParam);
  const page = Math.max(1, Number(pageParam) || 1);

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        fullName: true,
        documentType: true,
        documentNumber: true,
        email: true,
        position: true,
        personnelType: true,
        role: true,
        status: true,
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Usuarios"
        description={`${total} ${total === 1 ? "usuario encontrado" : "usuarios encontrados"}`}
        action={
          <Link
            href="/admin/usuarios/nuevo"
            className={cn(buttonVariants(), "gap-1.5 bg-gradient-to-r from-primary to-teal-400 text-white hover:opacity-90")}
          >
            <Plus className="h-4 w-4" />
            Nuevo usuario
          </Link>
        }
      />

      <StaggerSections className="space-y-6">
      <form method="get" className="surface-panel flex flex-wrap items-end gap-3 p-4">
        {/* Al aplicar un filtro se vuelve a la página 1: el offset anterior
            apunta a un conjunto de resultados que ya no existe. */}
        <input type="hidden" name="page" value="1" />
        <input type="hidden" name="pageSize" value={pageSize} />
        <div className="flex-1 min-w-[200px] space-y-1.5">
          <label htmlFor="q" className="text-xs font-medium text-muted-foreground">
            Buscar por nombre, cédula, correo o cargo
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Ej. María Gutiérrez, 1015469107, Enfermera Jefe..."
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="personnelType" className="text-xs font-medium text-muted-foreground">
            Tipo de personal
          </label>
          <select
            id="personnelType"
            name="personnelType"
            defaultValue={personnelType ?? ""}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Todos</option>
            {PERSONNEL_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
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
        {(q || role || status || personnelType) && (
          <Link href="/admin/usuarios" className={cn(buttonVariants({ variant: "ghost" }))}>
            Limpiar
          </Link>
        )}
      </form>

      <div className="surface-glass overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Correo</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Personal</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="sticky right-0 bg-slate-100 text-right dark:bg-slate-800">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
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
                <TableCell className="max-w-[190px] truncate text-muted-foreground" title={user.email}>
                  {user.email}
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-muted-foreground" title={user.position ?? ""}>
                  {user.position || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">{PERSONNEL_TYPE_LABELS[user.personnelType]}</TableCell>
                <TableCell>
                  <RoleBadge role={user.role} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={user.status} />
                </TableCell>
                <TableCell className="sticky right-0 bg-inherit">
                  <div className="flex justify-end gap-2">
                  <Link
                    href={`/admin/usuarios/${user.id}`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                  >
                    Editar
                  </Link>
                    <ToggleStatusButton userId={user.id} status={user.status} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination total={total} page={page} pageSize={pageSize} />
      </div>
      </StaggerSections>
    </div>
  );
}
