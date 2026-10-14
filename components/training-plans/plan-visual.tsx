import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { trimestreEnCurso } from "@/components/training-plans/trimestres-chip";

/*
 * Piezas visuales del módulo de planes ("tablero de mando institucional").
 * Todas son de servidor y sin estado: solo pintan datos ya calculados. Los
 * estilos viven en globals.css (sección MÓDULO DE PLANES DE CAPACITACIÓN).
 */

const MESES = ["ene–mar", "abr–jun", "jul–sep", "oct–dic"] as const;
const redondear = (n: number) => Math.round(n * 100) / 100;

/** Cuántas actividades cubre cada trimestre (una línea en T1 y T3 cuenta en ambos). */
export function conteoPorTrimestre(actividades: { quarters: number[] }[]): [number, number, number, number] {
  const c: [number, number, number, number] = [0, 0, 0, 0];
  for (const a of actividades) for (const q of a.quarters) if (q >= 1 && q <= 4) c[q - 1]++;
  return c;
}

/**
 * RIEL DE TRIMESTRES: la firma visual del módulo. Cuatro celdas T1–T4 con
 * cuántas capacitaciones programa el plan en cada una y el trimestre en
 * curso resaltado (con pulso). `oscuro` = sobre el navy del héroe.
 */
export function RielTrimestres({
  conteos,
  oscuro = false,
  conMeses = false,
  className,
}: {
  conteos: [number, number, number, number];
  oscuro?: boolean;
  conMeses?: boolean;
  className?: string;
}) {
  const actual = trimestreEnCurso();
  const max = Math.max(1, ...conteos);
  return (
    <div className={cn("riel", oscuro && "riel-oscuro", className)} role="img" aria-label={`Capacitaciones por trimestre: ${conteos.map((n, i) => `T${i + 1} ${n}`).join(", ")}`}>
      {conteos.map((n, i) => {
        const t = i + 1;
        return (
          <div key={t} className="riel-celda" data-actual={t === actual}>
            <div className="riel-etiqueta">
              <span className="inline-flex items-center gap-1.5">
                {t === actual && <span className="punto-vivo" aria-hidden="true" />}T{t}
                {conMeses && <span className="hidden font-medium opacity-80 sm:inline">· {MESES[i]}</span>}
              </span>
              <b>{n}</b>
            </div>
            <div className="riel-barra">
              {n > 0 && <span style={{ width: `${Math.max(8, (n / max) * 100)}%`, animationDelay: `${i * 90}ms` }} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Anillo de porcentaje como INSTRUMENTO: pista de marcas finas, arco del
 * valor en el cian de marca con brillo, y la cifra en monoespaciada.
 * null = sin datos todavía.
 */
export function AnilloPorcentaje({
  valor,
  tamano = 88,
  grosor = 8,
  oscuro = false,
  etiqueta,
}: {
  valor: number | null;
  tamano?: number;
  grosor?: number;
  oscuro?: boolean;
  etiqueta?: string;
}) {
  const r = (tamano - grosor) / 2 - 4;
  const c = 2 * Math.PI * r;
  const v = valor === null ? 0 : Math.min(100, Math.max(0, valor));
  const marcas = Array.from({ length: 48 }, (_, i) => i);
  const centro = tamano / 2;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: tamano, height: tamano }}>
      <svg width={tamano} height={tamano} viewBox={`0 0 ${tamano} ${tamano}`} aria-hidden="true">
        {/* marcas exteriores */}
        {marcas.map((i) => {
          const ang = (i / marcas.length) * 2 * Math.PI - Math.PI / 2;
          const largo = i % 6 === 0 ? 5 : 2.5;
          const r1 = tamano / 2 - 1;
          const r0 = r1 - largo;
          const activa = i / marcas.length < v / 100;
          return (
            <line
              key={i}
              // Redondeo a 2 decimales: servidor y navegador formatean los
              // flotantes distinto y eso rompía la hidratación del SVG.
              x1={redondear(centro + r0 * Math.cos(ang))}
              y1={redondear(centro + r0 * Math.sin(ang))}
              x2={redondear(centro + r1 * Math.cos(ang))}
              y2={redondear(centro + r1 * Math.sin(ang))}
              strokeWidth={1}
              stroke={activa ? "var(--primary)" : oscuro ? "rgba(255,255,255,0.18)" : "color-mix(in oklch, var(--foreground) 16%, transparent)"}
            />
          );
        })}
        <g transform={`rotate(-90 ${centro} ${centro})`}>
          <circle cx={centro} cy={centro} r={r - 6} fill="none" strokeWidth={grosor} stroke={oscuro ? "rgba(255,255,255,0.09)" : "color-mix(in oklch, var(--foreground) 7%, transparent)"} />
          <circle
            cx={centro}
            cy={centro}
            r={r - 6}
            fill="none"
            strokeWidth={grosor}
            strokeLinecap="butt"
            stroke="var(--primary)"
            strokeDasharray={redondear(2 * Math.PI * (r - 6))}
            strokeDashoffset={redondear(2 * Math.PI * (r - 6) * (1 - v / 100))}
            style={{ filter: "drop-shadow(0 0 6px var(--primary))", transition: "stroke-dashoffset 1.1s var(--ease-signature)" }}
          />
        </g>
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className={cn("mono-dato font-semibold leading-none", tamano >= 100 ? "text-[1.35rem]" : "text-sm", oscuro ? "text-white" : "text-foreground")}>
            {valor === null ? "—" : `${Math.round(v)}%`}
          </p>
          {etiqueta && <p className={cn("mt-1 font-mono text-[8.5px] uppercase tracking-[0.16em]", oscuro ? "text-white/55" : "text-muted-foreground")}>{etiqueta}</p>}
        </div>
      </div>
      <span className="sr-only">{c > 0 && valor !== null ? `${Math.round(v)}%` : "Sin datos"}</span>
    </div>
  );
}

/** Píldora de estado con punto (plan o actividad). */
export function PildoraEstado({ estado, children, className }: { estado: string; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("pildora-estado", className)} data-estado={estado}>
      {estado === "ACTIVE" || estado === "OPEN" ? <span className="punto-vivo" aria-hidden="true" /> : <i aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Avatar de iniciales para responsables (sin foto: es un dato institucional). */
export function AvatarIniciales({ nombre, className }: { nombre: string; className?: string }) {
  // Sin prefijos entre corchetes ("[DEMO] Ana…") ni signos: solo palabras.
  const ini = nombre
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span className={cn("avatar-iniciales", className)} aria-hidden="true">
      {ini || "?"}
    </span>
  );
}

/** Índice para la entrada escalonada (.revelar). */
export function escalon(i: number): CSSProperties {
  return { ["--i" as string]: i } as CSSProperties;
}

/**
 * Minigráfico de COLUMNAS T1–T4 (tarjetas de plan): cuántas capacitaciones
 * programa cada trimestre, con el trimestre en curso iluminado. Columnas
 * redondeadas con degradado; la cifra encima y la etiqueta debajo.
 */
export function GraficoTrimestres({ conteos, alto = 64 }: { conteos: [number, number, number, number]; alto?: number }) {
  const actual = trimestreEnCurso();
  const max = Math.max(1, ...conteos);
  return (
    <div className="grafico-trimestres" role="img" aria-label={`Capacitaciones por trimestre: ${conteos.map((n, i) => `T${i + 1} ${n}`).join(", ")}`}>
      {conteos.map((n, i) => {
        const t = i + 1;
        const h = n === 0 ? 3 : Math.max(8, Math.round((n / max) * alto));
        return (
          <div key={t} className="columna" data-actual={t === actual} style={{ ["--alto" as string]: `${alto}px` } as CSSProperties}>
            <span className="pista">
              <span className="cifra">{n}</span>
              <span className="barra" style={{ height: h, animationDelay: `${i * 80}ms` }} />
            </span>
            <span className="etiqueta">T{t}</span>
          </div>
        );
      })}
    </div>
  );
}
