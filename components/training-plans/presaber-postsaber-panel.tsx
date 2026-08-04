"use client";

import { useTransition } from "react";
import { PlayCircle, Lock, ArrowRight, TrendingUp, TrendingDown, Minus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { estadoPresaber, estadoPostsaber, puedeHabilitarPostsaber, compararAdherencia, cicloEsAutomatico } from "@/lib/presaber-postsaber";
import type { EvaluationCycleState } from "@/app/admin/planes-capacitacion/actions";

type Ventanas = {
  presaberOpenedAt: Date | null;
  presaberClosedAt: Date | null;
  postsaberOpenedAt: Date | null;
  postsaberClosedAt: Date | null;
};

export type ResumenPresaberPostsaber = {
  presaberPromedio: number | null;
  presaberCantidad: number;
  postsaberPromedio: number | null;
  postsaberCantidad: number;
};

function Boton({
  etiqueta,
  icono: Icono,
  variant = "default",
  pendiente,
  onClick,
  confirmar,
}: {
  etiqueta: string;
  icono: typeof PlayCircle;
  variant?: "default" | "destructive" | "outline";
  pendiente: boolean;
  onClick: () => void;
  /** Si se da, el botón pide confirmación antes de ejecutar -para cerrar, que es irreversible. */
  confirmar?: { titulo: string; descripcion: string };
}) {
  if (!confirmar) {
    return (
      <Button type="button" size="sm" variant={variant} disabled={pendiente} onClick={onClick} className="gap-1.5">
        <Icono className="h-3.5 w-3.5" />
        {etiqueta}
      </Button>
    );
  }
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button type="button" size="sm" variant={variant} disabled={pendiente} className="gap-1.5" />}>
        <Icono className="h-3.5 w-3.5" />
        {etiqueta}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{confirmar.titulo}</AlertDialogTitle>
          <AlertDialogDescription>{confirmar.descripcion}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onClick}>{etiqueta}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * El ciclo presaber/postsaber: la misma evaluación, presentada dos veces.
 * Dos ventanas independientes -no un solo estado-, porque el postsaber no
 * puede abrirse antes de que el presaber cierre, y hay que poder mostrar
 * las dos por separado mientras eso pasa.
 */
export function PresaberPostsaberPanel({
  ventanas,
  etiquetas,
  resumen,
  onOpenPresaber,
  onClosePresaber,
  onOpenPostsaber,
  onClosePostsaber,
}: {
  ventanas: Ventanas;
  /**
   * Las cuatro fechas ya formateadas, calculadas en el servidor.
   *
   * Formatear un Date con Intl aquí -en un componente de cliente- puede
   * hidratar distinto de como lo renderizó el servidor: el ICU del
   * navegador y el de Node a veces difieren en un espacio invisible dentro
   * de la misma hora, y React lo marca como mismatch. Ya pasó una vez en
   * este módulo (ActivityLifecycleActions.closedAtLabel) y es la razón de
   * que ese prop también llegue pre-formateado.
   */
  etiquetas: {
    presaberOpened: string | null;
    presaberClosed: string | null;
    postsaberOpened: string | null;
    postsaberClosed: string | null;
  };
  resumen: ResumenPresaberPostsaber;
  onOpenPresaber: () => Promise<EvaluationCycleState>;
  onClosePresaber: () => Promise<EvaluationCycleState>;
  onOpenPostsaber: () => Promise<EvaluationCycleState>;
  onClosePostsaber: () => Promise<EvaluationCycleState>;
}) {
  const [pendiente, iniciar] = useTransition();

  function ejecutar(fn: () => Promise<EvaluationCycleState>) {
    iniciar(async () => {
      const r = await fn();
      if (r.error) toast.error(r.error);
    });
  }

  const presaber = estadoPresaber(ventanas);
  const postsaber = estadoPostsaber(ventanas);
  const puedeAbrirPostsaber = puedeHabilitarPostsaber(ventanas);
  const automatico = cicloEsAutomatico(ventanas);

  const hayComparacion = resumen.presaberPromedio !== null && resumen.postsaberPromedio !== null;
  const comparacion = hayComparacion
    ? compararAdherencia(resumen.presaberPromedio!, resumen.postsaberPromedio!)
    : null;

  return (
    <div className="surface-panel space-y-5 p-6">
      <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
        Ciclo presaber / postsaber
      </h2>
      <p className="text-xs text-muted-foreground">
        Es la misma evaluación, presentada antes de la capacitación y otra vez después, para medir lo que se
        aprendió.
      </p>

      {automatico && (
        <div className="flex items-start gap-2.5 rounded-xl border border-success/25 bg-success/10 p-3.5">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-foreground">
            <span className="font-bold">Ciclo automático activo:</span> el presaber está siempre disponible y el
            postsaber se habilita solo, persona por persona, en cuanto cada quien presenta su presaber. No tienes
            que habilitar nada. Los botones de abajo son el control manual: si abres una ventana a mano, tomas el
            mando del ciclo para toda la jornada.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="surface space-y-2 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Presaber</p>
          {presaber === "NO_CONFIGURADO" && (
            <Boton etiqueta="Habilitar presaber" icono={PlayCircle} pendiente={pendiente} onClick={() => ejecutar(onOpenPresaber)} />
          )}
          {presaber === "DISPONIBLE" && (
            <>
              <p className="text-xs text-success">
                Abierto desde {etiquetas.presaberOpened ?? "—"}
              </p>
              <Boton
                etiqueta="Cerrar presaber"
                icono={Lock}
                variant="destructive"
                pendiente={pendiente}
                onClick={() => ejecutar(onClosePresaber)}
                confirmar={{
                  titulo: "¿Cerrar el presaber?",
                  descripcion:
                    "Nadie más podrá presentarlo. El postsaber se podrá habilitar después de esto -se presenta antes de la capacitación, no en paralelo con ella-.",
                }}
              />
            </>
          )}
          {presaber === "CERRADO" && (
            <p className="text-xs text-muted-foreground">
              Cerrado el {etiquetas.presaberClosed ?? "—"}
              {resumen.presaberCantidad > 0 && ` · ${resumen.presaberCantidad} lo presentaron`}
            </p>
          )}
        </div>

        <div className="surface space-y-2 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Postsaber</p>
          {postsaber === "NO_CONFIGURADO" && puedeAbrirPostsaber && (
            <Boton etiqueta="Habilitar postsaber" icono={PlayCircle} pendiente={pendiente} onClick={() => ejecutar(onOpenPostsaber)} />
          )}
          {postsaber === "NO_CONFIGURADO" && !puedeAbrirPostsaber && (
            <p className="text-xs text-muted-foreground">Se habilita cuando el presaber esté cerrado.</p>
          )}
          {postsaber === "DISPONIBLE" && (
            <>
              <p className="text-xs text-success">
                Abierto desde {etiquetas.postsaberOpened ?? "—"}
              </p>
              <Boton
                etiqueta="Cerrar postsaber"
                icono={Lock}
                variant="destructive"
                pendiente={pendiente}
                onClick={() => ejecutar(onClosePostsaber)}
                confirmar={{
                  titulo: "¿Cerrar el postsaber?",
                  descripcion: "Nadie más podrá presentarlo. El ciclo queda completo y los indicadores, definitivos.",
                }}
              />
            </>
          )}
          {postsaber === "CERRADO" && (
            <p className="text-xs text-muted-foreground">
              Cerrado el {etiquetas.postsaberClosed ?? "—"}
              {resumen.postsaberCantidad > 0 && ` · ${resumen.postsaberCantidad} lo presentaron`}
            </p>
          )}
        </div>
      </div>

      {hayComparacion && (
        <div className="surface-inset flex flex-wrap items-center gap-4 p-4">
          <div className="flex items-center gap-2">
            <span className="font-display text-2xl font-extrabold text-foreground">{resumen.presaberPromedio}%</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <span className="font-display text-2xl font-extrabold text-foreground">{resumen.postsaberPromedio}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            {comparacion!.diferencia > 0 ? (
              <TrendingUp className="h-4 w-4 text-success" />
            ) : comparacion!.diferencia < 0 ? (
              <TrendingDown className="h-4 w-4 text-destructive" />
            ) : (
              <Minus className="h-4 w-4 text-muted-foreground" />
            )}
            <span
              className={
                comparacion!.diferencia > 0
                  ? "text-sm font-semibold text-success"
                  : comparacion!.diferencia < 0
                    ? "text-sm font-semibold text-destructive"
                    : "text-sm font-semibold text-muted-foreground"
              }
            >
              {comparacion!.diferencia > 0 ? "+" : ""}
              {comparacion!.diferencia} puntos porcentuales
              {comparacion!.variacion !== null && ` (${comparacion!.variacion > 0 ? "+" : ""}${comparacion!.variacion}%)`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
