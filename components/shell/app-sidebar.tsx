"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ShieldCheck, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHashActual } from "@/lib/use-cliente";

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
  /** Subrutas que tienen su propia entrada en el menú: con ellas, esta no se marca. */
  excluir?: string[];
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

  // usePathname() no incluye el fragmento (#...): sin esto, dos enlaces a la
  // misma ruta —"Mis cursos" y "Mis certificados", ambos en /mi-aula— se
  // marcarían activos a la vez.
  const hash = useHashActual(pathname);

  const estaActivo = (item: ItemNav) => {
    const ruta = item.match ?? item.href;
    if (item.hash !== undefined) return pathname === ruta && hash === item.hash;
    if (item.excluir?.some((r) => pathname.startsWith(r))) return false;
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
          "sidebar-brand fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col overflow-hidden text-sidebar-foreground transition-transform duration-200 lg:sticky lg:top-0 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Resplandor del acento del rol detrás del logo: es lo que distingue
            un área de otra de un vistazo. */}
        <div className="pointer-events-none absolute -left-16 -top-24 z-[1] h-64 w-64 rounded-full bg-[var(--accent)] opacity-30 blur-[80px]" />

        <div className="relative z-[2] flex items-center gap-3 px-4 pb-4 pt-5">
          {logoUrl ? (
            <span className="flex shrink-0 items-center justify-center rounded-lg bg-white p-1 shadow-[0_0_0_1px_color-mix(in_oklch,white_30%,transparent),0_6px_16px_-6px_black]">
              {/* eslint-disable-next-line @next/next/no-img-element -- logo institucional dinámico, no un asset estático conocido en build. */}
              <img src={logoUrl} alt="Red Salud Casanare E.S.E." className="h-8 w-auto object-contain" />
            </span>
          ) : (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--accent)] to-[color-mix(in_oklch,var(--accent)_50%,var(--navy))] shadow-[inset_0_1px_0_0_color-mix(in_oklch,white_30%,transparent),0_6px_18px_-6px_var(--accent)]">
              <Activity className="h-5 w-5 text-white" strokeWidth={2.5} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[15px] font-extrabold leading-tight text-white">
              RedSalud <span className="text-[var(--accent)]">Te Forma</span>
            </p>
            {subtitulo && (
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-sidebar-foreground/65">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" aria-hidden="true" />
                {subtitulo}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-sidebar-foreground/70 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* min-h-0: sin esto, un hijo flex con overflow no encoge por debajo
            del alto de su contenido y el menú se mete por debajo del pie en
            vez de scrollear dentro de sí mismo. */}
        <div className="divider-glow relative z-[2] mx-4 shrink-0" aria-hidden="true" />

        <nav className="relative z-[2] min-h-0 flex-1 overflow-y-auto px-3 pb-2 pt-3">
          {grupos.map((grupo, i) => (
            <div key={grupo.label ?? `grupo-${i}`} className={cn(i > 0 && "mt-4")}>
              {grupo.label && (
                // Rótulo de grupo con regla: separa sin la raya completa de
                // antes y sin letra diminuta.
                <p className="flex items-center gap-2 px-2.5 pb-1.5 text-xs font-semibold text-sidebar-foreground/55">
                  {grupo.label}
                  <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" aria-hidden="true" />
                </p>
              )}
              <div className="space-y-0.5">
                {grupo.items.map((item) => {
                  const activo = estaActivo(item);
                  const Icono = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      // Ya no hace falta adelantar el hash a mano: se lee del
                      // navegador, que es quien lo cambia al navegar.
                      onClick={onClose}
                      aria-current={activo ? "page" : undefined}
                      // El estado activo sale de aria-current (ver .nav-item).
                      className="nav-item"
                    >
                      <span className="nav-item-icono">
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

        <div className="relative z-[2] px-3 pb-3">
          {pie && (
            <div className="mb-2 rounded-xl border border-white/12 bg-white/[0.06] p-3.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--accent)_25%,transparent)]">
                <ShieldCheck className="h-4 w-4 text-white" />
              </span>
              <p className="mt-2.5 text-xs font-semibold leading-snug text-white">{pie.titulo}</p>
              <p className="mt-1 text-xs leading-snug text-sidebar-foreground/60">{pie.texto}</p>
            </div>
          )}
          {/* Firma del pie: el trazo ECG de la marca, en el acento del rol. */}
          <div className="border-t border-white/10 px-1.5 pt-2.5">
            <svg viewBox="0 0 220 24" className="h-5 w-full text-[var(--accent)]" fill="none" aria-hidden="true" preserveAspectRatio="none">
              <path
                d="M0 14H62l7 0 5-10 6 18 6-20 5 12h13l5-5 5 5H220"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                opacity="0.85"
              />
            </svg>
            <p className="pt-1 text-xs text-sidebar-foreground/55">Red Salud Casanare E.S.E.</p>
          </div>
        </div>
      </aside>
    </>
  );
}
