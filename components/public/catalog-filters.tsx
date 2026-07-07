import Link from "next/link";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function CatalogFilters({
  categories,
  activeCategoria,
  q,
  basePath,
}: {
  categories: { id: string; name: string }[];
  activeCategoria?: string;
  q?: string;
  basePath: string;
}) {
  return (
    <div className="space-y-4">
      <form method="get" className="mx-auto flex max-w-xl items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-sm">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar cursos..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-gradient-to-r from-primary to-teal-400 px-4 py-1.5 text-xs font-semibold text-white"
        >
          Buscar
        </button>
      </form>

      <div className="flex flex-wrap justify-center gap-2">
        <Link
          href={basePath}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
            !activeCategoria
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
          )}
        >
          Todos
        </Link>
        {categories.map((category) => (
          <Link
            key={category.id}
            href={`${basePath}?categoria=${category.id}`}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
              activeCategoria === category.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
            )}
          >
            {category.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
