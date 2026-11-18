import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { TutorShell } from "@/components/tutor/tutor-shell";
import { gestionaGalardones } from "@/lib/galardones/acceso";
import { esCuentaSiau } from "@/lib/encuestas/acceso-siau";

export default async function TutorLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user || (session.user.role !== "TUTOR" && session.user.role !== "ADMIN")) {
    redirect("/login");
  }

  return (
    <TutorShell userName={session.user.name ?? "Tutor"} cuentaSiau={await esCuentaSiau(session)} gestionaGalardones={session.user.role === "TUTOR" && (await gestionaGalardones(session.user))}>
      {children}
    </TutorShell>
  );
}
