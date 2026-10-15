import type { Semaforo } from "@/lib/semaforo-indicadores";
import { UMBRAL_AMARILLO, UMBRAL_VERDE } from "@/lib/semaforo-indicadores";
import { cn } from "@/lib/utils";

/*
 * Instrumentos SVG de los indicadores, sin estado y aptos para servidor:
 * anillo de semáforo y minigráfico de tendencia. Todas las coordenadas van
 * redondeadas a 2 decimales: servidor y navegador formatean los flotantes
 * distinto y eso desajusta la hidratación del SVG.
 */

const r2 = (n: number) => Math.round(n * 100) / 100;

export const COLOR_SEMAFORO: Record<Semaforo, string> = {
  verde: "var(--success)",
  amarillo: "var(--warning)",
  rojo: "var(--destructive)",
  "sin-datos": "color-mix(in oklch, var(--foreground) 22%, transparent)",
};

/**
 * ANILLO DE SEMÁFORO: el arco mide el valor (0–100) y toma el color del
 * semáforo; una marca fina señala la meta. Para la adherencia (pp, puede
 * superar 100 o ser negativa) el arco se acota a 0–100 y la cifra dice la
 * verdad.
 */
export function AnilloSemaforo({
  valor,
  sem,
  texto,
  tamano = 96,
  grosor = 9,
  etiqueta,
  className,
}: {
  valor: number | null;
  sem: Semaforo;
  texto: string;
  tamano?: number;
  grosor?: number;
  etiqueta?: string;
  className?: string;
}) {
  const c = tamano / 2;
  const r = c - grosor / 2 - 3;
  const circ = 2 * Math.PI * r;
  const v = valor === null ? 0 : Math.min(100, Math.max(0, valor));
  const angMeta = (UMBRAL_VERDE / 100) * 2 * Math.PI - Math.PI / 2;
  const angAlerta = (UMBRAL_AMARILLO / 100) * 2 * Math.PI - Math.PI / 2;
  const marca = (ang: number, largo: number) => ({
    x1: r2(c + (r - grosor / 2 - 2) * Math.cos(ang)),
    y1: r2(c + (r - grosor / 2 - 2) * Math.sin(ang)),
    x2: r2(c + (r + grosor / 2 + largo) * Math.cos(ang)),
    y2: r2(c + (r + grosor / 2 + largo) * Math.sin(ang)),
  });
  const grande = tamano >= 120;
  return (
    <div className={cn("ind-anillo", className)} style={{ width: tamano, height: tamano, ["--sem" as string]: COLOR_SEMAFORO[sem] }} role="img" aria-label={`${texto}${etiqueta ? ` · ${etiqueta}` : ""}`}>
      <svg width={tamano} height={tamano} viewBox={`0 0 ${tamano} ${tamano}`} aria-hidden="true">
        <circle cx={c} cy={c} r={r} fill="none" strokeWidth={grosor} stroke="color-mix(in oklch, var(--foreground) 7%, transparent)" />
        <g transform={`rotate(-90 ${c} ${c})`}>
          <circle
            cx={c}
            cy={c}
            r={r}
            fill="none"
            strokeWidth={grosor}
            strokeLinecap="round"
            stroke="var(--sem)"
            strokeDasharray={r2(circ)}
            strokeDashoffset={r2(circ * (1 - v / 100))}
            className="ind-anillo-arco"
          />
        </g>
        <line {...marca(angAlerta, 2)} stroke="color-mix(in oklch, var(--foreground) 30%, transparent)" strokeWidth={1} />
        <line {...marca(angMeta, 3)} stroke="var(--foreground)" strokeWidth={1.5} />
      </svg>
      <div className="ind-anillo-centro">
        <b className={grande ? "text-[1.45rem]" : "text-[0.95rem]"}>{texto}</b>
        {etiqueta && <span>{etiqueta}</span>}
      </div>
    </div>
  );
}

/**
 * MINIGRÁFICO de los cuatro trimestres: línea con puntos (vacío = sin
 * datos), banda tenue de la meta y el trimestre vigente resaltado.
 */
export function Sparkline({
  valores,
  sems,
  actual,
  ancho = 180,
  alto = 44,
  className,
}: {
  valores: (number | null)[];
  sems: Semaforo[];
  actual: number;
  ancho?: number;
  alto?: number;
  className?: string;
}) {
  const padX = 10;
  const padY = 6;
  const n = valores.length;
  const x = (i: number) => r2(padX + (i * (ancho - 2 * padX)) / Math.max(1, n - 1));
  const presentes = valores.filter((v): v is number => v !== null);
  const min = Math.min(0, ...presentes);
  const max = Math.max(100, ...presentes);
  const y = (v: number) => r2(alto - padY - ((v - min) / (max - min || 1)) * (alto - 2 * padY));
  const puntos = valores.map((v, i) => (v === null ? null : { x: x(i), y: y(v), sem: sems[i], i }));
  // Segmentos solo entre puntos consecutivos con dato: un hueco no se interpola.
  const tramos: string[] = [];
  for (let i = 1; i < n; i++) {
    const a = puntos[i - 1];
    const b = puntos[i];
    if (a && b) tramos.push(`M${a.x},${a.y} L${b.x},${b.y}`);
  }
  const yMeta = y(UMBRAL_VERDE);
  return (
    <svg className={cn("ind-spark", className)} width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`} aria-hidden="true">
      <rect x={padX} y={r2(y(100))} width={ancho - 2 * padX} height={r2(Math.max(0, yMeta - y(100)))} fill="color-mix(in oklch, var(--success) 9%, transparent)" />
      <line x1={padX} x2={ancho - padX} y1={yMeta} y2={yMeta} stroke="color-mix(in oklch, var(--success) 55%, transparent)" strokeDasharray="2 3" strokeWidth={1} />
      {valores.map((_, i) => (
        <line key={i} x1={x(i)} x2={x(i)} y1={padY} y2={alto - padY} stroke={i + 1 === actual ? "color-mix(in oklch, var(--primary) 45%, transparent)" : "color-mix(in oklch, var(--foreground) 7%, transparent)"} strokeWidth={1} />
      ))}
      {tramos.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="color-mix(in oklch, var(--foreground) 55%, transparent)" strokeWidth={1.5} strokeLinecap="round" />
      ))}
      {puntos.map((p, i) =>
        p ? (
          <circle key={i} cx={p.x} cy={p.y} r={p.i + 1 === actual ? 4 : 3} fill={COLOR_SEMAFORO[p.sem]} stroke="var(--card)" strokeWidth={1.5} />
        ) : (
          <circle key={i} cx={x(i)} cy={r2(alto / 2)} r={2.5} fill="none" stroke="color-mix(in oklch, var(--foreground) 25%, transparent)" strokeDasharray="1.5 1.5" />
        )
      )}
    </svg>
  );
}

/** Señal de semáforo: punto + veredicto, en monoespaciada. */
export function SenalSemaforo({ sem, children, className }: { sem: Semaforo; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("ind-senal", className)} data-sem={sem}>
      {children}
    </span>
  );
}
