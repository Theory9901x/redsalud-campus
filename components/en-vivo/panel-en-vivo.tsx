"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  CalendarClock,
  Gavel,
  GraduationCap,
  MapPin,
  MonitorPlay,
  Presentation,
  Radio,
  Search,
  Stethoscope,
  UserRound,
  Users2,
  Video,
} from "lucide-react";
import type { CourseAudience, PlanKind, TrainingModality } from "@prisma/client";
import { escalon } from "@/components/training-plans/plan-visual";
import { tituloLegible } from "@/components/training-plans/labels";
import { cn } from "@/lib/utils";

export type FichaVivo = {
  id: string;
  titulo: string;
  objetivo: string | null;
  area: string | null;
  programa: string | null;
  categoria: PlanKind;
  plan: string;
  publico: CourseAudience;
  publicoNota: string | null;
  modalidad: TrainingModality;
  responsable: string | null;
  inicio: string | null;
  fin: string | null;
  estado: "EN_VIVO" | "PROXIMA";
  conectados: number;
  enlace: string;
  prueba: boolean;
};

const PUBLICO = {
  ASISTENCIAL: { etiqueta: "Asistencial", detalle: "Personal de atención en salud", Icono: Stethoscope },
  ADMINISTRATIVO: { etiqueta: "Administrativa", detalle: "Personal administrativo", Icono: Briefcase },
  AMBOS: { etiqueta: "Mixta", detalle: "Asistencial y administrativo", Icono: Users2 },
} as const;

const CATEGORIA: Record<PlanKind, { etiqueta: string; Icono: typeof GraduationCap }> = {
  CAPACITACION: { etiqueta: "Plan de capacitación", Icono: GraduationCap },
  COMITE: { etiqueta: "Comité", Icono: Gavel },
  REUNION: { etiqueta: "Reunión", Icono: Presentation },
};

const MODALIDAD: Record<TrainingModality, { etiqueta: string; Icono: typeof MapPin }> = {
  VIRTUAL: { etiqueta: "Virtual", Icono: MonitorPlay },
  PRESENCIAL: { etiqueta: "Presencial", Icono: MapPin },
  MIXTA: { etiqueta: "Mixta", Icono: MonitorPlay },
};

// Node y el navegador separan "p. m." con espacios Unicode distintos: se
// normalizan para que el HTML del servidor y el del cliente coincidan.
const formato = (f: Intl.DateTimeFormat) => ({ format: (d: Date) => f.format(d).replace(/\s/g, " ") });
const HORA = formato(new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" }));
const DIA = formato(new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Bogota" }));

function relativo(desde: number, ahora: number) {
  const min = Math.round((ahora - desde) / 60000);
  if (min >= 0) return min < 1 ? "empezó ahora" : min < 60 ? `empezó hace ${min} min` : `empezó hace ${Math.floor(min / 60)} h ${min % 60} min`;
  const falta = -min;
  return falta < 60 ? `empieza en ${falta} min` : falta < 24 * 60 ? `empieza en ${Math.floor(falta / 60)} h ${falta % 60} min` : "";
}

const TODAS = "TODAS";

/**
 * Panel EN VIVO: fichas de las llamadas vigentes y de las próximas, con
 * filtros por área, público (asistencial / administrativa / mixta) y
 * categoría. Se refresca solo cada 45 s: quien lo deja abierto ve aparecer
 * la jornada cuando arranca, sin recargar.
 */
export function PanelEnVivo({ fichas }: { fichas: FichaVivo[] }) {
  const router = useRouter();
  // La hora relativa ("empezó hace 12 min") se pinta solo en el cliente:
  // en el servidor el reloj es otro y la hidratación no coincidiría.
  const [ahora, setAhora] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [area, setArea] = useState(TODAS);
  const [publico, setPublico] = useState<CourseAudience | typeof TODAS>(TODAS);
  const [categoria, setCategoria] = useState<PlanKind | typeof TODAS>(TODAS);

  useEffect(() => {
    const tic = () => setAhora(Date.now());
    const primero = setTimeout(tic, 0);
    const reloj = setInterval(tic, 30_000);
    const refresco = setInterval(() => router.refresh(), 45_000);
    return () => {
      clearTimeout(primero);
      clearInterval(reloj);
      clearInterval(refresco);
    };
  }, [router]);

  const areas = useMemo(() => [...new Set(fichas.map((f) => f.area ?? "Sin área"))].sort((a, b) => a.localeCompare(b, "es")), [fichas]);
  const categorias = useMemo(() => [...new Set(fichas.map((f) => f.categoria))], [fichas]);

  const filtradas = fichas.filter((f) => {
    if (area !== TODAS && (f.area ?? "Sin área") !== area) return false;
    if (publico !== TODAS && f.publico !== publico) return false;
    if (categoria !== TODAS && f.categoria !== categoria) return false;
    const q = busqueda.trim().toLowerCase();
    if (q && !`${f.titulo} ${f.area ?? ""} ${f.programa ?? ""} ${f.responsable ?? ""} ${f.objetivo ?? ""}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const enVivo = filtradas.filter((f) => f.estado === "EN_VIVO");
  const proximas = filtradas.filter((f) => f.estado === "PROXIMA");
  const hayFiltro = area !== TODAS || publico !== TODAS || categoria !== TODAS || busqueda.trim() !== "";

  return (
    <div className="space-y-6">
      <div className="barra-modulo form-premium space-y-3 p-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por tema, área o responsable…"
              className="w-full"
              aria-label="Buscar capacitación en vivo"
            />
          </div>
          <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Filtrar por área" className="min-w-[200px]">
            <option value={TODAS}>Todas las áreas</option>
            {areas.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="vivo-segmento" role="group" aria-label="Público">
            <span className="mono-label">Público</span>
            {([TODAS, "ASISTENCIAL", "ADMINISTRATIVO", "AMBOS"] as const).map((p) => (
              <button key={p} type="button" data-activo={publico === p || undefined} onClick={() => setPublico(p)}>
                {p === TODAS ? "Todos" : PUBLICO[p].etiqueta}
              </button>
            ))}
          </div>
          {categorias.length > 1 && (
            <div className="vivo-segmento" role="group" aria-label="Categoría">
              <span className="mono-label">Categoría</span>
              {([TODAS, ...categorias] as const).map((c) => (
                <button key={c} type="button" data-activo={categoria === c || undefined} onClick={() => setCategoria(c)}>
                  {c === TODAS ? "Todas" : CATEGORIA[c].etiqueta}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <section className="space-y-3">
        <div className="grupo-cabecera" data-en-curso="true">
          <span className="grupo-sello" aria-hidden="true">
            <Radio className="h-4 w-4" />
          </span>
          <div>
            <p className="font-display text-[0.98rem] font-bold text-foreground">En vivo ahora</p>
            <p className="text-xs text-muted-foreground">
              {enVivo.length === 0
                ? "Ninguna sala en vivo en este momento"
                : `${enVivo.length} ${enVivo.length === 1 ? "sala abierta" : "salas abiertas"} · entra a la tuya`}
            </p>
          </div>
          <span className="grupo-linea" aria-hidden="true" />
        </div>
        {enVivo.length === 0 ? (
          <div className="vivo-vacio">
            <Radio className="h-6 w-6" aria-hidden="true" />
            <p>{hayFiltro ? "Nada en vivo con estos filtros." : "Cuando empiece una capacitación aparecerá aquí, sin que tengas que esperar el enlace."}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {enVivo.map((f, i) => (
              <Ficha key={f.id} f={f} ahora={ahora} i={i} />
            ))}
          </div>
        )}
      </section>

      {proximas.length > 0 && (
        <section className="space-y-3">
          <div className="grupo-cabecera">
            <span className="grupo-sello" aria-hidden="true">
              <CalendarClock className="h-4 w-4" />
            </span>
            <div>
              <p className="font-display text-[0.98rem] font-bold text-foreground">Próximas</p>
              <p className="text-xs text-muted-foreground">Agendadas en los próximos 7 días</p>
            </div>
            <span className="grupo-linea" aria-hidden="true" />
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {proximas.map((f, i) => (
              <Ficha key={f.id} f={f} ahora={ahora} i={i} compacta />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Ficha({ f, ahora, i, compacta = false }: { f: FichaVivo; ahora: number | null; i: number; compacta?: boolean }) {
  const pub = PUBLICO[f.publico];
  const cat = CATEGORIA[f.categoria];
  const mod = MODALIDAD[f.modalidad];
  const vivo = f.estado === "EN_VIVO";
  const inicio = f.inicio ? new Date(f.inicio) : null;
  const fin = f.fin ? new Date(f.fin) : null;
  const horario = inicio ? `${HORA.format(inicio)}${fin ? ` – ${HORA.format(fin)}` : ""}` : "Sala abierta";
  return (
    <article className={cn("vivo-ficha revelar", compacta && "vivo-ficha-compacta")} data-publico={f.publico} data-vivo={vivo || undefined} style={escalon(i)}>
      <span className="vivo-aurora" aria-hidden="true" />
      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {vivo ? (
            <span className="vivo-pulso">
              <span className="vivo-pulso-punto" aria-hidden="true" />
              En vivo
            </span>
          ) : (
            <span className="vivo-etiqueta">
              <CalendarClock className="h-3 w-3" aria-hidden="true" />
              {inicio ? DIA.format(inicio) : "Próxima"}
            </span>
          )}
          <span className="vivo-etiqueta">
            <cat.Icono className="h-3 w-3" aria-hidden="true" />
            {cat.etiqueta}
          </span>
          {f.prueba && <span className="vivo-etiqueta vivo-etiqueta-prueba">Prueba · solo personal</span>}
        </div>
        {vivo && f.conectados > 0 && (
          <span className="vivo-conectados">
            <Users2 className="h-3.5 w-3.5" aria-hidden="true" />
            {f.conectados} {f.conectados === 1 ? "conectado" : "conectados"}
          </span>
        )}
      </div>

      <div className="relative mt-4 min-w-0">
        <p className="mono-label truncate">
          {f.area ?? "Institucional"}
          {f.programa ? ` · ${f.programa}` : ""}
        </p>
        <h3 className="vivo-titulo">{tituloLegible(f.titulo)}</h3>
        {!compacta && f.objetivo && <p className="vivo-desc">{f.objetivo}</p>}
      </div>

      <div className="vivo-publico relative" title={pub.detalle}>
        <span className="vivo-publico-icono">
          <pub.Icono className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="mono-label">Dirigida a</span>
          <b>Capacitación {pub.etiqueta.toLowerCase()}</b>
          <small className="truncate">{f.publicoNota || pub.detalle}</small>
        </span>
      </div>

      <dl className="vivo-datos relative">
        <div>
          <dt>Horario</dt>
          <dd>
            {horario}
            {inicio && ahora !== null && <small>{relativo(inicio.getTime(), ahora)}</small>}
          </dd>
        </div>
        <div>
          <dt>Modalidad</dt>
          <dd className="flex items-center gap-1.5">
            <mod.Icono className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
            {mod.etiqueta}
          </dd>
        </div>
        {f.responsable && (
          <div className="col-span-2 sm:col-span-1">
            <dt>Responsable</dt>
            <dd className="flex items-center gap-1.5 truncate">
              <UserRound className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
              <span className="truncate">{f.responsable}</span>
            </dd>
          </div>
        )}
      </dl>

      <div className="relative mt-auto flex flex-wrap items-center justify-between gap-3 pt-1">
        <span className="truncate text-[11.5px] text-muted-foreground">{f.plan}</span>
        {vivo ? (
          <a href={f.enlace} className="vivo-entrar">
            <Video className="h-4 w-4" aria-hidden="true" />
            Entrar a la sala
          </a>
        ) : (
          <span className="vivo-espera">Se habilita 30 min antes</span>
        )}
      </div>
    </article>
  );
}
