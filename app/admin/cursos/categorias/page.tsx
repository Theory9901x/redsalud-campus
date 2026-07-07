import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
import { CategoryFormDialog } from "@/components/admin/category-form-dialog";
import { ToggleCategoryButton } from "@/components/admin/toggle-category-button";
import { createCategoryAction, updateCategoryAction } from "./actions";

export default async function CategoriasPage() {
  const categories = await prisma.courseCategory.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { courses: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/cursos"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a cursos
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-extrabold text-foreground">Categorías</h1>
            <p className="text-sm text-muted-foreground">
              Organizan el catálogo público de cursos en {categories.length}{" "}
              {categories.length === 1 ? "categoría" : "categorías"}.
            </p>
          </div>
          <CategoryFormDialog mode="create" action={createCategoryAction} />
        </div>
      </div>

      <div className="surface overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead>Cursos</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Aún no hay categorías.
                </TableCell>
              </TableRow>
            )}
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell className="font-medium text-foreground">{category.name}</TableCell>
                <TableCell className="max-w-sm truncate text-muted-foreground">
                  {category.description}
                </TableCell>
                <TableCell className="text-muted-foreground">{category._count.courses}</TableCell>
                <TableCell>
                  <Badge className={category.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                    {category.isActive ? "Activa" : "Inactiva"}
                  </Badge>
                </TableCell>
                <TableCell className="flex justify-end gap-2">
                  <CategoryFormDialog
                    mode="edit"
                    action={updateCategoryAction.bind(null, category.id)}
                    defaultValues={{ name: category.name, description: category.description ?? "" }}
                  />
                  <ToggleCategoryButton categoryId={category.id} isActive={category.isActive} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
