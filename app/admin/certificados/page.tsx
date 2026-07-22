import Link from "next/link";
import { Download, RotateCcw, RefreshCcw, LayoutTemplate } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { RevokeCertificateDialog } from "@/components/certificados/revoke-certificate-dialog";
import { restoreCertificateAction, regenerateCertificateAction } from "@/app/admin/certificados/actions";
import { CERTIFICATE_STATUS_LABELS, CERTIFICATE_STATUS_CLASSES } from "@/components/certificados/labels";
import { StaggerSections } from "@/components/brand/stagger-sections";
import { AdminPageHeader } from "@/components/admin/page-header";
import { TablePagination } from "@/components/admin/table-pagination";
import { AutoSearchInput, AutoFilterSelect } from "@/components/admin/auto-search-input";
import { parsePageSize } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import type { CertificateStatus, Prisma } from "@prisma/client";

export default async function AdminCertificadosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; curso?: string; estado?: string; page?: string; pageSize?: string }>;
}) {
  const { q, curso, estado, page: pageParam, pageSize: pageSizeParam } = await searchParams;
  const pageSize = parsePageSize(pageSizeParam);
  const page = Math.max(1, Number(pageParam) || 1);

  const where: Prisma.CertificateWhereInput = {};
  if (curso) where.courseId = curso;
  if (estado) where.status = estado as CertificateStatus;
  if (q) {
    where.OR = [
      { certificateCode: { contains: q, mode: "insensitive" } },
      { user: { fullName: { contains: q, mode: "insensitive" } } },
      { user: { documentNumber: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [certificates, courses, totalCertificates] = await Promise.all([
    prisma.certificate.findMany({
      where,
      orderBy: { issuedAt: "desc" },
      include: { user: { select: { fullName: true, documentNumber: true } }, course: { select: { title: true } } },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.course.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }),
    prisma.certificate.count({ where }),
  ]);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Certificados"
        description="Se emiten automáticamente al completar un curso. Puedes buscarlos, anularlos y volver a descargarlos."
        action={
          <Link href="/admin/certificados/plantilla" className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}>
            <LayoutTemplate className="h-4 w-4" />
            Editar plantilla del certificado
          </Link>
        }
      />

      <StaggerSections className="space-y-6">
      {/* Filtros automáticos: sin botón. */}
      <div className="surface-panel flex flex-wrap items-end gap-3 p-4">
        <AutoSearchInput label="Buscar" placeholder="Estudiante, cédula o código..." />
        <AutoFilterSelect paramName="curso" label="Curso" options={courses.map((c) => ({ value: c.id, label: c.title }))} />
        <AutoFilterSelect
          paramName="estado"
          label="Estado"
          options={Object.entries(CERTIFICATE_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
        />
      </div>

      <div className="surface-glass overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Estudiante</TableHead>
              <TableHead>Curso</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Emitido</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {certificates.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No hay certificados con esos filtros.
                </TableCell>
              </TableRow>
            )}
            {certificates.map((certificate) => (
              <TableRow key={certificate.id}>
                <TableCell>
                  <p className="font-medium text-foreground">{certificate.user.fullName}</p>
                  <p className="text-xs text-muted-foreground">{certificate.user.documentNumber}</p>
                </TableCell>
                <TableCell className="text-muted-foreground">{certificate.course.title}</TableCell>
                <TableCell className="font-mono text-xs text-foreground">{certificate.certificateCode}</TableCell>
                <TableCell className="text-muted-foreground">
                  {certificate.issuedAt.toLocaleDateString("es-CO")}
                </TableCell>
                <TableCell>
                  <Badge className={CERTIFICATE_STATUS_CLASSES[certificate.status]}>
                    {CERTIFICATE_STATUS_LABELS[certificate.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    {certificate.pdfUrl && (
                      <Link
                        href={certificate.pdfUrl}
                        target="_blank"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-primary hover:bg-primary/10"
                        title="Descargar PDF"
                      >
                        <Download className="h-4 w-4" />
                      </Link>
                    )}
                    <form
                      action={async () => {
                        "use server";
                        await regenerateCertificateAction(certificate.id);
                      }}
                    >
                      <Button type="submit" variant="ghost" size="icon-sm" title="Regenerar PDF">
                        <RefreshCcw className="h-4 w-4" />
                      </Button>
                    </form>
                    {certificate.status === "VALID" ? (
                      <RevokeCertificateDialog certificateId={certificate.id} studentName={certificate.user.fullName} />
                    ) : (
                      <form
                        action={async () => {
                          "use server";
                          await restoreCertificateAction(certificate.id);
                        }}
                      >
                        <Button type="submit" variant="ghost" size="icon-sm" title="Reactivar">
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </form>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination total={totalCertificates} page={page} pageSize={pageSize} />
      </div>
      </StaggerSections>
    </div>
  );
}
