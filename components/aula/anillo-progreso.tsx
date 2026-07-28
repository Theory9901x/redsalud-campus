/**
 * Anillo de progreso del curso.
 *
 * SVG puro, sin dependencias: es un arco con `stroke-dasharray`. El número va
 * DENTRO del anillo y además repetido en texto al lado, porque un arco sin
 * cifra obliga a estimar a ojo y con 12 % o 18 % nadie acierta.
 */
export function AnilloProgreso({
  porcentaje,
  tamano = 78,
  grosor = 5,
}: {
  porcentaje: number;
  tamano?: number;
  grosor?: number;
}) {
  const radio = 17;
  const circunferencia = 2 * Math.PI * radio;
  const avance = (Math.min(100, Math.max(0, porcentaje)) / 100) * circunferencia;

  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 42 42"
      className="shrink-0"
      role="img"
      aria-label={`${porcentaje} por ciento del curso completado`}
    >
      <circle
        cx="21"
        cy="21"
        r={radio}
        fill="none"
        strokeWidth={grosor}
        stroke="color-mix(in oklch, var(--accent) 16%, transparent)"
      />
      <circle
        cx="21"
        cy="21"
        r={radio}
        fill="none"
        strokeWidth={grosor}
        stroke="var(--accent)"
        strokeLinecap="round"
        strokeDasharray={`${avance} ${circunferencia}`}
        transform="rotate(-90 21 21)"
        style={{ transition: "stroke-dasharray var(--duration-signature) var(--ease-signature)" }}
      />
      <text
        x="21"
        y="23.5"
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fill="var(--foreground)"
      >
        {porcentaje}%
      </text>
    </svg>
  );
}
