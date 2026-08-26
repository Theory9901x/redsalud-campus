import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireSurveyAccess } from "@/lib/auth-helpers";
import { getEncuestaParaConstructor } from "@/lib/encuestas/consultas";
import { Constructor } from "@/components/encuestas/constructor";

/**
 * CONSTRUCTOR de una encuesta: bloques, preguntas, material embebido,
 * apariencia y publicación, todo en una sola vista de trabajo.
 */
export default async function ConstructorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSurveyAccess(id).catch(() => notFound());

  const encuesta = await getEncuestaParaConstructor(id);
  if (!encuesta) notFound();

  return (
    <main className="canvas-vivo min-h-screen">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <Link
          href="/encuestas"
          className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Encuestas
        </Link>

        <Constructor
          encuesta={JSON.parse(JSON.stringify(encuesta))}
        />
      </div>
    </main>
  );
}
