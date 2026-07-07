import { Activity, CheckCircle2 } from "lucide-react";

const FEATURES = [
  "Inducción, reinducción y capacitación institucional",
  "Certificados verificables con código QR",
  "Acceso 24/7 desde cualquier dispositivo",
];

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen flex-1 grid-cols-1 lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-navy p-10 text-white lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(43,166,222,0.28),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(43,166,222,0.18),transparent_40%)]" />
        <svg
          className="pointer-events-none absolute bottom-32 left-0 w-full opacity-20"
          height="60"
          viewBox="0 0 1200 60"
          fill="none"
          preserveAspectRatio="none"
        >
          <path
            d="M0 30 H480 L520 30 L540 8 L565 52 L590 30 L620 30 H1200"
            stroke="#2BA6DE"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div className="relative flex items-center gap-2">
          <Activity className="h-7 w-7 text-primary" strokeWidth={2.5} />
          <span className="font-display text-lg font-extrabold">
            RedSalud <span className="text-primary">Forma</span>
          </span>
        </div>

        <div className="relative max-w-md space-y-6">
          <h1 className="font-display text-3xl font-extrabold leading-tight">
            Todo tu proceso de formación institucional en un solo lugar.
          </h1>
          <ul className="space-y-3">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-sm text-white/85">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/50">
          Plataforma oficial de capacitación · Red Salud Casanare E.S.E.
        </p>
      </div>

      <div className="relative flex items-center justify-center overflow-hidden bg-background px-4 py-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(43,166,222,0.12),transparent_45%),radial-gradient(circle_at_85%_90%,rgba(59,181,74,0.08),transparent_40%)]" />
        <div className="relative w-full flex justify-center">{children}</div>
      </div>
    </div>
  );
}
