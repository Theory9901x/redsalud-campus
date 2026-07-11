import { Activity, Award, Layers, LineChart, QrCode, Sparkles } from "lucide-react";
import { ConstellationPattern } from "@/components/brand/dot-pattern";

const FEATURES = [
  { icon: Award, label: "Certificación digital", description: "Certificados en PDF verificables al instante." },
  { icon: Layers, label: "Cursos modulares", description: "Contenido organizado por módulos y lecciones." },
  { icon: LineChart, label: "Seguimiento en vivo", description: "Progreso y resultados en tiempo real." },
  { icon: QrCode, label: "Validación con QR", description: "Verifica la autenticidad de cada certificado." },
];

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
            className={size === "lg" ? "h-10 w-auto object-contain" : "h-7 w-auto object-contain"}
          />
        </span>
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-primary ring-1 ring-white/15">
          <Activity className={size === "lg" ? "h-6 w-6" : "h-5 w-5"} strokeWidth={2.5} />
        </span>
      )}
      <span
        className={`font-display font-extrabold ${size === "lg" ? "text-2xl" : "text-lg"} ${tone === "dark" ? "text-navy" : "text-white"}`}
      >
        RedSalud <span className={size === "lg" ? "text-primary" : "text-primary"}>Te Forma</span>
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

      <div className="relative grid w-full max-w-6xl grid-cols-1 overflow-hidden rounded-[2rem] border border-black/5 shadow-[0_2px_4px_0_rgba(10,22,34,0.06),0_24px_48px_-16px_rgba(10,22,34,0.25),0_48px_96px_-32px_rgba(10,22,34,0.30)] lg:grid-cols-2">
        {/* Panel institucional (oculto en móvil, ver encabezado compacto más abajo) */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-[#0A1622] p-10 text-white lg:flex">
          <ConstellationPattern className="text-primary/25" />
          {/* Resplandor de marca grande, mismo lenguaje que el blob del sidebar del estudiante/admin. */}
          <div className="pointer-events-none absolute -bottom-32 -right-32 h-[26rem] w-[26rem] rounded-full bg-primary/30 blur-3xl" />
          <div className="pointer-events-none absolute -left-16 top-1/3 h-64 w-64 rounded-full bg-success/10 blur-3xl" />

          <div className="relative z-10 animate-in fade-in slide-in-from-top-4 duration-700">
            <BrandMark logoUrl={logoUrl} size="lg" />
          </div>

          <div className="relative z-10 mt-10 max-w-md animate-in fade-in slide-in-from-left-8 duration-700">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Plataforma institucional
            </span>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              Toda tu formación.
              <br />
              <span className="bg-gradient-to-r from-primary to-success bg-clip-text text-transparent">
                En un solo lugar.
              </span>
            </h1>
            <p className="mt-4 text-base leading-relaxed text-white/70">
              Cursos de inducción, reinducción y capacitación para el fortalecimiento del talento humano
              de Red Salud Casanare E.S.E.
            </p>
          </div>

          {/* Grilla de características, con animación de entrada escalonada y hover interactivo. */}
          <div className="relative z-10 mt-10 grid grid-cols-2 gap-3">
            {FEATURES.map(({ icon: Icon, label, description }, index) => (
              <div
                key={label}
                className="animate-in fade-in slide-in-from-bottom-4 duration-700"
                style={{ animationDelay: `${250 + index * 120}ms` }}
              >
                <div className="group h-full rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-lg backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.08]">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-primary transition-transform duration-300 group-hover:scale-110">
                    <Icon className="h-4 w-4" strokeWidth={2.25} />
                  </span>
                  <p className="mt-2.5 text-sm font-semibold text-white">{label}</p>
                  <p className="mt-0.5 text-xs leading-snug text-white/55">{description}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="relative z-10 mt-8 text-xs text-white/45">
            Plataforma oficial de capacitación · Red Salud Casanare E.S.E.
          </p>
        </div>

        {/* Encabezado compacto institucional, solo en móvil/tablet */}
        <div className="relative overflow-hidden bg-[#0A1622] px-6 py-8 text-white lg:hidden">
          <ConstellationPattern className="text-primary/25" />
          <div className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-primary/25 blur-3xl" />
          <div className="relative z-10">
            <BrandMark logoUrl={logoUrl} size="sm" />
          </div>
          <h1 className="relative z-10 mt-4 font-display text-2xl font-extrabold leading-snug">
            Toda tu formación, en un solo lugar.
          </h1>
          <p className="relative z-10 mt-1 text-xs text-white/70">
            Inducción, reinducción y capacitación del talento humano.
          </p>
        </div>

        <div className="relative flex items-center justify-center bg-white px-4 py-12 sm:px-10">
          <div className="relative flex w-full justify-center">{children}</div>
        </div>
      </div>
    </div>
  );
}
