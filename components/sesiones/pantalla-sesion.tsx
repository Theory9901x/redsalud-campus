"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  FileQuestion,
  Loader2,
  Lock,
  UserCheck,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  identificarPorDocumentoAction,
  registrarAsistenciaQrAction,
  type EstadoIdentificacion,
} from "@/app/s/[token]/acciones";
import type { FaseSesion } from "@prisma/client";

type Persona = { id: string; fullName: string } | null;
type EstadoPersona = {
  asistencia: { registradaEn: Date | string; medio: string } | null;
  presaber: number | null;
  postsaber: number | null;
} | null;

/**
 * El CUERPO de la página pública de sesión: cambia con la fase. Móvil
 * primero: un botón gigante por fase, confirmaciones grandes y claras.
 */
export function PantallaSesion({
  token,
  fase,
  activityId,
  tieneCurso,
  persona,
  estado,
}: {
  token: string;
  fase: FaseSesion;
  activityId: string;
  tieneCurso: boolean;
  persona: Persona;
  estado: EstadoPersona;
}) {
  // Sin identificar: primero el documento, en cualquier fase.
  if (!persona) return <Identificacion token={token} />;

  return (
    <div className="mt-4 flex flex-1 flex-col">
      <p className="px-1 text-[13px] text-muted-foreground">
        Hola, <span className="font-semibold text-foreground">{persona.fullName}</span>
      </p>

      {fase === "REGISTRO" && <FaseRegistro token={token} estado={estado} />}
      {fase === "PRESABER" && (
        <FaseEvaluacion
          token={token}
          activityId={activityId}
          tieneCurso={tieneCurso}
          momento="presaber"
          presentado={estado?.presaber ?? null}
          estado={estado}
        />
      )}
      {fase === "CAPACITACION" && <FaseCapacitacion estado={estado} />}
      {fase === "POSTSABER" && (
        <FaseEvaluacion
          token={token}
          activityId={activityId}
          tieneCurso={tieneCurso}
          momento="postsaber"
          presentado={estado?.postsaber ?? null}
          estado={estado}
        />
      )}
      {fase === "CERRADA" && <FaseCerrada estado={estado} tieneCurso={tieneCurso} />}
    </div>
  );
}

const estadoInicial: EstadoIdentificacion = { error: null };

function Identificacion({ token }: { token: string }) {
  const [estado, accion, pendiente] = useActionState(identificarPorDocumentoAction.bind(null, token), estadoInicial);

  return (
    <div className="surface-lumen mt-4 p-6">
      <h2 className="font-display text-lg font-extrabold tracking-tight text-foreground">Identifícate</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
        Escribe tu número de documento para registrar tu participación.
      </p>
      <form action={accion} className="mt-4 space-y-3">
        <input
          name="documento"
          inputMode="numeric"
          autoComplete="off"
          required
          minLength={5}
          placeholder="Número de documento"
          className="h-14 w-full rounded-2xl border border-input bg-background px-5 text-center text-lg font-bold tracking-wide outline-none transition-colors focus:border-primary/60"
        />
        {estado.error && (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] font-medium text-destructive">
            {estado.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pendiente}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-success text-[15px] font-bold text-white shadow-lg shadow-primary/25 disabled:opacity-60"
        >
          {pendiente ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserCheck className="h-5 w-5" />}
          Continuar
        </button>
      </form>
    </div>
  );
}

function FaseRegistro({ token, estado }: { token: string; estado: EstadoPersona }) {
  const router = useRouter();
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const yaRegistrada = !!estado?.asistencia || !!mensaje;

  function registrar() {
    startTransition(async () => {
      const r = await registrarAsistenciaQrAction(token);
      if (r.error) setError(r.error);
      else {
        setMensaje(r.ok ?? "Asistencia registrada.");
        router.refresh();
      }
    });
  }

  if (yaRegistrada) {
    return (
      <Confirmacion
        titulo="¡Asistencia registrada!"
        detalle={mensaje ?? "Tu llegada quedó registrada. Puedes guardar el teléfono: la jornada está por empezar."}
      />
    );
  }

  return (
    <div className="mt-4 flex flex-1 flex-col justify-center">
      {error && (
        <p className="mb-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] font-medium text-destructive">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={registrar}
        disabled={pendiente}
        className="flex min-h-[96px] w-full items-center justify-center gap-3 rounded-3xl bg-gradient-to-r from-primary to-success text-xl font-extrabold text-white shadow-xl shadow-primary/30 transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {pendiente ? <Loader2 className="h-7 w-7 animate-spin" /> : <UserCheck className="h-7 w-7" />}
        Registrar mi asistencia
      </button>
    </div>
  );
}

function FaseEvaluacion({
  token,
  activityId,
  tieneCurso,
  momento,
  presentado,
  estado,
}: {
  token: string;
  activityId: string;
  tieneCurso: boolean;
  momento: "presaber" | "postsaber";
  presentado: number | null;
  estado: EstadoPersona;
}) {
  const etiqueta = momento === "presaber" ? "Presentar presaber" : "Presentar postsaber";
  const Icono = momento === "presaber" ? FileQuestion : ClipboardCheck;

  if (!tieneCurso) {
    return (
      <Aviso
        titulo="Esta capacitación no tiene evaluación en línea"
        detalle="El área está aplicando la evaluación por otro medio. Tu asistencia ya cuenta."
      />
    );
  }

  if (presentado !== null) {
    return (
      <Confirmacion
        titulo={momento === "presaber" ? "Presaber presentado" : "Postsaber presentado"}
        detalle={`Tu resultado quedó registrado: ${presentado}%. ${momento === "presaber" ? "Atento a la capacitación; el postsaber viene al final." : "¡Ciclo completo!"}`}
      />
    );
  }

  return (
    <div className="mt-4 flex flex-1 flex-col justify-center gap-3">
      {!estado?.asistencia && (
        <p className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-[12.5px] leading-snug text-warning-foreground">
          Al entrar a la evaluación tu asistencia queda registrada automáticamente.
        </p>
      )}
      {/*
        La evaluación escribe en el expediente formativo: exige la CUENTA,
        no solo el documento. El resolver /c/ ya maneja sesión, inscripción
        bajo demanda y el momento congelado -este enlace solo lo apunta-.
      */}
      <a
        href={`/c/${activityId}/${momento}?s=${token}`}
        className="flex min-h-[96px] w-full items-center justify-center gap-3 rounded-3xl bg-gradient-to-r from-primary to-success text-xl font-extrabold text-white shadow-xl shadow-primary/30 transition-transform active:scale-[0.98]"
      >
        <Icono className="h-7 w-7" aria-hidden="true" />
        {etiqueta}
      </a>
      <p className="px-2 text-center text-[11.5px] leading-snug text-muted-foreground">
        Te pedirá iniciar sesión con tu cuenta institucional: la evaluación queda en tu expediente formativo.
      </p>
    </div>
  );
}

function FaseCapacitacion({ estado }: { estado: EstadoPersona }) {
  return (
    <div className="mt-4 flex flex-1 flex-col justify-center">
      <div className="surface-lumen p-8 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/12 text-primary">
          <BookOpenCheck className="h-8 w-8" aria-hidden="true" />
        </span>
        <h2 className="mt-4 font-display text-xl font-extrabold tracking-tight text-foreground">
          La capacitación está en curso
        </h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
          Guarda el teléfono y disfruta la sesión. Cuando termine, este mismo código abrirá el postsaber.
        </p>
        {estado?.presaber != null && (
          <p className="mt-4 inline-block rounded-full bg-success/10 px-3.5 py-1.5 text-[12px] font-bold text-success">
            Presaber presentado: {estado.presaber}%
          </p>
        )}
      </div>
    </div>
  );
}

function FaseCerrada({ estado, tieneCurso }: { estado: EstadoPersona; tieneCurso: boolean }) {
  const filas = [
    { etiqueta: "Asistencia", ok: !!estado?.asistencia, detalle: estado?.asistencia ? "Registrada" : "Sin registro" },
    ...(tieneCurso
      ? [
          {
            etiqueta: "Presaber",
            ok: estado?.presaber != null,
            detalle: estado?.presaber != null ? `${estado.presaber}%` : "No presentado",
          },
          {
            etiqueta: "Postsaber",
            ok: estado?.postsaber != null,
            detalle: estado?.postsaber != null ? `${estado.postsaber}%` : "No presentado",
          },
        ]
      : []),
  ];

  return (
    <div className="mt-4 flex flex-1 flex-col justify-center">
      <div className="surface-lumen p-6">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Lock className="h-6 w-6" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-center font-display text-xl font-extrabold tracking-tight text-foreground">
          Sesión cerrada
        </h2>
        <p className="mt-1 text-center text-[13px] text-muted-foreground">Así quedó tu participación:</p>
        <ul className="mt-5 space-y-2.5">
          {filas.map((f) => (
            <li
              key={f.etiqueta}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card/60 px-4 py-3"
            >
              <span className="flex items-center gap-2.5 text-[14px] font-semibold text-foreground">
                {f.ok ? (
                  <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
                ) : (
                  <XCircle className="h-5 w-5 text-muted-foreground/60" aria-hidden="true" />
                )}
                {f.etiqueta}
              </span>
              <span className={cn("text-[13px] font-bold tabular-nums", f.ok ? "text-foreground" : "text-muted-foreground")}>
                {f.detalle}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Confirmacion({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="mt-4 flex flex-1 flex-col justify-center">
      <div className="surface-lumen p-8 text-center">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-success text-white shadow-lg shadow-success/30">
          <CheckCircle2 className="h-10 w-10" strokeWidth={2.2} aria-hidden="true" />
        </span>
        <h2 className="mt-5 font-display text-2xl font-extrabold tracking-tight text-foreground">{titulo}</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{detalle}</p>
      </div>
    </div>
  );
}

function Aviso({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="mt-4 flex flex-1 flex-col justify-center">
      <div className="surface-lumen p-8 text-center">
        <h2 className="font-display text-lg font-extrabold tracking-tight text-foreground">{titulo}</h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{detalle}</p>
      </div>
    </div>
  );
}
