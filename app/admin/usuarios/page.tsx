import Link from "next/link";
import { Pencil, Plus, Users, MapPin } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ModuloHero } from "@/components/training-plans/modulo-hero";
import { AvatarIniciales, PildoraEstado, escalon } from "@/components/training-plans/plan-visual";
import { nombrePropio } from "@/components/training-plans/labels";
import { DeleteUserButton } from "@/components/admin/delete-user-button";
import { ToggleStatusButton } from "@/components/admin/toggle-status-button";
import { StaggerSections } from "@/components/brand/stagger-sections";
import { TablePagination } from "@/components/admin/table-pagination";
import { parsePageSize } from "@/lib/pagination";
import { MarcaPlanta, VINCULACION_LABELS, VINCULACION_LABELS_CORTAS, esPlanta } from "@/components/admin/marca-planta";
import { AutoSearchInput, AutoFilterSelect } from "@/components/admin/auto-search-input";
import { PERSONNEL_TYPE_LABELS } from "@/lib/personnel-labels";
import type { PersonnelType, Prisma, Role, TipoVinculacion, UserStatus } from "@prisma/client";

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "ADMIN", label: "Administrador" },
  { value: "TUTOR", label: "Tutor" },
  { value: "STUDENT", label: "Estudiante" },
];

const ROLE_LABEL: Record<Role, string> = { ADMIN: "Admin", TUTOR: "Tutor", STUDENT: "Estudiante" };
const STATUS_LABEL: Record<UserStatus, string> = { ACTIVE: "Activo", INACTIVE: "Inactivo", BLOCKED: "Bloqueado" };

const STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
  { value: "ACTIVE", label: "Activo" },
  { value: "INACTIVE", label: "Inactivo" },
  { value: "BLOCKED", label: "Bloqueado" },
];

const VINCULACION_OPTIONS: { value: TipoVinculacion; label: string }[] = [
  { value: "CARRERA_ADMINISTRATIVA", label: "Carrera administrativa" },
  { value: "PROVISIONALIDAD", label: "Provisionalidad" },
  { value: "TEMPORAL", label: "Temporal" },
  { value: "TRABAJADOR_OFICIAL", label: "Trabajador oficial" },
  { value: "LIBRE_NOMBRAMIENTO", label: "Libre nombramiento" },
  { value: "PERIODO_FIJO", label: "Periodo fijo" },
  { value: "CONTRATO_PRESTACION", label: "Contrato de prestación" },
  { value: "OTRO", label: "Otro" },
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
    municipio?: string;
    vinculacion?: string;
    page?: string;
    pageSize?: string;
  }>;
}) {
  const { q, role, status, personnelType, municipio, vinculacion, page: pageParam, pageSize: pageSizeParam } = await searchParams;

  const where: Prisma.UserWhereInput = {};

  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { documentNumber: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { username: { contains: q, mode: "insensitive" } },
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
  if (municipio) {
    where.municipioId = municipio;
  }
  if (vinculacion) {
    where.tipoVinculacion = vinculacion as TipoVinculacion;
  }

  // Paginado: con cientos de personas cargadas, traer la tabla entera hacía
  // lenta la vista y la consulta. Se pide solo la página visible y las
  // columnas que la tabla realmente usa (antes venían todas, passwordHash
  // incluido).
  const pageSize = parsePageSize(pageSizeParam);
  const page = Math.max(1, Number(pageParam) || 1);

  const [total, users, municipios, porEstado, porVinculacion, sinAcceso] = await Promise.all([
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
        username: true,
        position: true,
        personnelType: true,
        tipoVinculacion: true,
        role: true,
        status: true,
        municipio: { select: { nombre: true } },
      },
    }),
    prisma.municipio.findMany({ where: { isActive: true }, orderBy: { nombre: "asc" }, select: { id: true, nombre: true } }),
    // Cifras del directorio completo (no del filtro): cuántas personas hay,
    // cuántas activas, de planta, contratistas y sin credencial de acceso.
    prisma.user.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.user.groupBy({ by: ["tipoVinculacion"], _count: { _all: true } }),
    prisma.user.count({ where: { email: null, username: null } }),
  ]);
  const directorio = porEstado.reduce((a, g) => a + g._count._all, 0);
  const activos = porEstado.find((g) => g.status === "ACTIVE")?._count._all ?? 0;
  const planta = porVinculacion.filter((g) => esPlanta(g.tipoVinculacion)).reduce((a, g) => a + g._count._all, 0);
  const contratistas = porVinculacion.find((g) => g.tipoVinculacion === "CONTRATO_PRESTACION")?._count._all ?? 0;
  const hayFiltro = Boolean(q || role || status || personnelType || municipio || vinculacion);

  return (
    <div className="space-y-6">
      <ModuloHero
        eyebrow="Personas · Directorio institucional"
        Icono={Users}
        titulo="Directorio de"
        acento="usuarios"
        descripcion={
          hayFiltro
            ? `${total} ${total === 1 ? "persona coincide" : "personas coinciden"} con los filtros aplicados.`
            : "Todo el personal con acceso a la plataforma: planta y contratistas, por municipio, vinculación y rol."
        }
        acciones={
          <Link href="/admin/usuarios/nuevo" className="boton-hero">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nuevo usuario
          </Link>
        }
        cifras={[
          { valor: directorio, etiqueta: "En el directorio" },
          { valor: activos, etiqueta: "Activos" },
          { valor: planta, etiqueta: "De planta" },
          { valor: contratistas, etiqueta: "Contratistas" },
        ]}
        pie={
          sinAcceso > 0 ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-white/55">
              {sinAcceso} {sinAcceso === 1 ? "persona" : "personas"} sin correo ni usuario: no pueden iniciar sesión
            </p>
          ) : undefined
        }
      />

      <StaggerSections className="space-y-6">
      {/* Filtros automáticos: se aplican al escribir o elegir, sin botón. */}
      <div className="barra-modulo form-premium filtros-rejilla p-4">
        <AutoSearchInput label="Buscar" placeholder="Nombre, cédula, correo o cargo…" />
        <AutoFilterSelect
          paramName="personnelType"
          label="Tipo de personal"
          options={PERSONNEL_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />
        <AutoFilterSelect paramName="role" label="Rol" options={ROLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
        <AutoFilterSelect paramName="status" label="Estado" options={STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />
        <AutoFilterSelect
          paramName="municipio"
          label="Municipio"
          options={municipios.map((m) => ({ value: m.id, label: m.nombre }))}
        />
        <AutoFilterSelect
          paramName="vinculacion"
          label="Vinculación"
          options={VINCULACION_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />
      </div>

      <div className="tabla-modulo">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Persona</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Ubicación</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead className="w-[118px]">Estado</TableHead>
              <TableHead className="col-fijada text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                  No se encontraron usuarios con esos filtros.
                </TableCell>
              </TableRow>
            )}
            {users.map((user, i) => (
              <TableRow key={user.id} className="revelar" style={escalon(Math.min(i, 14))}>
                <TableCell className="max-w-[250px]">
                  <Link href={`/admin/usuarios/${user.id}`} className="group flex items-center gap-3" title={user.fullName}>
                    <AvatarIniciales nombre={user.fullName} className="!h-8 !w-8" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-[13.5px] font-semibold text-foreground group-hover:text-primary">{nombrePropio(user.fullName)}</span>
                        <MarcaPlanta tipo={user.tipoVinculacion} />
                      </span>
                      <span
                        className="block truncate font-mono text-[11px] text-muted-foreground"
                        title={user.email ?? (user.username ? `usuario: ${user.username}` : "sin credencial de acceso")}
                      >
                        {user.email ?? (user.username ? `@${user.username}` : <span className="text-destructive">sin acceso</span>)}
                      </span>
                    </span>
                  </Link>
                </TableCell>
                {/* Solo el número: el tipo de documento es CC en la práctica
                    totalidad de los registros; queda en el título. */}
                <TableCell className="max-w-[150px] truncate font-mono text-[12px] text-foreground/80" title={`${user.documentType} ${user.documentNumber}`}>
                  {user.documentNumber}
                </TableCell>
                <TableCell className="max-w-[180px]">
                  <span className="block truncate text-[13px] text-foreground" title={user.position ?? ""}>
                    {user.position ? nombrePropio(user.position) : "—"}
                  </span>
                  <span className="mt-0.5 block font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">
                    {PERSONNEL_TYPE_LABELS[user.personnelType]}
                  </span>
                </TableCell>
                <TableCell className="max-w-[150px]">
                  <span className="flex items-center gap-1.5 text-[13px] text-foreground">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-primary/70" aria-hidden="true" />
                    {user.municipio?.nombre ?? "—"}
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground" title={VINCULACION_LABELS[user.tipoVinculacion]}>
                    {VINCULACION_LABELS_CORTAS[user.tipoVinculacion] ?? "—"}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="rol-chip" data-rol={user.role}>{ROLE_LABEL[user.role]}</span>
                </TableCell>
                <TableCell className="w-[118px]">
                  <PildoraEstado estado={user.status === "ACTIVE" ? "ACTIVE" : user.status}>{STATUS_LABEL[user.status]}</PildoraEstado>
                </TableCell>
                <TableCell className="col-fijada">
                  <div className="acciones-fila flex justify-end gap-1.5">
                    <Link
                      href={`/admin/usuarios/${user.id}`}
                      className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }))}
                      title="Editar usuario"
                      aria-label="Editar usuario"
                    >
                      <Pencil />
                    </Link>
                    <ToggleStatusButton userId={user.id} status={user.status} />
                    <DeleteUserButton userId={user.id} userName={user.fullName} />
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
