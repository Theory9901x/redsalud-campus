import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, CalendarClock, CalendarRange, User } from "lucide-react";
import { requireSession } from "@/lib/auth-helpers";
import { getTrainingPlanDetailForStudent } from "@/lib/training-plans";
import { getAgendaEstudiante } from "@/lib/agenda-estudiante";
import { SeccionAgenda } from "@/components/agenda/fila-agenda";
import { ListasAgenda } from "@/components/agenda/listas-agenda";
import { RegistroDocumentos, type DocumentoRegistro } from "@/components/documentos/registro-documentos";
import { TRAINING_PLAN_STATUS_LABELS } from "@/components/training-plans/labels";

export const dynamic = "force-dynamic";

/**
 * Avisos con los que aterrizan los enlaces QR (/c/...) cuando el momento que
 * pedían no está abierto: cada enlace responde por SU momento -escanear el
 * QR de postsaber nunca abre el presaber, aunque sea la misma evaluación-.
 */
const AVISOS_QR: Record<string, string> = {
  "presaber-sin-habilitar": "El presaber de esta capacitación todavía no está habilitado. El área lo abre al iniciar la jornada; vuelve a escanear el código cuando lo anuncien.",
  "presaber-cerrado": "El presaber de esta capacitación ya cerró. Si la jornada continúa, el siguiente paso es el postsaber cuando el área lo habilite.",
  "postsaber-sin-habilitar": "El postsaber todavía no está habilitado. Se abre después de la capacitación; vuelve a escanear el código cuando el área lo anuncie.",
  "postsaber-cerrado": "El postsaber de esta capacitación ya cerró. Tu resultado quedó registrado con los intentos que presentaste.",
  "postsaber-requiere-presaber": "El postsaber se habilita al presentar primero el presaber: escanea o abre el enlace del presaber y preséntalo; el postsaber se abre solo inmediatamente después.",
  "presaber-ya-presentado": "Ya presentaste el presaber de esta capacitación: tu siguiente paso es el postsaber, con su propio enlace o código QR.",
  // Bloqueos de entrada (mismos para el QR y para el botón de la agenda).
  "sin-contenido": "Esta capacitación todavía no tiene contenido publicado. El área lo está preparando; aparecerá aquí en cuanto lo suba.",
  "no-habilitada": "Esta capacitación todavía no está disponible. Aparecerá en cuanto el área termine de programarla.",
  "jornada-cerrada": "Esta jornada ya se cerró: quedó como consulta y no admite nuevas presentaciones ni registros de asistencia.",
  "fuera-de-audiencia": "Esta capacitación está dirigida a otro grupo de personal, así que no queda registrada en tu plan.",
};

/**
 * Ficha de UN plan para el estudiante: su agenda dentro de ese plan y los
 * documentos del plan. Nada más.
 *
 * Antes tenía un hero con cuatro cifras y un anillo, tres pestañas, buscador,
 * seis filtros, cuatro acordeones por trimestre con siete columnas y un panel
 * lateral con tres tarjetas. Ahora se lee igual que «Mis capacitaciones»: las
 * mismas filas, de la misma fuente (lib/agenda-estudiante.ts) y con la misma
 * regla de las 24 horas. Las evaluaciones viven en su módulo.
 */
export default async function MiCapacitacionDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aviso?: string }>;
}) {
  const { id } = await params;
  const { aviso } = await searchParams;
  const avisoQr = aviso ? AVISOS_QR[aviso] ?? null : null;
  const session = await requireSession();

  const plan = await getTrainingPlanDetailForStudent(id, session.user.id);
  if (!plan) notFound();

  const filas = (await getAgendaEstudiante(session.user.id)).filter((f) => f.planId === id);

  const meta = [
    { Icono: CalendarRange, texto: `Vigencia ${plan.year}` },
    { Icono: Building2, texto: plan.targetDepartment ?? "Todo el personal" },
    { Icono: User, texto: plan.tutor.fullName },
  ];

  return (
    <main className="canvas-formacion min-h-full flex-1">
      <div className="mx-auto w-full max-w-[1280px] space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/mis-capacitaciones"
          className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Mis capacitaciones
        </Link>

        {avisoQr && (
          <div className="agenda-panel flex items-start gap-3 border-l-4 border-l-warning p-5" role="status">
            <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-warning-foreground" aria-hidden="true" />
            <p className="text-sm text-foreground">{avisoQr}</p>
          </div>
        )}

        <header>
          <p className="text-sm font-semibold text-primary">Plan de capacitación · {TRAINING_PLAN_STATUS_LABELS[plan.status]}</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-foreground">{plan.title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
            {meta.map((m) => (
              <span key={m.texto} className="inline-flex items-center gap-1.5">
                <m.Icono className="h-4 w-4" aria-hidden="true" />
                {m.texto}
              </span>
            ))}
          </p>
        </header>

        <ListasAgenda
          filas={filas}
          vacio={{
            titulo: "Nada vigente en este plan por ahora",
            texto: "Las capacitaciones que ya pasaron dejan de mostrarse; las próximas aparecerán aquí cuando el área las programe.",
          }}
        />

        <SeccionAgenda titulo="Documentos del plan" conteo={plan.documents.length} ayuda="Material que el área publicó para este plan.">
          <div className="p-4">
            <RegistroDocumentos
              documentos={plan.documents as DocumentoRegistro[]}
              vacio="Este plan todavía no tiene documentos publicados."
            />
          </div>
        </SeccionAgenda>
      </div>
    </main>
  );
}
