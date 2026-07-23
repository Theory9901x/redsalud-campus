import { prisma } from "@/lib/prisma";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminPageHeader } from "@/components/admin/page-header";
import { TablePagination } from "@/components/admin/table-pagination";
import { AutoSearchInput, AutoFilterSelect } from "@/components/admin/auto-search-input";
import { parsePageSize } from "@/lib/pagination";
import { Badge } from "@/components/ui/badge";
import { KeyRound } from "lucide-react";
import type { Prisma } from "@prisma/client";

/** Etiquetas legibles de cada acción registrada. */
const ACCION_LABELS: Record<string, string> = {
  CREATE: "Creación",
  UPDATE: "Modificación",
  DELETE: "Eliminación",
  LOGIN: "Inicio de sesión",
  ENROLL: "Inscripción",
  UNENROLL: "Baja de inscripción",
  PUBLISH: "Publicación",
  ISSUE_CERT: "Emisión de certificado",
  REVOKE_CERT: "Revocación de certificado",
  RESTORE_CERT: "Restauración de certificado",
  RESET_PASSWORD: "Cambio de contraseña",
  IMPORT: "Importación",
};

const ACCION_CLASES: Record<string, string> = {
  CREATE: "bg-success/15 text-success",
  UPDATE: "bg-primary/10 text-primary",
  DELETE: "bg-destructive/10 text-destructive",
  ENROLL: "bg-success/15 text-success",
  UNENROLL: "bg-warning/15 text-warning-foreground",
  RESET_PASSWORD: "bg-warning/15 text-warning-foreground",
  REVOKE_CERT: "bg-destructive/10 text-destructive",
};

const ENTIDAD_LABELS: Record<string, string> = {
  User: "Usuario",
  Course: "Curso",
  Module: "Módulo",
  Lesson: "Lección",
  Enrollment: "Inscripción",
  Certificate: "Certificado",
  TrainingPlan: "Plan de capacitación",
  Notification: "Notificación",
  Settings: "Configuración",
};

export default async function BitacoraPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; accion?: string; entidad?: string; page?: string; pageSize?: string }>;
}) {
  const { q, accion, entidad, page: pageParam, pageSize: pageSizeParam } = await searchParams;
  const pageSize = parsePageSize(pageSizeParam);
  const page = Math.max(1, Number(pageParam) || 1);

  const where: Prisma.AuditLogWhereInput = {};
  if (accion) where.action = accion;
  if (entidad) where.entity = entidad;
  if (q) {
    where.OR = [
      { description: { contains: q, mode: "insensitive" } },
      { user: { fullName: { contains: q, mode: "insensitive" } } },
      { entityId: { contains: q, mode: "insensitive" } },
    ];
  }

  const [registros, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        description: true,
        createdAt: true,
        user: { select: { fullName: true, email: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  // Solicitudes de recuperación vigentes: le dicen a Talento Humano quién está
  // intentando entrar y no puede, para poder ayudarle de inmediato.
  const solicitudes = await prisma.passwordResetToken.findMany({
    where: { usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      createdAt: true,
      attempts: true,
      user: { select: { fullName: true, email: true, municipio: { select: { nombre: true } } } },
    },
  });

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Bitácora"
        description={`${total} ${total === 1 ? "registro" : "registros"} de todo lo que ha pasado en la plataforma`}
      />

      {solicitudes.length > 0 && (
        <div className="surface-glass p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning-foreground">
              <KeyRound className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-display text-base font-extrabold text-foreground">
                Solicitudes de contraseña en curso ({solicitudes.length})
              </h2>
              <p className="text-xs text-muted-foreground">
                Personas que pidieron un código en los últimos 15 minutos y aún no lo han usado.
              </p>
            </div>
          </div>
          <ul className="mt-3 divide-y divide-border">
            {solicitudes.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{s.user.fullName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.user.email}
                    {s.user.municipio ? ` · ${s.user.municipio.nombre}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right text-xs text-muted-foreground">
                  <p>{s.createdAt.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}</p>
                  {s.attempts > 0 && (
                    <p className="text-warning-foreground">
                      {s.attempts} {s.attempts === 1 ? "intento fallido" : "intentos fallidos"}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Filtros automáticos: se aplican al escribir o elegir. */}
      <div className="surface-panel flex flex-wrap items-end gap-3 p-4">
        <AutoSearchInput label="Buscar" placeholder="Descripción, persona o identificador..." />
        <AutoFilterSelect
          paramName="accion"
          label="Acción"
          options={Object.entries(ACCION_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <AutoFilterSelect
          paramName="entidad"
          label="Módulo"
          options={Object.entries(ENTIDAD_LABELS).map(([value, label]) => ({ value, label }))}
        />
      </div>

      <div className="surface-glass overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha y hora</TableHead>
              <TableHead>Quién</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Módulo</TableHead>
              <TableHead>Detalle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registros.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  {total === 0 && !q && !accion && !entidad
                    ? "Todavía no hay movimientos registrados. A partir de ahora cada cambio quedará aquí."
                    : "No hay registros que coincidan con esos filtros."}
                </TableCell>
              </TableRow>
            )}
            {registros.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {r.createdAt.toLocaleString("es-CO", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </TableCell>
                <TableCell className="max-w-[200px] truncate font-medium text-foreground" title={r.user?.email ?? ""}>
                  {r.user?.fullName ?? "Sistema"}
                </TableCell>
                <TableCell>
                  <Badge className={ACCION_CLASES[r.action] ?? "bg-secondary text-secondary-foreground"}>
                    {ACCION_LABELS[r.action] ?? r.action}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{ENTIDAD_LABELS[r.entity] ?? r.entity}</TableCell>
                <TableCell className="max-w-[420px] truncate text-muted-foreground" title={r.description ?? ""}>
                  {r.description ?? "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination total={total} page={page} pageSize={pageSize} />
      </div>
    </div>
  );
}
