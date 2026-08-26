import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { requireSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

const FORMATO = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * MI RESULTADO: lo único de una encuesta que ve el estudiante.
 *
 * Muestra SU respuesta -cuándo la envió y su puntaje si la encuesta lo
 * publica-, nunca las de otros ni agregados: el resultado colectivo es de
 * quien gestiona.
 */
export default async function MiResultadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await requireSession();

  const respuesta = await prisma.surveyResponse.findFirst({
    where: { surveyId: id, userId: sesion.user.id, completed: true },
    orderBy: { submittedAt: "desc" },
    select: {
      submittedAt: true,
      scorePercent: true,
      scoreEarned: true,
      scorePossible: true,
      survey: { select: { title: true, code: true, themeColor: true, showScoreToRespondent: true } },
    },
  });
  // Solo existe esta página para quien de verdad respondió.
  if (!respuesta) notFound();

  const acento = respuesta.survey.themeColor || "#6D3BF5";
  const muestraPuntaje = respuesta.survey.showScoreToRespondent && respuesta.scorePercent !== null;

  return (
    <div>
      <div className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6">
        <Link
          href="/encuestas"
          className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Mis encuestas
        </Link>

        <div className="surface-vivo mt-6">
          <div className="p-8 text-center">
            <span
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl text-white shadow-lg"
              style={{ backgroundColor: acento, boxShadow: `0 20px 50px -22px ${acento}` }}
            >
              <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
            </span>
            <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: acento }}>
              {respuesta.survey.code}
            </p>
            <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-foreground">
              {respuesta.survey.title}
            </h1>
            {respuesta.submittedAt && (
              <p className="mt-2 text-[13px] text-muted-foreground">
                Respondida el {FORMATO.format(respuesta.submittedAt)}
              </p>
            )}

            {muestraPuntaje ? (
              <div className="mt-6 rounded-2xl border border-border/60 bg-card/60 p-6">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Tu resultado</p>
                <p
                  className={cn(
                    "mt-2 font-display text-[3rem] font-black leading-none tracking-tight",
                    respuesta.scorePercent! >= 85
                      ? "text-success"
                      : respuesta.scorePercent! >= 70
                        ? "text-warning-foreground"
                        : "text-destructive"
                  )}
                >
                  {respuesta.scorePercent}%
                </p>
                <p className="mt-2 text-[13px] text-muted-foreground">
                  {respuesta.scoreEarned} de {respuesta.scorePossible} puntos
                </p>
              </div>
            ) : (
              <p className="mt-6 rounded-2xl border border-border/60 bg-card/60 px-5 py-4 text-[13.5px] leading-relaxed text-muted-foreground">
                Tu participación quedó registrada como constancia. Esta encuesta no publica puntaje individual.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
