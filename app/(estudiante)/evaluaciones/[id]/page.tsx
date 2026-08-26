import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/auth-helpers";

/**
 * Ruta heredada: una encuesta se responde SIEMPRE en `/e/<slug>`.
 *
 * Ese formulario ya funciona igual con sesión y sin ella, así que mantener
 * aquí un segundo renderizador solo garantizaba que los dos se
 * desincronizaran -uno con los tipos de pregunta nuevos y el otro no-. Los
 * enlaces viejos siguen sirviendo: se resuelve el slug y se redirige.
 */
export default async function EvaluacionRedireccion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireSession();

  const encuesta = await prisma.survey.findUnique({ where: { id }, select: { slug: true } });
  if (!encuesta) notFound();

  redirect(`/e/${encuesta.slug}`);
}
