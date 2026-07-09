import { SiteHeader } from "@/components/public/site-header";

export default function CursosLayout({ children }: { children: React.ReactNode }) {
  return (
    // page-canvas: mismo nivel 0 (fondo frío, nunca blanco puro) que el área
    // de estudiante, para que los paneles de sección de arriba (nivel 1) y
    // las tarjetas de curso (nivel 2) se lean como elevados por contraste
    // real, no solo por un borde sutil sobre blanco plano.
    <div className="page-canvas relative min-h-screen">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 0%, color-mix(in oklch, var(--primary) 18%, transparent), transparent 55%), radial-gradient(circle at 85% 10%, color-mix(in oklch, var(--success) 14%, transparent), transparent 45%)",
        }}
      />
      <div className="relative pb-20 pt-6">
        <SiteHeader />
        <main className="mx-auto mt-8 w-full max-w-5xl px-4">{children}</main>
      </div>
    </div>
  );
}
