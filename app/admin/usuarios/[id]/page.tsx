import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { UserForm } from "@/components/admin/user-form";
import { ResetPasswordDialog } from "@/components/admin/reset-password-dialog";
import { updateUserAction } from "@/app/admin/usuarios/actions";
import { AdminPageHeader } from "@/components/admin/page-header";

export default async function EditarUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id } });

  if (!user) {
    notFound();
  }

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
          title={user.fullName}
          description={`Creado el ${user.createdAt.toLocaleDateString("es-CO")}${user.lastLoginAt ? ` · Último ingreso ${user.lastLoginAt.toLocaleDateString("es-CO")}` : ""}`}
          action={<ResetPasswordDialog userId={user.id} userName={user.fullName} />}
        />
      </div>

      <div className="surface max-w-3xl p-6">
        <UserForm
          mode="edit"
          action={boundAction}
          submitLabel="Guardar cambios"
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
          }}
        />
      </div>
    </div>
  );
}
