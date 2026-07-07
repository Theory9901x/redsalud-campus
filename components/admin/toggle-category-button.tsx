import { Button } from "@/components/ui/button";
import { toggleCategoryActiveAction } from "@/app/admin/cursos/categorias/actions";

export function ToggleCategoryButton({ categoryId, isActive }: { categoryId: string; isActive: boolean }) {
  return (
    <form
      action={async () => {
        "use server";
        await toggleCategoryActiveAction(categoryId);
      }}
    >
      <Button type="submit" size="sm" variant={isActive ? "destructive" : "default"}>
        {isActive ? "Desactivar" : "Activar"}
      </Button>
    </form>
  );
}
