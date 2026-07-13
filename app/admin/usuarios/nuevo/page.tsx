import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { UserForm } from "@/components/admin/user-form";
import { createUserAction } from "@/app/admin/usuarios/actions";
import { AdminPageHeader } from "@/components/admin/page-header";

export default function NuevoUsuarioPage() {
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
          title="Nuevo usuario"
          description="Se creará la cuenta con una contraseña temporal; el usuario deberá cambiarla al ingresar."
        />
      </div>

      <div className="surface max-w-3xl p-6">
        <UserForm mode="create" action={createUserAction} submitLabel="Crear usuario" />
      </div>
    </div>
  );
}
