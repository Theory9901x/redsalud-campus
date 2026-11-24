import { Activity, Award, HeartPulse, Layers, LineChart, Lock, QrCode } from "lucide-react";
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { prisma } from "@/lib/prisma";
import { SIN_PRUEBAS } from "@/lib/pruebas";

const FEATURES = [
  { icon: Award, label: "Constancias digitales", description: "Constancias en PDF verificables al instante." },
  { icon: Layers, label: "Cursos modulares", description: "Contenido organizado por módulos y lecciones." },
  { icon: LineChart, label: "Seguimiento en vivo", description: "Progreso y resultados en tiempo real." },
  { icon: QrCode, label: "Validación con QR", description: "Verifica la autenticidad de cada constancia." },
];

function BrandMark({ logoUrl, size }: { logoUrl?: string | null; size: "sm" | "lg" }) {
  return (
    <div className="flex items-center gap-3">
      {logoUrl ? (
        <span className="flex shrink-0 items-center justify-center rounded-xl bg-white p-1.5 shadow-[0_0_0_1px_color-mix(in_oklch,white_35%,transparent),0_10px_24px_-8px_black]">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo institucional dinámico, no un asset estático conocido en build. */}
          <img
            src={logoUrl}
            alt="Red Salud Casanare E.S.E."
            className={size === "lg" ? "h-11 w-auto object-contain" : "h-7 w-auto object-contain"}
          />
        </span>
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white ring-1 ring-white/25">
          <Activity className={size === "lg" ? "h-6 w-6" : "h-5 w-5"} strokeWidth={2.5} />
        </span>
      )}
      <div className="leading-tight">
        <p className={`font-display font-extrabold text-white ${size === "lg" ? "text-2xl" : "text-lg"}`}>
          RedSalud <span className="text-white/80">Te Forma</span>
        </p>
        {size === "lg" && <p className="mt-0.5 text-sm text-white/70">Campus virtual · Red Salud Casanare E.S.E.</p>}
      </div>
    </div>
  );
}

/**
 * Trazo ECG que cruza el panel de lado a lado: una línea base tenue y un
 * pulso verde que la recorre en bucle (ver .auth-ecg en globals.css). Es la
 * firma de salud de la pantalla; no es un ícono de esquina.
 */
function TrazoEcg({ className = "" }: { className?: string }) {
  const d =
    "M0,60 H210 L232,60 L246,22 L262,98 L278,8 L294,60 L330,60 Q352,36 374,60 H640 L662,60 L676,22 L692,98 L708,8 L724,60 L760,60 Q782,36 804,60 H1200";
  return (
    <svg
      className={`auth-ecg pointer-events-none ${className}`}
      viewBox="0 0 1200 110"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
    >
      <path className="auth-ecg-base" d={d} strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <path
        className="auth-ecg-pulso"
        d={d}
        pathLength={1000}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * Orbe de pulso (ver .auth-orbe): anillos, un aro punteado que gira, nodos en
 * órbita y el núcleo con el pulso. Puramente decorativo.
 */
function OrbePulso() {
  return (
    <div className="auth-orbe" aria-hidden="true">
      <svg viewBox="0 0 400 400" fill="none">
        <circle cx="200" cy="200" r="198" stroke="white" strokeOpacity="0.1" />
        <circle cx="200" cy="200" r="160" stroke="white" strokeOpacity="0.16" />
        <circle cx="200" cy="200" r="118" stroke="white" strokeOpacity="0.22" />
        <g className="auth-orbe-giro">
          <circle cx="200" cy="200" r="180" stroke="white" strokeOpacity="0.4" strokeWidth="1.5" strokeDasharray="2 12" strokeLinecap="round" />
          <circle cx="200" cy="20" r="5" fill="var(--success)" />
          <circle cx="356" cy="290" r="3.5" fill="white" fillOpacity="0.9" />
        </g>
        <g className="auth-orbe-giro" data-sentido="inverso">
          <path d="M200 61a139 139 0 0 1 120 69" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M200 339a139 139 0 0 1-120-69" stroke="white" strokeOpacity="0.55" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="61" cy="200" r="4" fill="white" />
        </g>
      </svg>
      <div className="auth-orbe-nucleo">
        <HeartPulse strokeWidth={1.75} />
      </div>
    </div>
  );
}

const NUMERO = new Intl.NumberFormat("es-CO");

/**
 * Cifras REALES de la plataforma (no decorativas): se consultan al pintar la
 * pantalla. Si la base no responde, simplemente no se muestran: el acceso no
 * puede depender de un contador.
 */
async function CifrasAcceso() {
  let cifras: { valor: number; etiqueta: string }[];
  try {
    const [colaboradores, cursos, constancias] = await Promise.all([
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.course.count({ where: { status: "PUBLISHED", trainingActivities: { none: {} }, ...SIN_PRUEBAS } }),
      prisma.certificate.count({ where: { status: "VALID" } }),
    ]);
    cifras = [
      { valor: colaboradores, etiqueta: "colaboradores en el campus" },
      { valor: cursos, etiqueta: cursos === 1 ? "curso publicado" : "cursos publicados" },
      { valor: constancias, etiqueta: constancias === 1 ? "constancia emitida" : "constancias emitidas" },
    ].filter((c) => c.valor > 0);
  } catch {
    return null;
  }
  if (cifras.length === 0) return null;
  return (
    <div className="auth-cifras mt-6 2xl:mt-8">
      {cifras.map((c) => (
        <div key={c.etiqueta}>
          <b>{NUMERO.format(c.valor)}</b>
          <span>{c.etiqueta}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Marco de las pantallas de acceso (login, registro, recuperar, cambio de
 * clave). A sangre: el panel institucional ocupa media pantalla de alto
 * completo, sin tarjeta flotante ni esquinas acolchadas.
 */
export function AuthShell({
  children,
  logoUrl,
}: {
  children: React.ReactNode;
  logoUrl?: string | null;
}) {
  return (
    <div className="relative grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
      {/* Panel institucional (escritorio). Fijo al alto de la ventana: en el
          registro, que es largo, el formulario se desplaza y el panel no. */}
      <aside className="auth-panel relative hidden overflow-hidden text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <OrbePulso />

        <div className="relative z-10 flex items-start justify-between gap-6 animate-in fade-in slide-in-from-top-4 duration-700">
          <BrandMark logoUrl={logoUrl} size="lg" />
          <span className="hidden items-center gap-2 rounded-lg border border-white/20 bg-[color-mix(in_oklch,var(--navy)_45%,transparent)] px-3 py-1.5 text-sm font-medium text-white/90 xl:inline-flex">
            <span className="auth-latido" aria-hidden="true" />
            Plataforma en línea
          </span>
        </div>

        <div className="relative z-10 animate-in fade-in slide-in-from-left-8 duration-700">
          <p className="flex items-center gap-3 text-sm font-semibold text-white/85">
            <span className="h-px w-10 bg-success" aria-hidden="true" />
            Plataforma institucional de formación
          </p>
          <h1 className="mt-5 font-display text-5xl font-extrabold leading-[1.02] tracking-tight xl:text-[4.25rem] 2xl:text-[5rem]">
            Toda tu formación.
            <br />
            <span className="text-success">En un solo lugar.</span>
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-white/85 2xl:max-w-lg 2xl:text-lg">
            Cursos de inducción, reinducción y capacitación para el fortalecimiento del talento humano
            de Red Salud Casanare E.S.E.
          </p>
          <CifrasAcceso />
          {/* El trazo se sale del padding a propósito: va de borde a borde. */}
          <TrazoEcg className="-mx-12 mt-6 h-14 w-[calc(100%+6rem)] xl:-mx-16 xl:w-[calc(100%+8rem)] 2xl:mt-8 2xl:h-20" />
        </div>

        <div className="relative z-10">
          {/* Retícula de características: un solo bloque con divisiones finas,
              no cuatro tarjetas sueltas. */}
          <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-white/20 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-700">
            {FEATURES.map(({ icon: Icon, label, description }, index) => (
              <div
                key={label}
                className={`auth-celda flex items-center gap-3.5 p-4 2xl:items-start 2xl:p-5 ${index % 2 === 0 ? "border-r border-white/15" : ""} ${index < 2 ? "border-b border-white/15" : ""}`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white">
                  <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="mt-0.5 hidden text-[13px] leading-snug text-white/80 2xl:block">{description}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[13px] text-white/85 2xl:mt-6">
            <span>Plataforma oficial de capacitación · Red Salud Casanare E.S.E.</span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              Conexión cifrada
            </span>
          </p>
        </div>
      </aside>

      {/* Encabezado compacto institucional, solo en móvil/tablet */}
      <div className="auth-panel relative overflow-hidden px-6 pb-0 pt-7 text-white lg:hidden">
        <div className="relative z-10">
          <BrandMark logoUrl={logoUrl} size="sm" />
        </div>
        <h1 className="relative z-10 mt-5 font-display text-[1.7rem] font-extrabold leading-tight">
          Toda tu formación. <span className="text-success">En un solo lugar.</span>
        </h1>
        <p className="relative z-10 mt-1.5 text-sm text-white/85">
          Inducción, reinducción y capacitación del talento humano.
        </p>
        <TrazoEcg className="-mx-6 mt-3 h-12 w-[calc(100%+3rem)]" />
      </div>

      <main className="auth-lado relative flex flex-col px-6 py-10 sm:px-12 lg:min-h-screen lg:py-8">
        {/* El selector de tema vive aquí arriba y no en el formulario: quien
            entra de noche debe poder cambiarlo ANTES de iniciar sesión. */}
        <div className="flex justify-end">
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center py-8">
          <div className="relative w-full max-w-[33rem] px-6 py-8 sm:px-9 sm:py-10">
            <span className="auth-esquina" data-pos="tl" aria-hidden="true" />
            <span className="auth-esquina" data-pos="tr" aria-hidden="true" />
            <span className="auth-esquina" data-pos="bl" aria-hidden="true" />
            <span className="auth-esquina" data-pos="br" aria-hidden="true" />
            <div className="relative flex w-full justify-center">{children}</div>
          </div>
        </div>
      </main>
    </div>
  );
}
