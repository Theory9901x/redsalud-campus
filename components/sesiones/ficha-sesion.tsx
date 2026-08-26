import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { requireTrainingActivityAccess } from "@/lib/auth-helpers";
import { BotonImprimir } from "@/components/sesiones/boton-imprimir";

const FORMATO_FECHA = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const FORMATO_HORA = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit" });

/**
 * FASE 10 — Ficha PROYECTABLE de una sesión presencial: el QR grande para
 * el auditorio, con el nombre de la capacitación, fecha, lugar y la URL
 * legible. Un solo cartel sirve toda la jornada: la página del QR cambia
 * con la fase, el cartel no.
 *
 * `@media print` deja solo el cartel: se imprime o se proyecta tal cual.
 */
export async function FichaSesion({ sesionId, activityId }: { sesionId: string; activityId: string }) {
  const sesion = await prisma.trainingSession.findUnique({
    where: { id: sesionId },
    include: {
      activity: { select: { id: true, title: true, area: { select: { name: true } } } },
      municipio: { select: { nombre: true } },
    },
  });
  if (!sesion || sesion.activityId !== activityId) notFound();
  await requireTrainingActivityAccess(activityId);

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = `${base}/s/${sesion.tokenPublico}`;
  // Grande y con margen: debe leerse a 3 metros proyectado en el auditorio.
  const qr = await QRCode.toDataURL(url, { width: 640, margin: 2 });

  return (
    <main className="min-h-screen bg-background print:bg-white">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-6 py-10">
        <div className="w-full rounded-3xl border border-border/60 bg-card p-10 text-center shadow-xl print:rounded-none print:border-0 print:shadow-none">
          <p className="text-[13px] font-bold uppercase tracking-[0.2em] text-primary">
            Red Salud Casanare E.S.E. · {sesion.activity.area?.name ?? "Capacitación"}
          </p>
          <h1 className="mt-3 font-display text-[clamp(1.8rem,4vw,2.6rem)] font-extrabold leading-tight tracking-tight text-foreground">
            {sesion.activity.title}
          </h1>
          <p className="mt-3 text-[16px] text-muted-foreground">
            {FORMATO_FECHA.format(sesion.startsAt)} · {FORMATO_HORA.format(sesion.startsAt)}
            {sesion.endsAt ? ` – ${FORMATO_HORA.format(sesion.endsAt)}` : ""}
          </p>
          {(sesion.location || sesion.municipio) && (
            <p className="mt-1 text-[15px] font-semibold text-foreground">
              {[sesion.location, sesion.municipio?.nombre].filter(Boolean).join(" · ")}
            </p>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt={`Código QR de la sesión: ${url}`} className="mx-auto mt-8 w-full max-w-[420px]" />

          <p className="mt-6 text-[17px] font-bold text-foreground">Escanea para registrar tu asistencia</p>
          <p className="mt-1 text-[14px] text-muted-foreground">
            El mismo código abre el presaber y el postsaber cuando el facilitador lo anuncie.
          </p>
          <p className="mt-5 rounded-xl bg-muted/50 px-4 py-2.5 font-mono text-[15px] font-semibold tracking-wide text-foreground print:bg-transparent print:border print:border-border">
            {url.replace(/^https?:\/\//, "")}
          </p>
        </div>

        <BotonImprimir />
      </div>
    </main>
  );
}
