import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth-helpers";
import { crearComiteAction } from "@/app/admin/comites/actions";
import { FormularioNuevoComite } from "@/components/comites/formularios";
import { AdminPageHeader } from "@/components/admin/page-header";

export default async function NuevoComitePage() {
  await requireAdmin();
  return (
    <div className="space-y-6">
      <Link href="/admin/comites" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Comités
      </Link>
      <AdminPageHeader title="Nuevo comité" description="Conformado por resolución. Luego se cargan sus integrantes por zona, cargo y rol." />
      <div className="surface-glass max-w-3xl p-6">
        <FormularioNuevoComite action={crearComiteAction} />
      </div>
    </div>
  );
}
