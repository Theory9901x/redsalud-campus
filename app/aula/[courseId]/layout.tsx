import { redirect } from "next/navigation";
import Link from "next/link";
import { Activity, ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { getAulaData } from "@/lib/aula";
import { AulaSidebar } from "@/components/aula/aula-sidebar";

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
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3.5 sm:px-6">
        <Link href="/inicio" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Mi panel
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" strokeWidth={2.5} />
          <span className="font-display text-sm font-extrabold text-foreground">RedSalud Forma</span>
        </div>
      </header>

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
