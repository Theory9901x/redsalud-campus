import { notFound } from "next/navigation";
import { CalendarClock, Lock } from "lucide-react";
import { auth } from "@/auth";
import { getEncuestaPublica, estaAbierta } from "@/lib/encuestas/consultas";
import { prisma } from "@/lib/prisma";
import { LanzadorFormulario } from "@/components/encuestas/lanzador-formulario";

/**
 * ENLACE PÚBLICO de una encuesta: `/e/<slug>`.
 *
 * Página AISLADA a propósito -sin barra lateral ni cabecera de la
 * plataforma-: quien la abre viene de un QR pegado en una cartelera o de un
 * mensaje, no está "dentro del campus", y meterle el mobiliario del sistema
 * alrededor solo distrae de responder.
 *
 * Funciona igual con sesión y sin ella. Con sesión la respuesta queda
 * atribuida a la persona; sin ella, se pide el nombre. Una encuesta de
 * satisfacción dirigida a la comunidad no puede exigir cuenta institucional,
 * y una interna tampoco debería obligar a cerrar sesión para responderse.
 */
export default async function EncuestaPublicaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const encuesta = await getEncuestaPublica(slug);
  if (!encuesta || encuesta.isTemplate) notFound();

  const sesion = await auth();
  const userId = sesion?.user?.id ?? null;
  const vigencia = estaAbierta(encuesta);

  // Si ya respondió y la encuesta no admite repetir, se le dice en vez de
  // dejarlo llenar todo para rechazarlo al final.
  const yaRespondio =
    userId && !encuesta.allowMultipleResponses
      ? await prisma.surveyResponse.findFirst({
          where: { surveyId: encuesta.id, userId, completed: true },
          select: { id: true, scorePercent: true },
        })
      : null;

  const acento = encuesta.themeColor || "#6D3BF5";

  if (!vigencia.abierta || yaRespondio || (encuesta.requireLogin && !userId)) {
    const { titulo, mensaje, Icono } = yaRespondio
      ? {
          titulo: "Ya respondiste esta encuesta",
          mensaje:
            yaRespondio.scorePercent !== null && encuesta.showScoreToRespondent
              ? `Tu resultado fue ${yaRespondio.scorePercent}%. Gracias por participar.`
              : "Tu respuesta quedó registrada. Gracias por participar.",
          Icono: CalendarClock,
        }
      : encuesta.requireLogin && !userId
        ? {
            titulo: "Esta encuesta pide iniciar sesión",
            mensaje: "Ingresa con tu cuenta institucional y vuelve a abrir este enlace.",
            Icono: Lock,
          }
        : { titulo: "No disponible", mensaje: vigencia.motivo ?? "", Icono: CalendarClock };

    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="surface-lumen max-w-md p-8 text-center">
          <span
            className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-white"
            style={{ backgroundColor: acento }}
          >
            <Icono className="h-6 w-6" aria-hidden="true" />
          </span>
          <h1 className="mt-5 font-display text-xl font-extrabold tracking-tight text-foreground">{titulo}</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{mensaje}</p>
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {encuesta.code} · Red Salud Casanare E.S.E.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-background">
      <LanzadorFormulario
        encuesta={{
          id: encuesta.id,
          title: encuesta.title,
          description: encuesta.description,
          coverImageUrl: encuesta.coverImageUrl,
          themeColor: encuesta.themeColor,
          estimatedMinutes: encuesta.estimatedMinutes,
          thankYouMessage: encuesta.thankYouMessage,
          pages: encuesta.pages.map((p) => ({
            id: p.id,
            title: p.title,
            description: p.description,
            attachmentUrl: p.attachmentUrl,
            attachmentName: p.attachmentName,
            questions: p.questions.map((q) => ({
              id: q.id,
              type: q.type,
              prompt: q.prompt,
              description: q.description,
              imageUrl: q.imageUrl,
              isRequired: q.isRequired,
              config: q.config,
            })),
          })),
        }}
        // Con sesión ya se sabe quién responde; sin ella hace falta el nombre.
        nombreRequerido={!userId}
      />
    </main>
  );
}
