import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { requireSurveyAccess } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { parsePageSize } from "@/lib/pagination";
import { TablePagination } from "@/components/admin/table-pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

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
  await requireSurveyAccess(id).catch(() => notFound());

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

  const acento = encuesta.themeColor || "#6D3BF5";

  return (
    <main className="canvas-vivo min-h-screen">
      <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        <Link
          href="/encuestas"
          className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Encuestas
        </Link>

        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: acento }}>
              Respuestas · {encuesta.code}
            </p>
            <h1 className="mt-1 font-display text-[clamp(1.5rem,3.2vw,2rem)] font-extrabold leading-tight tracking-tight text-foreground">
              {encuesta.title}
            </h1>
            <p className="mt-1 text-[13px] text-muted-foreground">{total} respuestas registradas</p>
          </div>
          <Link
            href={`/encuestas/${id}/resultados`}
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-bold text-white"
            style={{ backgroundColor: acento }}
          >
            <BarChart3 className="h-4 w-4" />
            Resultados
          </Link>
        </header>

        <div className="surface-lumen overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
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
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    Nadie ha respondido todavía.
                  </TableCell>
                </TableRow>
              )}
              {filas.map((r, i) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium text-foreground">
                    {r.user?.fullName ?? r.respondentName ?? `Respuesta #${total - (pagina - 1) * porPagina - i}`}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{FORMATO.format(r.submittedAt ?? r.startedAt)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.channel === "publico" ? "Enlace público" : "Plataforma"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold",
                        r.completed
                          ? "border-success/40 bg-success/10 text-success"
                          : "border-border/60 bg-muted/40 text-muted-foreground"
                      )}
                    >
                      {r.completed ? "Completa" : "Abandonada"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {r.scorePercent !== null ? (
                      <span
                        className={cn(
                          "font-bold tabular-nums",
                          r.scorePercent >= 85 ? "text-success" : r.scorePercent >= 70 ? "text-warning-foreground" : "text-destructive"
                        )}
                      >
                        {r.scoreEarned}/{r.scorePossible} ({r.scorePercent}%)
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination total={total} page={pagina} pageSize={porPagina} />
        </div>
      </div>
    </main>
  );
}
