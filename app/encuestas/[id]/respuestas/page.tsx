import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Globe, Inbox, ListChecks, MonitorSmartphone } from "lucide-react";
import { requireSurveyRead } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { parsePageSize } from "@/lib/pagination";
import { TablePagination } from "@/components/admin/table-pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ModuloHero } from "@/components/training-plans/modulo-hero";
import { PildoraEstado } from "@/components/training-plans/plan-visual";
import { COLOR_SEMAFORO, NavFicha, tonoDe } from "@/components/encuestas/ficha-encuesta";

const FORMATO = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/**
 * RESPUESTAS INDIVIDUALES de una encuesta: quién, cuándo, completa o
 * abandonada, y su puntaje si la encuesta califica. Paginada; el detalle
 * pregunta a pregunta vive en el panel de resultados y en el CSV.
 */
export default async function RespuestasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const { id } = await params;
  const { page: pageParam, pageSize: pageSizeParam } = await searchParams;
  // soloConsulta: la cuenta SIAU en su encuesta (ve y exporta, no edita).
  const { soloConsulta } = await requireSurveyRead(id).catch(() => notFound());

  const encuesta = await prisma.survey.findUnique({
    where: { id },
    select: { title: true, code: true, themeColor: true },
  });
  if (!encuesta) notFound();

  const pagina = Math.max(Number(pageParam) || 1, 1);
  const porPagina = parsePageSize(pageSizeParam);

  const [total, filas] = await Promise.all([
    prisma.surveyResponse.count({ where: { surveyId: id } }),
    prisma.surveyResponse.findMany({
      where: { surveyId: id },
      orderBy: { startedAt: "desc" },
      skip: (pagina - 1) * porPagina,
      take: porPagina,
      select: {
        id: true,
        completed: true,
        startedAt: true,
        submittedAt: true,
        scorePercent: true,
        scoreEarned: true,
        scorePossible: true,
        respondentName: true,
        channel: true,
        user: { select: { fullName: true } },
      },
    }),
  ]);

  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const desde = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const hasta = Math.min(total, pagina * porPagina);

  return (
    <div className="space-y-5">
      <Link
        href="/encuestas"
        className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Encuestas
      </Link>

      <div className="space-y-3">
        <ModuloHero
          eyebrow={`Respuestas individuales · ${encuesta.code}`}
          Icono={ListChecks}
          titulo={encuesta.title}
          descripcion="Quién respondió, cuándo, por qué canal y con qué resultado. El detalle pregunta a pregunta está en Resultados y en sus exportables."
          cifras={[
            { valor: total, etiqueta: "Respuestas registradas" },
            { valor: total === 0 ? "—" : `${desde}–${hasta}`, etiqueta: "En esta página" },
            { valor: `${Math.min(pagina, paginas)}/${paginas}`, etiqueta: "Página" },
            { valor: porPagina, etiqueta: "Registros por página" },
          ]}
        />
        <div className="barra-modulo flex flex-wrap items-center justify-between gap-3 p-2.5">
          <NavFicha id={id} activa="respuestas" editable={!soloConsulta} />
          <p className="mono-label px-2">Ordenadas de la más reciente a la más antigua</p>
        </div>
      </div>

      <div className="tabla-modulo">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">#</TableHead>
                <TableHead>Encuestado</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Puntaje</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-14 text-center">
                    <span className="flex flex-col items-center gap-2">
                      <Inbox className="h-6 w-6 text-primary" aria-hidden="true" />
                      <span className="font-display text-[14px] font-bold text-foreground">Nadie ha respondido todavía</span>
                      <span className="text-[12.5px] text-muted-foreground">Comparte el enlace público o el QR desde Resultados.</span>
                    </span>
                  </TableCell>
                </TableRow>
              )}
              {filas.map((r, i) => {
                const numero = total - (pagina - 1) * porPagina - i;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-[11.5px] text-muted-foreground">{String(numero).padStart(3, "0")}</TableCell>
                    <TableCell className="font-medium text-foreground">
                      {r.user?.fullName ?? r.respondentName ?? `Respuesta #${numero}`}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-mono text-[12px] text-muted-foreground">
                      {FORMATO.format(r.submittedAt ?? r.startedAt)}
                    </TableCell>
                    <TableCell>
                      <span className="chip-dato">
                        {r.channel === "publico" ? <Globe aria-hidden="true" /> : <MonitorSmartphone aria-hidden="true" />}
                        {r.channel === "publico" ? "Enlace público" : "Plataforma"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <PildoraEstado estado={r.completed ? "ACTIVE" : "CLOSED"} className={r.completed ? "[&_.punto-vivo::after]:hidden" : undefined}>
                        {r.completed ? "Completa" : "Abandonada"}
                      </PildoraEstado>
                    </TableCell>
                    <TableCell className="text-right">
                      {r.scorePercent !== null ? (
                        <span
                          className="font-mono text-[12.5px] font-semibold tabular-nums"
                          style={{ color: COLOR_SEMAFORO[tonoDe(r.scorePercent)] }}
                        >
                          {r.scoreEarned}/{r.scorePossible} · {r.scorePercent}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <TablePagination total={total} page={pagina} pageSize={porPagina} />
      </div>
    </div>
  );
}
