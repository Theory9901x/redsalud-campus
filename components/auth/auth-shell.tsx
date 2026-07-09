import { Activity, Award, Layers, LineChart, QrCode } from "lucide-react";

const FEATURES = [
  { icon: Award, label: "Certificación digital", description: "Certificados en PDF verificables al instante." },
  { icon: Layers, label: "Cursos modulares", description: "Contenido organizado por módulos y lecciones." },
  { icon: LineChart, label: "Seguimiento de cumplimiento", description: "Progreso y resultados en tiempo real." },
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
        <Activity className={size === "lg" ? "h-8 w-8 text-primary" : "h-6 w-6 text-primary"} strokeWidth={2.5} />
      )}
      <span
        className={`font-display font-extrabold ${size === "lg" ? "text-2xl" : "text-lg"} ${tone === "dark" ? "text-navy" : "text-white"}`}
      >
        RedSalud <span className={size === "lg" ? "" : "text-primary"}>Te Forma</span>
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
    <div className="grid min-h-screen flex-1 grid-cols-1 lg:grid-cols-2">
      {/* Panel institucional (oculto en móvil, ver encabezado compacto más abajo) */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#5090B1] p-10 text-white lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(43,166,222,0.30),transparent_45%),radial-gradient(circle_at_80%_15%,rgba(59,181,74,0.16),transparent_40%),radial-gradient(circle_at_50%_100%,rgba(43,166,222,0.14),transparent_50%)]" />

        {/* Formas abstractas */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-72 w-72 rounded-full bg-success/10 blur-3xl" />

        <div className="relative z-10 animate-in fade-in slide-in-from-top-4 duration-700">
          <BrandMark logoUrl={logoUrl} size="lg" />
        </div>

        <div className="relative z-10 mx-auto mt-12 max-w-md space-y-5 text-center animate-in fade-in slide-in-from-left-8 duration-700">
          <h1 className="text-display-xl font-display font-extrabold">
            Plataforma institucional de formación.
          </h1>
          <p className="text-base leading-relaxed text-white/75">
            Cursos de inducción, reinducción y capacitación para el fortalecimiento del talento humano
            de Red Salud Casanare E.S.E.
          </p>
        </div>

        {/* Lista ordenada de características, con animación de entrada escalonada y hover interactivo. */}
        <div className="relative z-10 flex flex-1 flex-col justify-center gap-3 py-8">
          {FEATURES.map(({ icon: Icon, label, description }, index) => (
            <div
              key={label}
              className="animate-in fade-in slide-in-from-left-4 duration-700"
              style={{ animationDelay: `${250 + index * 120}ms` }}
            >
              <div className="group flex items-center gap-3.5 rounded-2xl border border-white/10 bg-navy/25 px-4 py-3.5 shadow-lg backdrop-blur-md transition-all duration-300 hover:translate-x-1 hover:border-white/20 hover:bg-navy/35">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white transition-transform duration-300 group-hover:scale-110">
                  <Icon className="h-4 w-4" strokeWidth={2.25} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="truncate text-xs text-white/60">{description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="relative z-10 text-xs text-white/50">
          Plataforma oficial de capacitación · Red Salud Casanare E.S.E.
        </p>
      </div>

      {/* Encabezado compacto institucional, solo en móvil/tablet */}
      <div className="relative overflow-hidden bg-navy px-6 py-8 text-white lg:hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(43,166,222,0.30),transparent_60%)]" />
        <div className="relative z-10">
          <BrandMark logoUrl={logoUrl} size="sm" />
        </div>
        <h1 className="relative z-10 mt-3 font-display text-2xl font-extrabold leading-snug">
          Plataforma institucional de formación
        </h1>
        <p className="relative z-10 mt-1 text-xs text-white/70">
          Inducción, reinducción y capacitación del talento humano.
        </p>
      </div>

      <div className="relative flex items-center justify-center overflow-hidden bg-background px-4 py-12">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(43,166,222,0.12),transparent_45%),radial-gradient(circle_at_85%_90%,rgba(59,181,74,0.08),transparent_40%)]" />
        <div className="relative flex w-full justify-center">{children}</div>
      </div>
    </div>
  );
}
