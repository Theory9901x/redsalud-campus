import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { TutorShell } from "@/components/tutor/tutor-shell";

export default async function TutorLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user || (session.user.role !== "TUTOR" && session.user.role !== "ADMIN")) {
    redirect("/login");
  }

  return <TutorShell userName={session.user.name ?? "Tutor"}>{children}</TutorShell>;
}
