import { Activity, Award, Layers, LineChart, QrCode, Sparkles } from "lucide-react";
import { ConstellationPattern } from "@/components/brand/dot-pattern";

const FEATURES = [
  { icon: Award, label: "Certificación digital", description: "Certificados en PDF verificables al instante." },
  { icon: Layers, label: "Cursos modulares", description: "Contenido organizado por módulos y lecciones." },
  { icon: LineChart, label: "Seguimiento en vivo", description: "Progreso y resultados en tiempo real." },
  { icon: QrCode, label: "Validación con QR", description: "Verifica la autenticidad de cada certificado." },
];

/**
 * Degradado del panel institucional: navy solo en la esquina superior (para
 * que el logo/encabezado tengan contraste) hacia el azul claro real de la
 * entidad (--primary) en el resto — no un navy casi negro, es "el azul de la
 * entidad" el que debe dominar.
 */
const PANEL_GRADIENT = {
  backgroundImage:
    "linear-gradient(150deg in oklch, var(--navy) 0%, color-mix(in oklch, var(--primary) 55%, var(--navy)) 38%, color-mix(in oklch, var(--primary) 92%, white) 100%)",
};

function BrandMark({
  logoUrl,
  size,
  tone = "light",
}: {
  logoUrl?: string | null;
  size: "sm" | "lg";
  tone?: "light" | "dark";
}) {
  return (
    <div className="flex items-center gap-3">
      {logoUrl ? (
        <span className="flex shrink-0 items-center justify-center rounded-xl bg-white/95 p-1.5 shadow-md">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo institucional dinámico, no un asset estático conocido en build. */}
          <img
            src={logoUrl}
            alt="Red Salud Casanare E.S.E."
            className={size === "lg" ? "h-11 w-auto object-contain" : "h-7 w-auto object-contain"}
          />
        </span>
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white ring-1 ring-white/20">
          <Activity className={size === "lg" ? "h-6 w-6" : "h-5 w-5"} strokeWidth={2.5} />
        </span>
      )}
      <span
        className={`font-display font-extrabold ${size === "lg" ? "text-2xl" : "text-lg"} ${tone === "dark" ? "text-navy" : "text-white"}`}
      >
        RedSalud <span className={tone === "dark" ? "text-primary" : "text-white/85"}>Te Forma</span>
      </span>
    </div>
  );
}

export function AuthShell({
  children,
  logoUrl,
}: {
  children: React.ReactNode;
  logoUrl?: string | null;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[oklch(94.5%_0.008_255)] p-4 sm:p-8">
      {/* Resplandor muy sutil detrás de la tarjeta, para que no flote sobre un gris plano. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,color-mix(in_oklch,var(--primary)_10%,transparent),transparent_55%)]" />

      <div className="relative grid w-full max-w-[88rem] grid-cols-1 overflow-hidden rounded-[2.5rem] border border-black/5 shadow-[0_2px_4px_0_rgba(10,22,34,0.06),0_24px_48px_-16px_rgba(10,22,34,0.25),0_48px_96px_-32px_rgba(10,22,34,0.30)] lg:grid-cols-2">
        {/* Panel institucional (oculto en móvil, ver encabezado compacto más abajo) */}
        <div
          className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex xl:p-16"
          style={PANEL_GRADIENT}
        >
          <ConstellationPattern className="text-white/20" />
          {/* Capas de resplandor: varias tonalidades de azul claro para que el
              panel se sienta "jugado" y no un degradado plano de dos puntos. */}
          <div className="pointer-events-none absolute -bottom-40 -right-40 h-[32rem] w-[32rem] rounded-full bg-white/25 blur-3xl" />
          <div className="pointer-events-none absolute -left-20 top-1/4 h-72 w-72 rounded-full bg-success/20 blur-3xl" />
          <div className="pointer-events-none absolute right-1/4 top-0 h-56 w-56 rounded-full bg-white/15 blur-3xl" />

          <div className="relative z-10 animate-in fade-in slide-in-from-top-4 duration-700">
            <BrandMark logoUrl={logoUrl} size="lg" />
          </div>

          <div className="relative z-10 mt-12 max-w-lg animate-in fade-in slide-in-from-left-8 duration-700">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/90 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-white" />
              Plataforma institucional
            </span>
            <h1 className="mt-6 font-display text-5xl font-extrabold leading-[1.05] tracking-tight xl:text-6xl">
              Toda tu formación.
              <br />
              <span className="text-success">En un solo lugar.</span>
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-white/85">
              Cursos de inducción, reinducción y capacitación para el fortalecimiento del talento humano
              de Red Salud Casanare E.S.E.
            </p>
          </div>

          {/* Grilla de características, con animación de entrada escalonada y hover interactivo. */}
          <div className="relative z-10 mt-12 grid grid-cols-2 gap-4">
            {FEATURES.map(({ icon: Icon, label, description }, index) => (
              <div
                key={label}
                className="animate-in fade-in slide-in-from-bottom-4 duration-700"
                style={{ animationDelay: `${250 + index * 120}ms` }}
              >
                <div className="group h-full rounded-2xl border border-white/15 bg-white/[0.08] p-5 shadow-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-white/25 hover:bg-white/[0.14]">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white transition-transform duration-300 group-hover:scale-110">
                    <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-white">{label}</p>
                  <p className="mt-0.5 text-xs leading-snug text-white/70">{description}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="relative z-10 mt-10 text-xs text-white/60">
            Plataforma oficial de capacitación · Red Salud Casanare E.S.E.
          </p>
        </div>

        {/* Encabezado compacto institucional, solo en móvil/tablet */}
        <div className="relative overflow-hidden px-6 py-8 text-white lg:hidden" style={PANEL_GRADIENT}>
          <ConstellationPattern className="text-white/20" />
          <div className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-white/25 blur-3xl" />
          <div className="relative z-10">
            <BrandMark logoUrl={logoUrl} size="sm" />
          </div>
          <h1 className="relative z-10 mt-4 font-display text-2xl font-extrabold leading-snug">
            Toda tu formación, en un solo lugar.
          </h1>
          <p className="relative z-10 mt-1 text-xs text-white/80">
            Inducción, reinducción y capacitación del talento humano.
          </p>
        </div>

        <div className="relative flex items-center justify-center bg-white px-6 py-14 sm:px-14 xl:px-16">
          <div className="relative flex w-full justify-center">{children}</div>
        </div>
      </div>
    </div>
  );
}
