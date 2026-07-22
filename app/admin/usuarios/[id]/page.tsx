import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, GraduationCap, Award } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UserForm } from "@/components/admin/user-form";
import { ResetPasswordDialog } from "@/components/admin/reset-password-dialog";
import { CancelEnrollmentButton } from "@/components/admin/cancel-enrollment-button";
import { UserEnrollForm } from "@/components/admin/user-enroll-form";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/brand/empty-state";
import { ENROLLMENT_STATUS_LABELS, ENROLLMENT_STATUS_CLASSES } from "@/components/cursos/labels";
import { CERTIFICATE_STATUS_LABELS, CERTIFICATE_STATUS_CLASSES } from "@/components/certificados/labels";
import { updateUserAction } from "@/app/admin/usuarios/actions";
import { AdminPageHeader } from "@/components/admin/page-header";
import { MarcaPlanta, VINCULACION_LABELS, esPlanta } from "@/components/admin/marca-planta";
import { PERSONNEL_TYPE_LABELS } from "@/lib/personnel-labels";

export default async function EditarUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [session, user] = await Promise.all([auth(), prisma.user.findUnique({ where: { id }, include: { municipio: true, cargo: true } })]);

  if (!user) {
    notFound();
  }

  const isStudent = user.role === "STUDENT";
  const [enrollments, certificates, courses] = await Promise.all([
    isStudent
      ? prisma.enrollment.findMany({
          where: { userId: id },
          orderBy: { enrolledAt: "desc" },
          include: { course: { select: { title: true, slug: true } } },
        })
      : Promise.resolve([]),
    isStudent
      ? prisma.certificate.findMany({
          where: { userId: id },
          orderBy: { issuedAt: "desc" },
          include: { course: { select: { title: true } } },
        })
      : Promise.resolve([]),
    isStudent ? prisma.course.findMany({ orderBy: { title: "asc" }, select: { id: true, title: true } }) : Promise.resolve([]),
  ]);

  const boundAction = updateUserAction.bind(null, user.id);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/usuarios"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a usuarios
        </Link>
        <AdminPageHeader
          title={`${esPlanta(user.tipoVinculacion) ? "⭐ " : ""}${user.fullName}`}
          description={`Creado el ${user.createdAt.toLocaleDateString("es-CO")}${user.lastLoginAt ? ` · Último ingreso ${user.lastLoginAt.toLocaleDateString("es-CO")}` : ""}`}
          action={<ResetPasswordDialog userId={user.id} userName={user.fullName} />}
        />
      </div>

      {/* Ficha completa: lo que la base sabe de la persona, de un vistazo. */}
      <div className="surface-glass max-w-3xl p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <MarcaPlanta tipo={user.tipoVinculacion} />
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
            Ficha del funcionario
          </h2>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
            {VINCULACION_LABELS[user.tipoVinculacion]}
          </span>
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          {[
            ["Documento", `${user.documentType} ${user.documentNumber}`],
            ["Correo", user.email],
            ["Usuario de acceso", user.username ?? "—"],
            ["Teléfono", user.phone ?? "—"],
            ["Municipio", user.municipio?.nombre ?? "—"],
            ["Cargo", user.cargo?.nombre ?? user.position ?? "—"],
            ["Grupo poblacional", PERSONNEL_TYPE_LABELS[user.personnelType]],
            ["Dependencia", user.department ?? "—"],
            ["Origen del registro", user.origenRegistro === "IMPORTACION" ? "Importado del plan de cargos" : "Creado en la plataforma"],
            ["Último ingreso", user.lastLoginAt ? user.lastLoginAt.toLocaleString("es-CO") : "Nunca ha ingresado"],
          ].map(([etiqueta, valor]) => (
            <div key={etiqueta} className="flex justify-between gap-3 border-b border-border/60 pb-2">
              <dt className="text-muted-foreground">{etiqueta}</dt>
              <dd className="text-right font-medium text-foreground">{valor}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="surface max-w-3xl p-6">
        <UserForm
          mode="edit"
          action={boundAction}
          submitLabel="Guardar cambios"
          isOwnAccount={session?.user.id === user.id}
          defaultValues={{
            fullName: user.fullName,
            documentType: user.documentType,
            documentNumber: user.documentNumber,
            email: user.email,
            phone: user.phone ?? "",
            profession: user.profession ?? "",
            position: user.position ?? "",
            department: user.department ?? "",
            personnelType: user.personnelType,
            role: user.role,
            status: user.status,
            restrictedAdminSections: user.restrictedAdminSections,
          }}
        />
      </div>

      {isStudent && (
        <>
          <div className="max-w-3xl space-y-3">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg font-bold text-foreground">
                Cursos ({enrollments.length})
              </h2>
            </div>
            <div className="surface p-4">
              <UserEnrollForm userId={user.id} courses={courses} />
            </div>
            {enrollments.length === 0 ? (
              <EmptyState icon={GraduationCap} title="Sin inscripciones todavía" className="py-8" />
            ) : (
              <div className="surface-panel divide-y divide-slate-300 overflow-hidden dark:divide-slate-700">
                {enrollments.map((enrollment) => (
                  <div key={enrollment.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/cursos`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {enrollment.course.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        Inscrito el {enrollment.enrolledAt.toLocaleDateString("es-CO")} · {enrollment.progressPercentage}% de avance
                        {enrollment.finalScore !== null && ` · Nota final ${enrollment.finalScore}%`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge className={ENROLLMENT_STATUS_CLASSES[enrollment.status]}>
                        {ENROLLMENT_STATUS_LABELS[enrollment.status]}
                      </Badge>
                      <CancelEnrollmentButton enrollmentId={enrollment.id} status={enrollment.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="max-w-3xl space-y-3">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" />
              <h2 className="font-display text-lg font-bold text-foreground">
                Certificados ({certificates.length})
              </h2>
            </div>
            {certificates.length === 0 ? (
              <EmptyState icon={Award} title="Sin certificados emitidos" className="py-8" />
            ) : (
              <div className="surface-panel divide-y divide-slate-300 overflow-hidden dark:divide-slate-700">
                {certificates.map((certificate) => (
                  <div key={certificate.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{certificate.course.title}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {certificate.certificateCode} · Emitido el {certificate.issuedAt.toLocaleDateString("es-CO")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge className={CERTIFICATE_STATUS_CLASSES[certificate.status]}>
                        {CERTIFICATE_STATUS_LABELS[certificate.status]}
                      </Badge>
                      {certificate.pdfUrl && (
                        <Link
                          href={certificate.pdfUrl}
                          target="_blank"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-primary hover:bg-primary/10"
                          title="Descargar"
                        >
                          <Download className="h-4 w-4" />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
