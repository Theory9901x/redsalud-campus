import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { StudentHeader } from "@/components/student/student-header";
import { getUserAvatarUrl } from "@/lib/avatar";

export default async function EstudianteLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const avatarUrl = await getUserAvatarUrl(session.user.id);

  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background">
      <StudentHeader userName={session.user.name ?? ""} avatarUrl={avatarUrl} />
      {children}
    </div>
  );
}
