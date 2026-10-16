"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { MotionConfig, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { CalendarDays, CalendarRange, ChevronDown, GitCompareArrows, LoaderCircle, MapPin, RotateCcw, ShieldCheck, SlidersHorizontal, Stethoscope, Users2, X } from "lucide-react";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const TIPOS = [
  ["mensual", "Mensual"],
  ["trimestral", "Trimestral"],
  ["anual", "Anual"],
] as const;

type Valores = { tipo: string; anio: number; mes: number; trimestre: number; sede: string; servicio: string; sexo: string; eps: string };

/**
 * Filtros combinables del centro de datos SIAU en UNA fila: periodo
 * (mensual, trimestral, anual) y variables de la encuesta. Viven en la URL
 * -las mismas claves de siempre- para que cada vista y la estación de
 * exportación reciban exactamente lo mismo. Cada cambio se aplica solo;
 * debajo quedan los filtros activos como fichas que se quitan con un clic.
 */
export function FiltrosSiau({
  valores,
  opciones,
  periodo,
  periodoPrevio,
}: {
  valores: Valores;
  opciones: { sedes: string[]; servicios: string[]; eps: string[]; anios: number[] };
  /** Etiquetas ya formadas en el servidor. */
  periodo: string;
  periodoPrevio: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pendiente, iniciar] = useTransition();
  const [v, setV] = useState<Valores>(valores);

  function aplicar(cambios: Partial<Valores>) {
    const nuevo = { ...v, ...cambios };
    setV(nuevo);
    const q = new URLSearchParams(params.toString());
    const claves: (keyof Valores)[] = ["tipo", "anio", "mes", "trimestre", "sede", "servicio", "sexo", "eps"];
    for (const k of claves) {
      const valor = String(nuevo[k] ?? "");
      const aplica = (k !== "mes" || nuevo.tipo === "mensual") && (k !== "trimestre" || nuevo.tipo === "trimestral");
      if (valor && aplica) q.set(k, valor);
      else q.delete(k);
    }
    iniciar(() => router.push(`?${q.toString()}`, { scroll: false }));
  }

  function limpiar() {
    setV({ ...valores, sede: "", servicio: "", sexo: "", eps: "" });
    iniciar(() => router.push("?", { scroll: false }));
  }

  const activos = (
    [
      ["sede", "Sede", MapPin],
      ["servicio", "Servicio", Stethoscope],
      ["sexo", "Sexo", Users2],
      ["eps", "EPS", ShieldCheck],
    ] as const
  ).filter(([k]) => v[k]);

  return (
    <MotionConfig reducedMotion="user">
    <form
      id="filtros"
      className="siau-sup siau-filtros siau-revelar"
      style={{ ["--i" as string]: 1 }}
      aria-label="Filtros del centro de datos"
      aria-busy={pendiente}
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="siau-filtros-fila">
        <div className="siau-campo siau-campo-periodo">
          <span>Periodo</span>
          <div className="siau-segmento" role="radiogroup" aria-label="Tipo de periodo">
            {TIPOS.map(([valor, etiqueta]) => (
              <label key={valor} data-activo={v.tipo === valor}>
                {v.tipo === valor && <motion.span layoutId="siau-filtro-periodo" className="siau-pastilla" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                <input type="radio" name="tipo" value={valor} checked={v.tipo === valor} onChange={() => aplicar({ tipo: valor })} className="sr-only" />
                {etiqueta}
              </label>
            ))}
          </div>
        </div>
        <Selector etiqueta="Año" clase="siau-campo-tiempo w-[96px]" valor={String(v.anio)} onCambio={(x) => aplicar({ anio: Number(x) })}>
          {opciones.anios.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Selector>
        {v.tipo === "mensual" && (
          <Selector etiqueta="Mes" clase="siau-campo-tiempo w-[136px]" valor={String(v.mes)} onCambio={(x) => aplicar({ mes: Number(x) })} Icono={CalendarDays}>
            {MESES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </Selector>
        )}
        {v.tipo === "trimestral" && (
          <Selector etiqueta="Trimestre" clase="siau-campo-tiempo w-[136px]" valor={String(v.trimestre)} onCambio={(x) => aplicar({ trimestre: Number(x) })} Icono={CalendarDays}>
            {[1, 2, 3, 4].map((t) => (
              <option key={t} value={t}>
                {t}º trimestre
              </option>
            ))}
          </Selector>
        )}
        <span className="siau-divisor" aria-hidden="true" />
        <Selector etiqueta="Sede" clase="siau-campo-var" valor={v.sede} onCambio={(x) => aplicar({ sede: x })} Icono={MapPin}>
          <option value="">Todas las sedes</option>
          {opciones.sedes.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Servicio" clase="siau-campo-var" valor={v.servicio} onCambio={(x) => aplicar({ servicio: x })} Icono={Stethoscope}>
          <option value="">Todos los servicios</option>
          {opciones.servicios.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Sexo" clase="siau-campo-var" valor={v.sexo} onCambio={(x) => aplicar({ sexo: x })} Icono={Users2}>
          <option value="">Ambos sexos</option>
          <option value="Femenino">Femenino</option>
          <option value="Masculino">Masculino</option>
        </Selector>
        <Selector etiqueta="EPS" clase="siau-campo-var" valor={v.eps} onCambio={(x) => aplicar({ eps: x })} Icono={ShieldCheck}>
          <option value="">Todas las EPS</option>
          {opciones.eps.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Selector>
        <button type="button" onClick={limpiar} className="siau-boton siau-boton-icono" title="Limpiar filtros y volver al periodo actual" aria-label="Limpiar filtros y volver al periodo actual">
          <RotateCcw aria-hidden="true" />
        </button>
      </div>

      <div className="siau-filtros-chips" aria-live="polite">
        <span className="siau-mono mr-1 inline-flex items-center gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          Vista
        </span>
        <span className="siau-chip">
          <CalendarRange aria-hidden="true" />
          <span>{periodo}</span>
        </span>
        <span className="siau-chip">
          <GitCompareArrows aria-hidden="true" />
          <span>vs {periodoPrevio}</span>
        </span>
        {activos.map(([k, nombre, Icono]) => (
          <button key={k} type="button" className="siau-chip-quitar" onClick={() => aplicar({ [k]: "" })} aria-label={`Quitar filtro ${nombre}: ${v[k]}`}>
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Icono className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span className="truncate">
                {nombre}: <b>{v[k]}</b>
              </span>
            </span>
            <span aria-hidden="true">
              <X />
            </span>
          </button>
        ))}
        {activos.length === 0 && <span className="text-[12px] text-muted-foreground">Sin filtros de variable: todas las sedes, servicios, sexos y EPS.</span>}
        {pendiente && (
          <span className="siau-mono ml-auto inline-flex items-center gap-1.5 text-primary">
            <LoaderCircle className="siau-girando h-3.5 w-3.5" aria-hidden="true" />
            Actualizando
          </span>
        )}
      </div>
    </form>
    </MotionConfig>
  );
}

function Selector({
  etiqueta,
  clase,
  valor,
  onCambio,
  Icono,
  children,
}: {
  etiqueta: string;
  clase?: string;
  valor: string;
  onCambio: (v: string) => void;
  Icono?: LucideIcon;
  children: ReactNode;
}) {
  return (
    <label className={`siau-campo ${clase ?? ""}`}>
      <span>{etiqueta}</span>
      <span className="siau-selector">
        {Icono && <Icono className="siau-selector-icono" aria-hidden="true" />}
        <select value={valor} onChange={(e) => onCambio(e.target.value)} className="siau-control" data-activo={Boolean(Icono) && valor !== "" && !/^\d+$/.test(valor)}>
          {children}
        </select>
        <ChevronDown className="siau-selector-flecha" aria-hidden="true" />
      </span>
    </label>
  );
}
