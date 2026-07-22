"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export type ChartPoint = {
  /** Día en ISO (yyyy-mm-dd). La serie llega completa (incluye días en cero). */
  date: string;
  inscripciones: number;
  finalizaciones: number;
};

const RANGES = [
  { days: 7, label: "7d" },
  { days: 30, label: "30d" },
  { days: 90, label: "90d" },
] as const;

const W = 640;
const H = 220;
const PAD = { top: 16, right: 12, bottom: 28, left: 30 };

function formatDay(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

/**
 * Evolución de inscripciones y finalizaciones (dos series categóricas con los
 * colores de marca: azul primario y verde éxito). SVG propio: línea fina,
 * área con degradado sutil, leyenda siempre presente y tooltip por columna
 * al pasar el mouse. El texto usa tokens de texto, nunca el color de la serie.
 */
export function EnrollmentChart({ points }: { points: ChartPoint[] }) {
  const [rangeDays, setRangeDays] = useState<7 | 30 | 90>(30);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const visible = useMemo(() => points.slice(-rangeDays), [points, rangeDays]);

  const maxY = Math.max(1, ...visible.map((p) => Math.max(p.inscripciones, p.finalizaciones)));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const x = (i: number) => PAD.left + (visible.length <= 1 ? innerW / 2 : (i / (visible.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / maxY) * innerH;

  function linePath(get: (p: ChartPoint) => number) {
    return visible.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(get(p)).toFixed(1)}`).join(" ");
  }
  function areaPath(get: (p: ChartPoint) => number) {
    if (visible.length === 0) return "";
    return `${linePath(get)} L${x(visible.length - 1).toFixed(1)},${(PAD.top + innerH).toFixed(1)} L${x(0).toFixed(1)},${(PAD.top + innerH).toFixed(1)} Z`;
  }

  // Ticks: pocos y recesivos (grid sutil, ejes sin caja).
  const yTicks = maxY <= 4 ? Array.from({ length: maxY + 1 }, (_, i) => i) : [0, Math.round(maxY / 2), maxY];
  const xTickCount = Math.min(4, visible.length);
  const xTicks = Array.from({ length: xTickCount }, (_, i) =>
    Math.round((i / Math.max(1, xTickCount - 1)) * (visible.length - 1))
  );

  const hover = hoverIndex !== null ? visible[hoverIndex] : null;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Leyenda: identidad por color + etiqueta, nunca color solo. */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
            Inscripciones
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-success" />
            Finalizaciones
          </span>
        </div>
        <div className="flex gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              onClick={() => setRangeDays(r.days)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-all duration-200 focus-visible:outline-2 focus-visible:outline-success",
                rangeDays === r.days
                  ? "surface-clay-pressed font-semibold text-success"
                  : "surface-clay text-foreground/70 hover:-translate-y-0.5"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Evolución de inscripciones y finalizaciones"
          onMouseLeave={() => setHoverIndex(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - rect.left) / rect.width) * W;
            const i = Math.round(((px - PAD.left) / innerW) * (visible.length - 1));
            setHoverIndex(Math.max(0, Math.min(visible.length - 1, i)));
          }}
        >
          <defs>
            <linearGradient id="grad-insc" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="grad-fin" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--success)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--success)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {yTicks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth="1" />
              <text x={PAD.left - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="var(--muted-foreground)">
                {t}
              </text>
            </g>
          ))}
          {xTicks.map((i) => (
            <text
              key={i}
              x={x(i)}
              y={H - 8}
              textAnchor="middle"
              fontSize="10"
              fill="var(--muted-foreground)"
            >
              {formatDay(visible[i].date)}
            </text>
          ))}

          <path d={areaPath((p) => p.inscripciones)} fill="url(#grad-insc)" />
          <path d={areaPath((p) => p.finalizaciones)} fill="url(#grad-fin)" />
          <path d={linePath((p) => p.inscripciones)} fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinejoin="round" />
          <path d={linePath((p) => p.finalizaciones)} fill="none" stroke="var(--success)" strokeWidth="2" strokeLinejoin="round" />

          {hover && hoverIndex !== null && (
            <g>
              <line
                x1={x(hoverIndex)}
                x2={x(hoverIndex)}
                y1={PAD.top}
                y2={PAD.top + innerH}
                stroke="var(--muted-foreground)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <circle cx={x(hoverIndex)} cy={y(hover.inscripciones)} r="4" fill="var(--primary)" stroke="white" strokeWidth="1.5" />
              <circle cx={x(hoverIndex)} cy={y(hover.finalizaciones)} r="4" fill="var(--success)" stroke="white" strokeWidth="1.5" />
            </g>
          )}
        </svg>

        {hover && hoverIndex !== null && (
          <div
            className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs shadow-md"
            style={{ left: `${(x(hoverIndex) / W) * 100}%` }}
          >
            <p className="font-semibold text-foreground">{formatDay(hover.date)}</p>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">{hover.inscripciones}</span> inscripciones ·{" "}
              <span className="font-medium text-foreground">{hover.finalizaciones}</span> finalizaciones
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
