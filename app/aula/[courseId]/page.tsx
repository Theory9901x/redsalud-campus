import { redirect } from "next/navigation";
import { Layers } from "lucide-react";
import { auth } from "@/auth";
import { getFirstLessonId } from "@/lib/aula";
import { EmptyState } from "@/components/brand/empty-state";

export default async function AulaIndexPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const firstLessonId = await getFirstLessonId(courseId);
  if (firstLessonId) {
    redirect(`/aula/${courseId}/${firstLessonId}`);
  }

  return (
    <EmptyState
      icon={Layers}
      title="Este curso todavía no tiene contenido"
      description="El tutor está construyendo los módulos y lecciones. Vuelve más tarde."
    />
  );
}
