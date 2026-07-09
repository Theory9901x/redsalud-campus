import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getAulaData } from "@/lib/aula";
import { AulaSidebar } from "@/components/aula/aula-sidebar";
import { AulaHeader } from "@/components/aula/aula-header";

export default async function AulaLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const data = await getAulaData(courseId, session.user.id);
  if (!data) redirect("/no-autorizado");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AulaHeader
        courseId={courseId}
        title={data.course.title}
        imageUrl={data.course.imageUrl}
        courseType={data.course.courseType}
        durationHours={data.course.durationHours}
        progress={data.enrollment.progressPercentage}
      />

      <div className="flex flex-1 flex-col lg:flex-row">
        <AulaSidebar
          courseId={courseId}
          courseTitle={data.course.title}
          progress={data.enrollment.progressPercentage}
          modules={data.modules}
          finalQuizzes={data.finalQuizzes}
        />
        <main className="flex-1 px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
