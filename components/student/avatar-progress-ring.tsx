import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/initials";

/** Avatar con anillo de progreso circular alrededor, para el bloque de perfil del estudiante. */
export function AvatarProgressRing({
  name,
  avatarUrl,
  progress,
  size = 88,
}: {
  name: string;
  avatarUrl?: string | null;
  progress: number;
  size?: number;
}) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(100, Math.max(0, progress));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} className="stroke-white/15" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="stroke-primary transition-[stroke-dashoffset] duration-700 ease-out"
          fill="none"
        />
      </svg>
      <div className="absolute inset-[6px] overflow-hidden rounded-full shadow-lg ring-4 ring-navy/40">
        <Avatar className="h-full w-full">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={name} />}
          {/* Fondo mezclado con navy en vez de --primary plano: el azul de
              marca (luminosidad 68%) deja el blanco en 2.75:1, por debajo de
              AA; mezclarlo a la mitad con navy lo baja a ~46% y el blanco pasa
              de largo el 4.5:1. */}
          <AvatarFallback className="h-full w-full bg-[color-mix(in_oklch,var(--primary)_50%,var(--navy))] text-lg text-white">
            {initials(name)}
          </AvatarFallback>
        </Avatar>
      </div>
    </div>
  );
}
