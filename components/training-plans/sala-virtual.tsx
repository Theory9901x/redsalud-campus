"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  ChevronDown,
  Hand,
  Loader2,
  MessageCircle,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Settings,
  StickyNote,
  Users,
  Activity,
  LayoutGrid,
  Sparkles,
  Volume2,
  Gauge,
  Check,
  RotateCcw,
  SendHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { etiquetaHora } from "@/components/training-plans/labels";

type ParticipanteJitsi = {
  participantId: string;
  displayName?: string;
  formattedDisplayName?: string;
};

type DispositivoJitsi = { deviceId: string; label: string; kind: string };

type JitsiApi = {
  dispose: () => void;
  executeCommand: (comando: string, ...args: unknown[]) => void;
  getParticipantsInfo: () => ParticipanteJitsi[];
  getAvailableDevices: () => Promise<{ audioInput?: DispositivoJitsi[]; videoInput?: DispositivoJitsi[] }>;
  setAudioInputDevice: (label: string, id: string) => void;
  setVideoInputDevice: (label: string, id: string) => void;
  isAudioMuted: () => Promise<boolean>;
  isVideoMuted: () => Promise<boolean>;
  addListener: (evento: string, oyente: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    JitsiMeetExternalAPI?: new (domain: string, options: Record<string, unknown>) => JitsiApi;
  }
}

/** Comandos que otras partes de la página (la barra lateral) pueden enviar a la sala. */
export type ComandoSala = "enfocarChat" | "toggleParticipantsPane" | "abrirConfiguracion" | "enfocarNotas";
export const EVENTO_COMANDO_SALA = "sala:comando";

type Participante = { id: string; nombre: string; esLocal: boolean; manoAlzada: boolean };
type Mensaje = { id: number; autor: string; texto: string; hora: string; propio: boolean; privado: boolean };
type Evento = { hora: string; texto: string };

const FORMATO_HORA = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit" });

function iniciales(nombre: string) {
  return nombre
    .replace(/\s*\((tú|me)\)$/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

/**
 * La videollamada EMBEBIDA dentro de la plataforma, sobre el servidor Jitsi
 * PROPIO de la entidad, con la BARRA DE CONTROLES DE LA PLATAFORMA: los
 * botones son nuestros y hablan con el iframe por la IFrame API oficial
 * (executeCommand + eventos), así que la barra nativa de Jitsi se oculta y
 * el módulo se ve como parte del campus, no como una ventana ajena.
 *
 * RENDIMIENTO: nada aquí sondea. Todo el estado (silencio, cámara, mano,
 * pantalla, chat, quién está) llega por eventos del iframe y solo cambia
 * cuando ocurre algo; la configuración de video es la misma de antes (480p,
 * VP8, últimos 12 videos). El reloj de conexión sigue en una ref y el tramo
 * se reporta una sola vez, al salir, con sendBeacon.
 */
export function SalaVirtual({
  domain,
  roomName,
  activityId,
  displayName,
  subject,
  jwt,
  externalParticipantId,
  esPresentador = false,
  grabacion,
  panelDerecho,
}: {
  domain: string;
  roomName: string;
  activityId: string;
  displayName: string;
  subject: string;
  jwt?: string | null;
  externalParticipantId?: string;
  /** Quien expone (tutor/admin): se marca en la lista de participantes. */
  esPresentador?: boolean;
  /** Control de grabación (solo personal), se pinta en su tarjeta al pie. */
  grabacion?: React.ReactNode;
  /** Lo que va debajo del chat en la columna derecha (informe, evaluación, métricas…). */
  panelDerecho?: React.ReactNode;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const apiRef = useRef<JitsiApi | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [dentro, setDentro] = useState(false);
  const [salio, setSalio] = useState(false);
  const [reintento, setReintento] = useState(0);

  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [micSilenciado, setMicSilenciado] = useState(true);
  const [camaraApagada, setCamaraApagada] = useState(true);
  const [manoAlzada, setManoAlzada] = useState(false);
  const [compartiendo, setCompartiendo] = useState(false);
  const [chatAbierto, setChatAbierto] = useState(false);
  const [mosaico, setMosaico] = useState(false);
  const [calidad, setCalidad] = useState(480);
  const [menu, setMenu] = useState<"mic" | "cam" | "config" | null>(null);
  const [dispositivos, setDispositivos] = useState<{ mic: DispositivoJitsi[]; cam: DispositivoJitsi[] }>({ mic: [], cam: [] });
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [noLeidos, setNoLeidos] = useState(0);
  const notasRef = useRef<HTMLTextAreaElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const contadorMensajes = useRef(0);

  const joinedAtRef = useRef<Date | null>(null);
  const localIdRef = useRef<string | null>(null);

  const registrar = useCallback((texto: string) => {
    setEventos((prev) => [{ hora: FORMATO_HORA.format(new Date()), texto }, ...prev].slice(0, 30));
  }, []);

  useEffect(() => {
    let api: JitsiApi | null = null;
    let cancelado = false;

    function reportarTramo() {
      const joinedAt = joinedAtRef.current;
      joinedAtRef.current = null;
      if (!joinedAt) return;
      const payload = JSON.stringify({
        joinedAt: joinedAt.toISOString(),
        leftAt: new Date().toISOString(),
        displayName,
        ...(externalParticipantId ? { externalParticipantId } : {}),
      });
      navigator.sendBeacon?.(
        `/api/planes-capacitacion/actividades/${activityId}/conexion`,
        new Blob([payload], { type: "application/json" })
      );
    }

    function refrescarParticipantes() {
      if (!api) return;
      const vistos = new Set<string>();
      const lista: Participante[] = [];
      for (const p of api.getParticipantsInfo()) {
        const nombre = (p.formattedDisplayName ?? p.displayName ?? "Participante").replace(/ \(me\)$/, "");
        const esLocal = p.participantId === localIdRef.current || / \(me\)$/.test(p.formattedDisplayName ?? "");
        // Jitsi a veces reporta al participante local dos veces (pantalla
        // compartida, reconexiones): la etiqueta visible no debe repetirse.
        const clave = esLocal ? "local" : nombre;
        if (vistos.has(clave)) continue;
        vistos.add(clave);
        lista.push({ id: p.participantId, nombre, esLocal, manoAlzada: false });
      }
      setParticipantes((prev) =>
        lista.map((p) => ({ ...p, manoAlzada: prev.find((q) => q.id === p.id)?.manoAlzada ?? false }))
      );
    }

    /*
     * En MÓVIL manda la barra NATIVA de Jitsi.
     *
     * El micrófono y la cámara los abre el navegador con getUserMedia DENTRO
     * del iframe, y en teléfonos el permiso solo se solicita si el toque
     * ocurrió en ese mismo marco. Nuestros botones viven fuera y mandan la
     * orden por postMessage: sin gesto propio, el móvil no muestra el diálogo
     * de permiso y el micrófono nunca se abre. En escritorio no pasa (el
     * permiso ya está concedido por origen) y ahí sí se usa nuestra barra.
     */
    const esMovil =
      window.matchMedia("(max-width: 1023px)").matches || window.matchMedia("(pointer: coarse)").matches;

    function crear() {
      if (cancelado || !contenedor.current || !window.JitsiMeetExternalAPI) return;
      api = new window.JitsiMeetExternalAPI(domain, {
        roomName,
        ...(jwt ? { jwt } : {}),
        parentNode: contenedor.current,
        width: "100%",
        height: "100%",
        userInfo: { displayName },
        configOverwrite: {
          subject,
          prejoinConfig: { enabled: true },
          disableDeepLinking: true,
          // La barra de Jitsi se oculta SOLO en escritorio: los controles son
          // los de la plataforma. En móvil se conserva la nativa (ver arriba).
          toolbarButtons: esMovil
            ? [
                "microphone",
                "camera",
                "toggle-camera",
                "hangup",
                "chat",
                "participants-pane",
                "raisehand",
                "tileview",
                "settings",
                "fullscreen",
              ]
            : [],
          // Sus avisos flotantes ("X joined", "Open chat") también: el chat y
          // la actividad de la sesión ya los muestran fuera del video. En
          // móvil se dejan: ahí la interfaz de Jitsi es la que se usa.
          ...(esMovil ? {} : { notifications: [] }),
          /*
           * La barra de Jitsi se esconde sola a los pocos segundos y hay que
           * tocar el video para que vuelva. Para el personal que no está
           * familiarizado con videollamadas eso es una barrera real: se deja
           * FIJA en móvil, con el micrófono siempre a la vista.
           */
          ...(esMovil
            ? { toolbarConfig: { alwaysVisible: true, initialTimeout: 86400000, timeout: 86400000 } }
            : {}),
          // ---- Rendimiento (VPS de 2 CPU y redes institucionales) ----
          startWithAudioMuted: true,
          startWithVideoMuted: true,
          resolution: 480,
          constraints: { video: { height: { ideal: 480, max: 540, min: 180 } } },
          channelLastN: 12,
          disableAudioLevels: true,
          videoQuality: { codecPreferenceOrder: ["VP8", "VP9", "AV1"] },
          p2p: { enabled: true },
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          MOBILE_APP_PROMO: false,
          ...(esMovil
            ? { TOOLBAR_ALWAYS_VISIBLE: true, TOOLBAR_TIMEOUT: 86400000, INITIAL_TOOLBAR_TIMEOUT: 86400000 }
            : { TOOLBAR_BUTTONS: [] }),
        },
      });
      apiRef.current = api;

      api.addListener("videoConferenceJoined", (...args: unknown[]) => {
        const datos = args[0] as { id?: string } | undefined;
        localIdRef.current = datos?.id ?? null;
        joinedAtRef.current = new Date();
        setDentro(true);
        setSalio(false);
        registrar(`${displayName} se unió a la sesión`);
        refrescarParticipantes();
        api?.isAudioMuted().then(setMicSilenciado).catch(() => {});
        api?.isVideoMuted().then(setCamaraApagada).catch(() => {});
      });
      api.addListener("videoConferenceLeft", () => {
        reportarTramo();
        setDentro(false);
        setParticipantes([]);
        registrar("Saliste de la sesión");
      });
      api.addListener("readyToClose", () => {
        setSalio(true);
        api?.dispose();
        apiRef.current = null;
      });
      api.addListener("participantJoined", (...args: unknown[]) => {
        const p = args[0] as { displayName?: string } | undefined;
        registrar(`${p?.displayName ?? "Alguien"} se unió a la sesión`);
        refrescarParticipantes();
      });
      api.addListener("participantLeft", () => {
        registrar("Un participante salió de la sesión");
        refrescarParticipantes();
      });
      api.addListener("displayNameChange", refrescarParticipantes);
      api.addListener("audioMuteStatusChanged", (...args: unknown[]) => setMicSilenciado(Boolean((args[0] as { muted?: boolean })?.muted)));
      api.addListener("videoMuteStatusChanged", (...args: unknown[]) => setCamaraApagada(Boolean((args[0] as { muted?: boolean })?.muted)));
      api.addListener("screenSharingStatusChanged", (...args: unknown[]) => {
        const on = Boolean((args[0] as { on?: boolean })?.on);
        setCompartiendo(on);
        registrar(on ? "Empezaste a compartir pantalla" : "Dejaste de compartir pantalla");
      });
      // Chat de la sala: viaja por el canal propio de Jitsi (XMPP), en
      // tiempo real y sin tocar nuestro servidor. Se muestra en el panel
      // derecho de la plataforma en vez de en la ventana nativa.
      api.addListener("incomingMessage", (...args: unknown[]) => {
        const m = args[0] as { from?: string; nick?: string; message?: string; privateMessage?: boolean } | undefined;
        if (!m?.message) return;
        const texto = m.message;
        setMensajes((prev) =>
          [
            ...prev,
            {
              id: ++contadorMensajes.current,
              autor: m.nick || "Participante",
              texto,
              hora: etiquetaHora(new Date()),
              propio: false,
              privado: Boolean(m.privateMessage),
            },
          ].slice(-200)
        );
        setNoLeidos((n) => n + 1);
      });
      api.addListener("tileViewChanged", (...args: unknown[]) => setMosaico(Boolean((args[0] as { enabled?: boolean })?.enabled)));
      api.addListener("raiseHandUpdated", (...args: unknown[]) => {
        const d = args[0] as { id?: string; handRaised?: number | boolean } | undefined;
        const alzada = Boolean(d?.handRaised);
        if (d?.id && d.id === localIdRef.current) setManoAlzada(alzada);
        setParticipantes((prev) => prev.map((p) => (p.id === d?.id ? { ...p, manoAlzada: alzada } : p)));
        if (alzada) {
          const quien = d?.id === localIdRef.current ? "Levantaste la mano" : "Alguien levantó la mano";
          registrar(quien);
        }
      });
      setCargando(false);
    }

    if (window.JitsiMeetExternalAPI) {
      crear();
    } else {
      const script = document.createElement("script");
      script.src = `https://${domain}/external_api.js`;
      script.async = true;
      script.onload = crear;
      script.onerror = () => {
        setCargando(false);
        setError(true);
      };
      document.body.appendChild(script);
    }

    window.addEventListener("pagehide", reportarTramo);
    return () => {
      cancelado = true;
      window.removeEventListener("pagehide", reportarTramo);
      reportarTramo();
      api?.dispose();
      apiRef.current = null;
    };
  }, [domain, roomName, activityId, displayName, subject, jwt, externalParticipantId, reintento, registrar]);

  // Comandos desde fuera (barra lateral de la sala).
  useEffect(() => {
    function alComando(e: Event) {
      const tipo = (e as CustomEvent<{ tipo: ComandoSala }>).detail?.tipo;
      if (tipo === "enfocarChat") {
        document.getElementById("chat-sala")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        chatInputRef.current?.focus();
      }
      if (tipo === "toggleParticipantsPane") apiRef.current?.executeCommand("toggleParticipantsPane");
      if (tipo === "abrirConfiguracion") setMenu((m) => (m === "config" ? null : "config"));
      if (tipo === "enfocarNotas") notasRef.current?.focus();
    }
    window.addEventListener(EVENTO_COMANDO_SALA, alComando);
    return () => window.removeEventListener(EVENTO_COMANDO_SALA, alComando);
  }, []);

  async function abrirMenuDispositivos(tipo: "mic" | "cam") {
    if (menu === tipo) {
      setMenu(null);
      return;
    }
    setMenu(tipo);
    try {
      const d = await apiRef.current?.getAvailableDevices();
      setDispositivos({ mic: d?.audioInput ?? [], cam: d?.videoInput ?? [] });
    } catch {
      setDispositivos({ mic: [], cam: [] });
    }
  }

  const comando = (nombre: string, ...args: unknown[]) => apiRef.current?.executeCommand(nombre, ...args);
  const inactivo = !dentro;

  function enviarMensaje(texto: string) {
    const limpio = texto.trim();
    if (!limpio || !apiRef.current) return;
    apiRef.current.executeCommand("sendChatMessage", limpio);
    setMensajes((prev) =>
      [...prev, { id: ++contadorMensajes.current, autor: displayName, texto: limpio, hora: etiquetaHora(new Date()), propio: true, privado: false }].slice(-200)
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
    <div className="min-w-0 space-y-5">
      {/* ---------------- Video ---------------- */}
      <section
        id="llamada"
        className="relative overflow-hidden rounded-3xl border border-border/40 bg-navy shadow-[0_24px_60px_-28px_rgba(0,0,0,0.6)] scroll-mt-24"
      >
        <div className="relative h-[58vh] min-h-[420px]">
          {cargando && (
            <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 text-sm text-white/70">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Preparando la sala…
            </div>
          )}
          {error && (
            <div className="absolute inset-0 z-10 flex items-center justify-center px-6 text-center text-sm text-white/80">
              No se pudo cargar el módulo de videollamada. Verifica tu conexión e intenta de nuevo.
            </div>
          )}
          {salio && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-navy/95 px-6 text-center">
              <PhoneOff className="h-8 w-8 text-white/70" aria-hidden="true" />
              <p className="font-display text-lg font-bold text-white">Saliste de la reunión</p>
              <p className="max-w-sm text-sm text-white/70">
                Tu tiempo de conexión quedó registrado. Puedes volver a entrar mientras la jornada siga abierta.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSalio(false);
                  setCargando(true);
                  setReintento((n) => n + 1);
                }}
                className="mt-1 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Volver a entrar
              </button>
            </div>
          )}
          <div ref={contenedor} className="h-full w-full" />

          {/* Estado, sin tapar el video */}
          <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
              <span className={cn("h-2 w-2 rounded-full", dentro ? "bg-success animate-pulse" : "bg-white/40")} />
              {dentro ? "Conectado" : "Sin conectar"}
            </span>
          </div>
          {dentro && (
            <div className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {participantes.length}
              {compartiendo && <span className="ml-1 rounded bg-primary px-1.5 text-[10px] uppercase">Compartiendo</span>}
            </div>
          )}
        </div>
      </section>

      {/* Guía para quien no está familiarizado con videollamadas: en el
          teléfono los controles viven en la barra del propio video. */}
      <p className="flex items-center justify-center gap-2 rounded-2xl border border-[color-mix(in_oklch,var(--accent)_25%,transparent)] bg-[color-mix(in_oklch,var(--accent)_10%,transparent)] px-4 py-3 text-center text-[13px] font-semibold text-foreground lg:hidden">
        <Mic className="h-4 w-4 shrink-0 text-[var(--accent)]" aria-hidden="true" />
        Para hablar, toca el micrófono en la barra del video y permite el acceso.
      </p>

      {/* ---------------- Barra de controles ---------------- */}
      <div className="surface-glass relative hidden px-3 py-2.5 lg:block">
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
          <BotonControl
            etiqueta="Micrófono"
            activo={!micSilenciado}
            alerta={micSilenciado}
            icono={micSilenciado ? MicOff : Mic}
            disabled={inactivo}
            onClick={() => comando("toggleAudio")}
            desplegable={{ abierto: menu === "mic", onClick: () => abrirMenuDispositivos("mic") }}
          />
          <BotonControl
            etiqueta="Cámara"
            activo={!camaraApagada}
            alerta={camaraApagada}
            icono={camaraApagada ? CameraOff : Camera}
            disabled={inactivo}
            onClick={() => comando("toggleVideo")}
            desplegable={{ abierto: menu === "cam", onClick: () => abrirMenuDispositivos("cam") }}
          />
          <BotonControl etiqueta="Levantar mano" activo={manoAlzada} icono={Hand} disabled={inactivo} onClick={() => comando("toggleRaiseHand")} />
          <BotonControl
            etiqueta="Participantes"
            icono={Users}
            disabled={inactivo}
            contador={dentro ? participantes.length : undefined}
            onClick={() => comando("toggleParticipantsPane")}
          />
          <BotonControl etiqueta="Compartir" activo={compartiendo} icono={MonitorUp} disabled={inactivo} onClick={() => comando("toggleShareScreen")} />
          <BotonControl
            etiqueta="Chat"
            activo={chatAbierto}
            icono={MessageCircle}
            disabled={inactivo}
            contador={noLeidos > 0 ? noLeidos : undefined}
            onClick={() => {
              setNoLeidos(0);
              document.getElementById("chat-sala")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
              chatInputRef.current?.focus();
            }}
          />
          <BotonControl
            etiqueta="Configuración"
            activo={menu === "config"}
            icono={Settings}
            disabled={inactivo}
            onClick={() => setMenu((m) => (m === "config" ? null : "config"))}
          />
          <button
            type="button"
            disabled={inactivo}
            onClick={() => comando("hangup")}
            className="ml-1 inline-flex h-[60px] min-w-[92px] flex-col items-center justify-center gap-1 rounded-2xl bg-destructive px-4 text-[11px] font-bold text-white shadow-lg shadow-destructive/30 transition-transform hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
          >
            <PhoneOff className="h-5 w-5" aria-hidden="true" />
            Finalizar
          </button>
        </div>

        {/* Menús desplegables de los botones dinámicos */}
        {menu === "mic" && (
          <MenuFlotante titulo="Micrófono" onCerrar={() => setMenu(null)}>
            {dispositivos.mic.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">Sin dispositivos detectados.</p>
            ) : (
              dispositivos.mic.map((d) => (
                <OpcionMenu key={d.deviceId} onClick={() => { apiRef.current?.setAudioInputDevice(d.label, d.deviceId); setMenu(null); }}>
                  <Mic className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> {d.label || "Micrófono"}
                </OpcionMenu>
              ))
            )}
          </MenuFlotante>
        )}
        {menu === "cam" && (
          <MenuFlotante titulo="Cámara" onCerrar={() => setMenu(null)}>
            {dispositivos.cam.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">Sin cámaras detectadas.</p>
            ) : (
              dispositivos.cam.map((d) => (
                <OpcionMenu key={d.deviceId} onClick={() => { apiRef.current?.setVideoInputDevice(d.label, d.deviceId); setMenu(null); }}>
                  <Camera className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> {d.label || "Cámara"}
                </OpcionMenu>
              ))
            )}
            <OpcionMenu onClick={() => { comando("toggleVirtualBackgroundDialog"); setMenu(null); }}>
              <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Fondo virtual…
            </OpcionMenu>
          </MenuFlotante>
        )}
        {menu === "config" && (
          <MenuFlotante titulo="Configuración de la sala" onCerrar={() => setMenu(null)}>
            <OpcionMenu onClick={() => comando("toggleTileView")}>
              <LayoutGrid className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Vista en mosaico
              {mosaico && <Check className="ml-auto h-3.5 w-3.5 text-success" aria-hidden="true" />}
            </OpcionMenu>
            <OpcionMenu onClick={() => comando("setNoiseSuppressionEnabled", { enabled: true })}>
              <Volume2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" /> Activar supresión de ruido
            </OpcionMenu>
            <p className="mt-1 flex items-center gap-1.5 px-2 pt-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <Gauge className="h-3.5 w-3.5" aria-hidden="true" /> Calidad de video
            </p>
            {[
              { valor: 180, etiqueta: "Baja · ahorra datos" },
              { valor: 360, etiqueta: "Media" },
              { valor: 480, etiqueta: "Estándar (recomendada)" },
              { valor: 720, etiqueta: "Alta · solo buena red" },
            ].map((o) => (
              <OpcionMenu key={o.valor} onClick={() => { comando("setVideoQuality", o.valor); setCalidad(o.valor); }}>
                {o.etiqueta}
                {calidad === o.valor && <Check className="ml-auto h-3.5 w-3.5 text-success" aria-hidden="true" />}
              </OpcionMenu>
            ))}
          </MenuFlotante>
        )}
      </div>

      {/* ---------------- Tarjetas ---------------- */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section id="participantes" className="surface-glass flex flex-col p-6 scroll-mt-24">
          <h3 className="flex items-center gap-2 font-display text-[14px] font-bold text-foreground">
            <Users className="h-4 w-4 text-primary" aria-hidden="true" />
            Participantes conectados
            <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[12px] font-extrabold tabular-nums text-primary">
              {dentro ? participantes.length : 0}
            </span>
          </h3>
          {/* Con mucha gente conectada la lista se desplaza dentro de su
              tarjeta en vez de estirar la página, y cada fila respira. */}
          <ul className="mt-4 max-h-[260px] space-y-1 overflow-y-auto pr-1">
            {!dentro ? (
              <li className="rounded-xl bg-card/50 px-3 py-3 text-[12.5px] leading-relaxed text-muted-foreground">
                Únete a la reunión para ver quiénes están conectados.
              </li>
            ) : (
              participantes.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-card/60">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-success text-[12px] font-extrabold text-white">
                    {iniciales(p.nombre)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                    {p.nombre}
                    {p.esLocal && <span className="text-muted-foreground"> (Tú)</span>}
                  </span>
                  {p.esLocal && esPresentador && (
                    <span className="shrink-0 rounded-md bg-primary/12 px-2 py-0.5 text-[10.5px] font-bold text-primary">Presentador</span>
                  )}
                  {p.manoAlzada && <Hand className="h-4 w-4 shrink-0 text-warning-foreground" aria-label="Mano levantada" />}
                  {p.esLocal && micSilenciado && <MicOff className="h-4 w-4 shrink-0 text-destructive" aria-label="Micrófono silenciado" />}
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="surface-glass flex flex-col p-6">
          <h3 className="flex items-center gap-2 font-display text-[14px] font-bold text-foreground">
            <StickyNote className="h-4 w-4 text-primary" aria-hidden="true" />
            Notas rápidas
          </h3>
          <NotasRapidas activityId={activityId} textareaRef={notasRef} />
        </section>

        <section className="surface-glass flex flex-col p-6">
          <h3 className="flex items-center gap-2 font-display text-[14px] font-bold text-foreground">
            <Activity className="h-4 w-4 text-primary" aria-hidden="true" />
            Actividad de la sesión
          </h3>
          {eventos.length === 0 ? (
            <p className="mt-4 rounded-xl bg-card/50 px-3 py-3 text-[12.5px] leading-relaxed text-muted-foreground">
              Aquí verás entradas, salidas y manos levantadas.
            </p>
          ) : (
            <ol className="mt-4 max-h-[260px] space-y-3.5 overflow-y-auto pr-1">
              {eventos.map((e, i) => (
                <li key={i} className="relative pl-4 text-[12.5px] leading-relaxed">
                  <span className="absolute left-0 top-[7px] h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
                  <span className="block font-semibold text-foreground">{e.hora}</span>
                  <span className="text-muted-foreground">{e.texto}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {grabacion && (
        <div id="grabacion" className="scroll-mt-24">
          {grabacion}
        </div>
      )}
    </div>

    {/* ---------------- Columna derecha: chat + panel ---------------- */}
    <div className="min-w-0 space-y-5">
      <ChatSala
        mensajes={mensajes}
        dentro={dentro}
        inputRef={chatInputRef}
        onEnviar={enviarMensaje}
        onLeer={() => setNoLeidos(0)}
        participantes={participantes.length}
      />
      {panelDerecho}
    </div>
    </div>
  );
}

/**
 * Chat de la sala, al lado derecho como en cualquier videollamada. Solo
 * funciona estando dentro de la reunión (el canal es el de Jitsi); quien
 * aún no entra ve el aviso, no un cuadro muerto.
 */
function ChatSala({
  mensajes,
  dentro,
  inputRef,
  onEnviar,
  onLeer,
  participantes,
}: {
  mensajes: Mensaje[];
  dentro: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onEnviar: (texto: string) => void;
  onLeer: () => void;
  participantes: number;
}) {
  const [texto, setTexto] = useState("");
  const listaRef = useRef<HTMLDivElement>(null);

  // Al llegar mensajes, el hilo baja solo al último.
  useEffect(() => {
    const lista = listaRef.current;
    if (lista) lista.scrollTop = lista.scrollHeight;
  }, [mensajes.length]);

  function enviar() {
    if (!texto.trim()) return;
    onEnviar(texto);
    setTexto("");
  }

  return (
    <section
      id="chat-sala"
      className="surface-glass flex h-[58vh] min-h-[420px] flex-col scroll-mt-24"
      onFocus={onLeer}
      onMouseEnter={onLeer}
      aria-label="Chat de la sala"
    >
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <h3 className="flex items-center gap-2 font-display text-[14px] font-bold text-foreground">
          <MessageCircle className="h-4 w-4 text-primary" aria-hidden="true" />
          Chat de la sala
        </h3>
        <span className="text-[11px] font-semibold text-muted-foreground">
          {dentro ? `${participantes} en línea` : "Sin conectar"}
        </span>
      </div>

      <div ref={listaRef} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3">
        {!dentro ? (
          <p className="rounded-xl bg-card/60 p-3 text-center text-[12.5px] text-muted-foreground">
            Únete a la reunión para escribir en el chat. Los mensajes llegan a todos los que están en la sala.
          </p>
        ) : mensajes.length === 0 ? (
          <p className="pt-6 text-center text-[12.5px] text-muted-foreground">Todavía no hay mensajes. ¡Escribe el primero!</p>
        ) : (
          mensajes.map((m) => (
            <div key={m.id} className={cn("flex flex-col", m.propio ? "items-end" : "items-start")}>
              {!m.propio && (
                <span className="mb-0.5 px-1 text-[11px] font-bold text-foreground">
                  {m.autor}
                  {m.privado && <span className="ml-1 font-semibold text-warning-foreground">· privado</span>}
                </span>
              )}
              <div
                className={cn(
                  "max-w-[88%] rounded-2xl px-3 py-2 text-[13px] leading-snug break-words",
                  m.propio ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-card/80 text-foreground"
                )}
              >
                {m.texto}
              </div>
              <span className="mt-0.5 px-1 text-[10.5px] text-muted-foreground">{m.hora}</span>
            </div>
          ))
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
        className="flex items-center gap-2 border-t border-border/50 p-3"
      >
        <input
          ref={inputRef}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          disabled={!dentro}
          maxLength={1000}
          placeholder={dentro ? "Escribe un mensaje…" : "Únete para chatear"}
          aria-label="Mensaje para el chat de la sala"
          className="h-10 min-w-0 flex-1 rounded-xl border border-border/60 bg-background/70 px-3 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!dentro || !texto.trim()}
          aria-label="Enviar"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
        >
          <SendHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
    </section>
  );
}

function BotonControl({
  etiqueta,
  icono: Icono,
  activo = false,
  alerta = false,
  disabled,
  contador,
  onClick,
  desplegable,
}: {
  etiqueta: string;
  icono: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;
  activo?: boolean;
  alerta?: boolean;
  disabled?: boolean;
  contador?: number;
  onClick: () => void;
  desplegable?: { abierto: boolean; onClick: () => void };
}) {
  return (
    <div className="flex items-stretch">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={activo}
        className={cn(
          "relative inline-flex h-[60px] min-w-[84px] flex-col items-center justify-center gap-1 rounded-2xl px-3 text-[11px] font-semibold transition-colors disabled:opacity-40",
          desplegable && "rounded-r-none",
          activo
            ? "bg-primary/14 text-primary"
            : alerta
              ? "bg-card/70 text-destructive hover:bg-destructive/10"
              : "bg-card/70 text-foreground hover:bg-primary/10 hover:text-primary"
        )}
      >
        <Icono className="h-5 w-5" aria-hidden="true" />
        {etiqueta}
        {contador !== undefined && (
          <span className="absolute right-2 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
            {contador}
          </span>
        )}
      </button>
      {desplegable && (
        <button
          type="button"
          onClick={desplegable.onClick}
          disabled={disabled}
          aria-label={`Opciones de ${etiqueta.toLowerCase()}`}
          aria-expanded={desplegable.abierto}
          className={cn(
            "inline-flex w-7 items-center justify-center rounded-r-2xl border-l border-border/50 bg-card/70 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-40",
            desplegable.abierto && "bg-primary/14 text-primary"
          )}
        >
          <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function MenuFlotante({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: React.ReactNode }) {
  return (
    <div className="absolute bottom-[calc(100%+8px)] left-1/2 z-20 w-72 -translate-x-1/2 rounded-2xl border border-border/60 bg-popover p-2 shadow-xl">
      <div className="flex items-center justify-between px-2 pb-1.5">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{titulo}</p>
        <button type="button" onClick={onCerrar} className="text-xs text-muted-foreground hover:text-foreground">
          Cerrar
        </button>
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function OpcionMenu({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] text-foreground transition-colors hover:bg-primary/10"
    >
      {children}
    </button>
  );
}

/** Notas privadas de quien está en la sala: se guardan en su navegador, sin red. */
function NotasRapidas({ activityId, textareaRef }: { activityId: string; textareaRef: React.RefObject<HTMLTextAreaElement | null> }) {
  const clave = `sala-notas-${activityId}`;
  const [texto, setTexto] = useState("");
  useEffect(() => {
    try {
      setTexto(localStorage.getItem(clave) ?? "");
    } catch {
      // Sin almacenamiento (modo privado): las notas viven solo mientras la pestaña está abierta.
    }
  }, [clave]);
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(clave, texto);
      } catch {
        // idem
      }
    }, 400);
    return () => clearTimeout(t);
  }, [clave, texto]);
  return (
    <div className="mt-4 flex flex-1 flex-col">
      <textarea
        ref={textareaRef}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={6}
        placeholder="Escribe aquí notas importantes de la sesión…"
        className="w-full resize-y rounded-xl border border-border/60 bg-background/70 p-3 text-[13px] leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50"
      />
      <p className="mt-1.5 text-[11px] text-muted-foreground">Estas notas son privadas y solo tú puedes verlas.</p>
    </div>
  );
}
