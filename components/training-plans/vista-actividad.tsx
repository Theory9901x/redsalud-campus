import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Layers } from "lucide-react";
import type { TrainingActivityStatus } from "@prisma/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModuloHero } from "@/components/training-plans/modulo-hero";
import { PildoraEstado } from "@/components/training-plans/plan-visual";
import { TRAINING_ACTIVITY_STATUS_LABELS, tituloLegible } from "@/components/training-plans/labels";

export type PestanaActividad = {
  valor: string;
  etiqueta: string;
  Icono: LucideIcon;
  conteo?: number;
  contenido: ReactNode;
};

/**
 * VISTA DE UNA CAPACITACIÓN (admin y tutor), organizada por flujo de trabajo:
 *
 *   1. Cabecera de mando: qué es, de qué área, y sus seis cifras en vivo.
 *   2. Barra de estado: estado + acciones del ciclo (ocultar, cerrar…).
 *   3. Pestañas en el orden en que se trabaja una jornada: agendarla y
 *      compartir sus accesos → tomar asistencia → evaluación → documentos →
 *      encuestas → la ficha del PIC → el informe final.
 *
 * Antes eran catorce bloques apilados uno debajo del otro (ficha, QR,
 * formulario, jornadas, conexiones, asistencia, curso, documentos…) y no se
 * entendía por dónde empezar.
 */
export function VistaActividad({
  volver,
  eyebrow,
  titulo,
  chips,
  estado,
  acciones,
  kpis,
  pestanas,
  pestanaInicial,
  trimestres,
}: {
  volver: { href: string; etiqueta: string };
  eyebrow: string;
  titulo: string;
  chips: { Icono: LucideIcon; contenido: ReactNode }[];
  estado: TrainingActivityStatus;
  acciones: ReactNode;
  kpis: { valor: string | number; etiqueta: string; detalle?: string }[];
  pestanas: PestanaActividad[];
  pestanaInicial?: string;
  /** Trimestres que se pueden revisar y el elegido (ver trimestresDeActividad). */
  trimestres?: { opciones: number[]; elegido: number; enCurso: number };
}) {
  return (
    <div className="space-y-5">
      <Link
        href={volver.href}
        className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {volver.etiqueta}
      </Link>

      <div className="space-y-3">
        <ModuloHero
          eyebrow={eyebrow}
          Icono={Layers}
          titulo={tituloLegible(titulo)}
          descripcion={
            <div className="flex flex-wrap items-center gap-2">
              {chips.map(({ Icono, contenido }, i) => (
                <span
                  key={i}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.06] px-2.5 py-1 text-[12.5px] text-white/85"
                >
                  <Icono className="h-3.5 w-3.5 shrink-0 text-[color-mix(in_oklch,var(--primary)_70%,white)]" aria-hidden="true" />
                  <span className="truncate">{contenido}</span>
                </span>
              ))}
            </div>
          }
          cifras={kpis}
          columnasCifras={6}
        />

        {/* Estado y acciones del ciclo: fuera del héroe, sobre fondo claro,
            para que los botones conserven su contraste. */}
        <div className="barra-modulo flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="mono-label">Estado</span>
            <PildoraEstado estado={estado}>{TRAINING_ACTIVITY_STATUS_LABELS[estado]}</PildoraEstado>
          </div>
          <div className="flex flex-wrap items-center gap-2">{acciones}</div>
        </div>
      </div>

      {trimestres && <SelectorTrimestre {...trimestres} />}

      <Tabs key={trimestres?.elegido} defaultValue={pestanaInicial ?? pestanas[0]?.valor}>
        <TabsList className="plan-tabs">
          {pestanas.map(({ valor, etiqueta, Icono, conteo }) => (
            <TabsTrigger key={valor} value={valor}>
              <Icono aria-hidden="true" />
              {etiqueta}
              {conteo !== undefined && <span className="conteo">{conteo}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
        {pestanas.map(({ valor, contenido }) => (
          <TabsContent key={valor} value={valor} className="space-y-6 pt-5">
            {contenido}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

/** Encabezado de sección dentro de una pestaña: título + bajada + acción a la derecha. */
export function SeccionActividad({
  titulo,
  bajada,
  accion,
  children,
}: {
  titulo: string;
  bajada?: string;
  accion?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-[1.05rem] font-bold tracking-tight text-foreground">{titulo}</h2>
          {bajada && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{bajada}</p>}
        </div>
        {accion}
      </div>
      {children}
    </section>
  );
}

const ROMANOS = ["I", "II", "III", "IV"];
const MESES = ["ene – mar", "abr – jun", "jul – sep", "oct – dic"];

/**
 * QUÉ TRIMESTRE SE ESTÁ REVISANDO. Una capacitación programada en varios
 * trimestres es una sola línea del PIC, pero cada trimestre es una ejecución
 * distinta: se elige aquí y todo lo de abajo sale solo de ese trimestre.
 */
function SelectorTrimestre({ opciones, elegido, enCurso }: { opciones: number[]; elegido: number; enCurso: number }) {
  return (
    <nav className="selector-trimestre" aria-label="Trimestre que se está revisando">
      <div className="selector-trimestre-cabeza">
        <span className="mono-label">Trimestre en revisión</span>
        <p>
          {opciones.length > 1
            ? "Esta capacitación se repite en varios trimestres. Cada uno se mide por separado: elige cuál revisar."
            : "Programada en un solo trimestre."}
        </p>
      </div>
      <div className="selector-trimestre-opciones">
        {[1, 2, 3, 4].map((t) => {
          const disponible = opciones.includes(t);
          const activo = t === elegido;
          const contenido = (
            <>
              <span className="st-sello">T{t}</span>
              <span className="st-texto">
                <b>Trimestre {ROMANOS[t - 1]}</b>
                <small>{MESES[t - 1]}</small>
              </span>
              {t === enCurso && (
                <span className="st-vivo">
                  <span className="punto-vivo" aria-hidden="true" />
                  En curso
                </span>
              )}
            </>
          );
          return disponible ? (
            <Link
              key={t}
              href={`?t=${t}`}
              scroll={false}
              className="st-opcion"
              data-activo={activo || undefined}
              aria-current={activo ? "page" : undefined}
            >
              {contenido}
            </Link>
          ) : (
            <span key={t} className="st-opcion" data-inactivo title="No programada en este trimestre">
              {contenido}
            </span>
          );
        })}
      </div>
    </nav>
  );
}
