import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Layers } from "lucide-react";
import { auth } from "@/auth";
import { getFirstLessonId } from "@/lib/aula";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function AulaIndexPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const firstLessonId = await getFirstLessonId(courseId);
  if (firstLessonId) {
    redirect(`/aula/${courseId}/${firstLessonId}`);
  }

  return (
    // Estado vacío claymórfico: ícono en blob de color suave + CTA de salida,
    // en vez del rectángulo punteado genérico.
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="surface-clay flex max-w-md flex-col items-center gap-4 px-8 py-12 text-center">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-[28px] text-primary"
          style={{
            background:
              "linear-gradient(135deg in oklch, color-mix(in oklch, var(--primary) 18%, transparent), color-mix(in oklch, var(--success) 14%, transparent))",
          }}
        >
          <Layers className="h-9 w-9" strokeWidth={1.5} />
        </div>
        <h1 className="font-display text-lg font-extrabold text-foreground">
          Este curso todavía no tiene contenido
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          El tutor está construyendo los módulos y lecciones. Vuelve más tarde para comenzar tu formación.
        </p>
        <Link href="/mi-aula" className={cn(buttonVariants(), "mt-2 gap-1.5")}>
          <ArrowLeft className="h-4 w-4" />
          Volver a mi aula
        </Link>
      </div>
    </div>
  );
}
