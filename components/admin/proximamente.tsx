import { Sparkles } from "lucide-react";

export function Proximamente({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card py-24 text-center">
      <Sparkles className="h-8 w-8 text-primary" strokeWidth={1.5} />
      <h2 className="font-display text-xl font-extrabold text-foreground">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      <span className="mt-2 rounded-full bg-warning/15 px-3 py-1 text-xs font-semibold text-warning-foreground">
        Próximamente
      </span>
    </div>
  );
}
