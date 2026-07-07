export function DotPattern({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="dot-pattern" width="28" height="28" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.4" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dot-pattern)" />
    </svg>
  );
}

/** Líneas de constelación sutiles, para fondos navy grandes (hero, secciones destacadas). */
export function ConstellationPattern({ className = "" }: { className?: string }) {
  const nodes = [
    [40, 60], [180, 40], [340, 90], [520, 50], [660, 110],
    [120, 160], [300, 190], [480, 170], [620, 210],
    [60, 260], [220, 280], [400, 260], [560, 300],
  ];
  return (
    <svg
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
      viewBox="0 0 700 320"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
    >
      {nodes.map(([x1, y1], i) => {
        const [x2, y2] = nodes[(i + 3) % nodes.length];
        return (
          <line
            key={`l-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.35"
          />
        );
      })}
      {nodes.map(([x, y], i) => (
        <circle key={`n-${i}`} cx={x} cy={y} r="2.5" fill="currentColor" opacity="0.7" />
      ))}
    </svg>
  );
}
