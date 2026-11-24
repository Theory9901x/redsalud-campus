import { ArrowRight, Check, Lock, MapPin, MonitorPlay, Radio } from "lucide-react";
import type { FilaAgenda, PasoAgenda } from "@/lib/agenda-estudiante";
import { TRAINING_MODALITY_LABELS } from "@/components/training-plans/labels";

/**
 * Las piezas de la agenda del estudiante («Mis capacitaciones» y
 * «Evaluaciones»). Una capacitación es SIEMPRE una fila con el mismo orden de
 * lectura: cuándo · qué · en qué va mi evaluación · qué hago ahora. Listas
 * dentro de un panel, no rejillas de tarjetas: así se lee de arriba abajo.
 *
 * Los enlaces a /c/… son <a> planos a propósito: esa puerta inscribe y marca
 * asistencia, y un <Link> la dispararía con solo pasar el cursor (prefetch).
 */

function BloqueFecha({ fila }: { fila: FilaAgenda }) {
  if (fila.momento === "EN_VIVO") {
    return (
      <div className="agenda-fecha" data-tono="vivo">
        <Radio className="h-4 w-4" aria-hidden="true" />
        <span>En vivo</span>
      </div>
    );
  }
  if (fila.dia) {
    return (
      <div className="agenda-fecha" data-tono={fila.momento === "FINALIZADA" ? "pasada" : "fecha"}>
        <b>{fila.dia.dia}</b>
        <span>{fila.dia.mes}</span>
      </div>
    );
  }
  return (
    <div className="agenda-fecha" data-tono="pendiente">
      <span>Sin</span>
      <span>fecha</span>
    </div>
  );
}

function Paso({ paso }: { paso: PasoAgenda }) {
  return (
    <span className="agenda-paso" data-estado={paso.estado}>
      {paso.estado === "hecho" ? (
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
      ) : paso.estado === "bloqueado" ? (
        <Lock className="h-3 w-3" aria-hidden="true" />
      ) : (
        <span className="agenda-paso-punto" aria-hidden="true" />
      )}
      {paso.etiqueta}
      {paso.nota !== null && <b>{paso.nota}%</b>}
      <span className="sr-only">
        {paso.estado === "hecho" ? " presentado" : paso.estado === "disponible" ? " disponible ahora" : " aún no disponible"}
      </span>
    </span>
  );
}

export function FilaDeAgenda({ fila, foco = "asistir" }: { fila: FilaAgenda; foco?: "asistir" | "evaluar" }) {
  const disponibles = fila.pasos.filter((p) => p.estado === "disponible" && p.href);
  // En «Mis capacitaciones» manda entrar a la sala; en «Evaluaciones», presentar.
  const acciones =
    foco === "asistir"
      ? fila.enlaceSala
        ? [{ href: fila.enlaceSala, texto: fila.independiente && fila.momento !== "EN_VIVO" ? "Ingresar" : "Entrar a la sala", principal: true }]
        : disponibles.slice(0, 1).map((p) => ({ href: p.href!, texto: p.accion!, principal: true }))
      : disponibles.map((p, i) => ({ href: p.href!, texto: p.accion!, principal: i === 0 }));

  const detalle = [
    fila.hora && fila.momento !== "SIN_FECHA" ? (fila.momento === "FINALIZADA" ? `Fue a las ${fila.hora}` : fila.hora) : fila.trimestres,
    fila.area,
    fila.programa,
  ].filter(Boolean);

  return (
    <li className="agenda-fila" data-momento={fila.momento}>
      <BloqueFecha fila={fila} />

      <div className="min-w-0">
        <p className="agenda-titulo">{fila.titulo}</p>
        <p className="agenda-detalle">
          {detalle.map((d, i) => (
            <span key={i}>{d}</span>
          ))}
          <span className="inline-flex items-center gap-1">
            {fila.modalidad === "PRESENCIAL" ? (
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <MonitorPlay className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {TRAINING_MODALITY_LABELS[fila.modalidad]}
            {fila.lugar ? ` · ${fila.lugar}` : ""}
          </span>
          {fila.independiente && <span className="agenda-etiqueta">Independiente</span>}
        </p>
      </div>

      {fila.pasos.length > 0 ? (
        <div className="agenda-pasos" aria-label="Mi evaluación">
          {fila.pasos.map((p) => (
            <Paso key={p.clave} paso={p} />
          ))}
        </div>
      ) : (
        <span className="agenda-pasos agenda-sin-eval">Sin evaluación</span>
      )}

      <div className="agenda-acciones">
        {acciones.length > 0 ? (
          acciones.map((a) => (
            <a key={a.href} href={a.href} className="btn-agenda" data-variante={a.principal ? "principal" : "secundario"}>
              {a.texto}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
          ))
        ) : (
          <span className="agenda-nota">
            {fila.momento === "SIN_FECHA"
              ? "El área aún no agenda la jornada"
              : fila.momento === "FINALIZADA"
                ? "Nada pendiente"
                : fila.modalidad === "PRESENCIAL"
                  ? "Asiste en el lugar indicado"
                  : "El acceso se abre 30 min antes"}
          </span>
        )}
      </div>
    </li>
  );
}

/** Panel con título, conteo y la lista de filas: la unidad de las dos pantallas. */
export function SeccionAgenda({
  titulo,
  ayuda,
  conteo,
  tono,
  children,
}: {
  titulo: string;
  ayuda?: string;
  conteo?: number;
  tono?: "vivo" | "accion";
  children: React.ReactNode;
}) {
  return (
    <section className="agenda-panel" data-tono={tono}>
      <header className="agenda-cabecera">
        <h2>
          {titulo}
          {conteo !== undefined && <span className="agenda-conteo">{conteo}</span>}
        </h2>
        {ayuda && <p>{ayuda}</p>}
      </header>
      {children}
    </section>
  );
}
