"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ShieldCheck, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ItemNav = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Marca activo solo con coincidencia exacta (por defecto, basta el prefijo). */
  exact?: boolean;
  /** Ruta contra la que comparar, si difiere del href (ej. enlaces con #). */
  match?: string;
  /** Fragmento que debe coincidir, para distinguir dos enlaces a la misma ruta. */
  hash?: string;
};

export type GrupoNav = { label: string | null; items: ItemNav[] };

/**
 * Barra lateral única de la plataforma.
 *
 * Antes vivía copiada en tres archivos —admin, estudiante y tutor— con el
 * mismo marcado y diferencias de una palabra. Cada retoque visual había que
 * hacerlo tres veces y siempre quedaba uno atrás. Ahora es un componente que
 * recibe sus grupos de navegación y su acento; lo demás es idéntico por
 * construcción, que es justamente lo que se quería.
 *
 * Se mantiene OSCURA en los dos temas a propósito: es la firma del producto y
 * el ancla de la pantalla. El resto de la interfaz cambia con el tema; esto no.
 */
export function AppSidebar({
  open,
  onClose,
  grupos,
  subtitulo,
  logoUrl,
  claseAcento,
  pie,
}: {
  open: boolean;
  onClose: () => void;
  grupos: GrupoNav[];
  subtitulo?: string;
  logoUrl?: string | null;
  claseAcento: "accent-student" | "accent-tutor" | "accent-admin";
  /**
   * Tarjeta del pie. Opcional a propósito: es decorativa y cuesta unos 120px,
   * así que en un menú largo se come ítems de navegación reales. Se pone donde
   * la lista es corta y se omite donde no.
   */
  pie?: { titulo: string; texto: string };
}) {
  const pathname = usePathname();
  const [hash, setHash] = useState("");

  // usePathname() no incluye el fragmento (#...): sin esto, dos enlaces a la
  // misma ruta —"Mis cursos" y "Mis certificados", ambos en /mi-aula— se
  // marcarían activos a la vez.
  useEffect(() => setHash(window.location.hash), [pathname]);
  useEffect(() => {
    const alCambiar = () => setHash(window.location.hash);
    window.addEventListener("hashchange", alCambiar);
    return () => window.removeEventListener("hashchange", alCambiar);
  }, []);

  const estaActivo = (item: ItemNav) => {
    const ruta = item.match ?? item.href;
    if (item.hash !== undefined) return pathname === ruta && hash === item.hash;
    return item.exact ? pathname === ruta : pathname.startsWith(ruta);
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-40 bg-navy/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={cn(
          claseAcento,
          "fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col overflow-hidden border-r border-white/10 bg-gradient-to-b from-sidebar to-[#0A1622] text-sidebar-foreground transition-transform duration-200 lg:sticky lg:top-0 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Resplandor del acento del rol detrás del logo: es lo que le da
            volumen al panel y lo que distingue un área de otra de un vistazo. */}
        <div className="pointer-events-none absolute -left-12 -top-20 h-64 w-64 rounded-full bg-[var(--accent)] opacity-25 blur-[80px]" />
        <div className="pointer-events-none absolute -bottom-16 -right-12 h-52 w-52 rounded-full bg-[var(--accent)] opacity-10 blur-[80px]" />

        <div className="relative flex items-center gap-2.5 px-5 py-6">
          {logoUrl ? (
            <span className="flex shrink-0 items-center justify-center rounded-xl bg-white/95 p-1 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element -- logo institucional dinámico, no un asset estático conocido en build. */}
              <img src={logoUrl} alt="Red Salud Casanare E.S.E." className="h-7 w-auto object-contain" />
            </span>
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5">
              <Activity className="h-5 w-5 text-[var(--accent)]" strokeWidth={2.5} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-extrabold leading-tight text-white">
              RedSalud <span className="text-[var(--accent)]">Te Forma</span>
            </p>
            {subtitulo && <p className="truncate text-[11px] text-sidebar-foreground/55">{subtitulo}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sidebar-foreground/60 hover:text-white lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* min-h-0: sin esto, un hijo flex con overflow no encoge por debajo
            del alto de su contenido y el menú se mete por debajo del pie en
            vez de scrollear dentro de sí mismo. */}
        <nav className="relative min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-2">
          {grupos.map((grupo, i) => (
            <div key={grupo.label ?? `grupo-${i}`} className={cn(i > 0 && "mt-4 border-t border-white/10 pt-4")}>
              {grupo.label && (
                <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                  {grupo.label}
                </p>
              )}
              <div className="space-y-1">
                {grupo.items.map((item) => {
                  const activo = estaActivo(item);
                  const Icono = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => {
                        onClose();
                        if (item.hash !== undefined) setHash(item.hash);
                      }}
                      aria-current={activo ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-300",
                        activo
                          ? // Activo: no un rectángulo sólido, sino un bloque
                            // con halo del acento que se lee elevado.
                            "border-[color-mix(in_oklch,var(--accent)_35%,transparent)] bg-gradient-to-r from-[color-mix(in_oklch,var(--accent)_22%,transparent)] to-transparent text-white shadow-[0_0_20px_-4px_color-mix(in_oklch,var(--accent)_45%,transparent)]"
                          : "border-transparent text-sidebar-foreground/70 hover:translate-x-1 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                          activo
                            ? "bg-[color-mix(in_oklch,var(--accent)_30%,transparent)] text-white"
                            : "bg-white/5 group-hover:bg-white/10"
                        )}
                      >
                        <Icono className="h-4 w-4" strokeWidth={2} />
                      </span>
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="relative px-3 pb-3">
          {pie && (
          <div className="surface-glass-dark p-3.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--accent)_25%,transparent)]">
              <ShieldCheck className="h-4 w-4 text-white" />
            </span>
            <p className="mt-2.5 text-xs font-semibold leading-snug text-white">{pie.titulo}</p>
            <p className="mt-1 text-[11px] leading-snug text-sidebar-foreground/60">{pie.texto}</p>
          </div>
          )}
          <p className="px-2 pt-3 text-[11px] text-sidebar-foreground/40">Red Salud Casanare E.S.E.</p>
        </div>
      </aside>
    </>
  );
}
