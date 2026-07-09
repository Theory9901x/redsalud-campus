/**
 * Motivo de pulso ECG como elemento gráfico protagonista del hero del
 * dashboard (Momento signature 2): no un ícono decorativo de esquina, sino
 * una línea que atraviesa toda la composición y se dibuja sola al cargar
 * (stroke-dasharray/dashoffset, ver .ecg-pulse en globals.css).
 */
export function EcgPulse({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`ecg-pulse pointer-events-none ${className}`}
      viewBox="0 0 1200 220"
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M0,150 H160 L195,150 L215,55 L240,195 L265,40 L290,150 L340,150 H540 L575,150 L595,55 L620,195 L645,40 L670,150 L720,150 H920 L955,150 L975,55 L1000,195 L1025,40 L1050,150 L1200,150"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
