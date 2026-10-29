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
  Maximize2,
  Minimize2,
  PanelRight,
  Presentation,
  Info,
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
export type ComandoSala =
  | "enfocarChat"
  | "toggleParticipantsPane"
  | "abrirConfiguracion"
  | "enfocarNotas"
  | "abrirParticipantes"
  | "abrirBitacora"
  | "abrirNotas"
  | "abrirInfo";

/** Pestaña activa de la consola lateral (chat, personas, bitácora, notas, info). */
export type PanelSala = "chat" | "participantes" | "bitacora" | "notas" | "info";
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
  sessionId,
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
  /** Jornada de esta sala: cada tramo de conexión queda en ella (y su asistencia). */
  sessionId?: string | null;
  /** Quien expone (tutor/admin): se marca en la lista de participantes. */
  esPresentador?: boolean;
  /** Control de grabación (solo personal), se pinta en su tarjeta al pie. */
  grabacion?: React.ReactNode;
  /** Lo que va debajo del chat en la columna derecha (informe, evaluación, métricas…). */
  panelDerecho?: React.ReactNode;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const apiRef = useRef<JitsiApi | null>(null);
  const configSala = useRef({ jwt, subject });
  useEffect(() => {
    configSala.current = { jwt, subject };
    apiRef.current?.executeCommand("subject", subject);
  }, [jwt, subject]);
  const [cargando, setCargando] = useState(true);
  /*
   * PANTALLA COMPLETA tipo Meet: se amplía el escenario (video + controles)
   * con la Fullscreen API del navegador. El iframe de la llamada NO se mueve
   * ni se vuelve a montar -solo cambia el tamaño de su contenedor-, así que
   * ampliar o reducir nunca corta ni reconecta la llamada. Esc también sale.
   */
  const escenarioRef = useRef<HTMLDivElement>(null);
  const [ampliado, setAmpliado] = useState(false);
  /*
   * "TODOS SIGUEN MI VISTA" (Follow me de Jitsi): el anfitrión impone su
   * disposición -qué video está en grande, miniaturas visibles u ocultas,
   * mosaico- a todos los participantes, sin que nadie tenga que recargar.
   * Solo funciona para moderadores (anfitriones con token).
   */
  const [sigueme, setSigueme] = useState(false);
  useEffect(() => {
    const sincronizar = () => setAmpliado(document.fullscreenElement !== null && document.fullscreenElement === escenarioRef.current);
    document.addEventListener("fullscreenchange", sincronizar);
    return () => document.removeEventListener("fullscreenchange", sincronizar);
  }, []);
  const alternarAmpliado = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void escenarioRef.current?.requestFullscreen().catch(() => {});
  };
  const [error, setError] = useState(false);
  const [dentro, setDentro] = useState(false);
  const [salio, setSalio] = useState(false);
  const [reintento, setReintento] = useState(0);

  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [micSilenciado, setMicSilenciado] = useState(true);
  const [camaraApagada, setCamaraApagada] = useState(true);
  const [manoAlzada, setManoAlzada] = useState(false);
  const [compartiendo, setCompartiendo] = useState(false);
  const [mosaico, setMosaico] = useState(false);
  const [calidad, setCalidad] = useState(480);
  const [menu, setMenu] = useState<"mic" | "cam" | "config" | null>(null);
  const [dispositivos, setDispositivos] = useState<{ mic: DispositivoJitsi[]; cam: DispositivoJitsi[] }>({ mic: [], cam: [] });
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [noLeidos, setNoLeidos] = useState(0);
  const [panel, setPanel] = useState<PanelSala>("chat");
  const notasRef = useRef<HTMLTextAreaElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const contadorMensajes = useRef(0);

  const joinedAtRef = useRef<Date | null>(null);
  const localIdRef = useRef<string | null>(null);

  const registrar = useCallback((texto: string) => {
    setEventos((prev) => [{ hora: FORMATO_HORA.format(new Date()), texto }, ...prev].slice(0, 30));
  }, []);

  useEffect(() => {
    const { jwt, subject } = configSala.current;
    let api: JitsiApi | null = null;
    let cancelado = false;

    function reportarTramo(event: "HEARTBEAT" | "LEAVE" = "LEAVE") {
      const joinedAt = joinedAtRef.current;
      joinedAtRef.current = null;
      if (!joinedAt) return;
      const payload = JSON.stringify({
        event,
        joinedAt: joinedAt.toISOString(),
        leftAt: new Date().toISOString(),
        displayName,
        ...(externalParticipantId ? { externalParticipantId } : {}),
        ...(sessionId ? { sessionId } : {}),
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
        // Interfaz de Jitsi en español (pantalla previa "Unirse a la reunión",
        // menús, avisos). Solo idioma: no cambia ninguna función.
        lang: "es",
        configOverwrite: {
          defaultLanguage: "es",
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
        void fetch(`/api/planes-capacitacion/actividades/${activityId}/conexion`, { method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true, body: JSON.stringify({ event: "JOIN", joinedAt: joinedAtRef.current.toISOString(), displayName, ...(externalParticipantId ? { externalParticipantId } : {}), ...(sessionId ? { sessionId } : {}) }) }).catch(() => {});
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

    const alSalir = () => reportarTramo();
    window.addEventListener("pagehide", alSalir);
    // Corte periódico: cierra el tramo en curso y abre otro desde ahora.
    const corte = setInterval(() => {
      if (!joinedAtRef.current) return;
      reportarTramo("HEARTBEAT");
      joinedAtRef.current = new Date();
    }, 60_000);
    return () => {
      cancelado = true;
      clearInterval(corte);
      window.removeEventListener("pagehide", alSalir);
      reportarTramo();
      api?.dispose();
      apiRef.current = null;
    };
  }, [domain, roomName, activityId, displayName, externalParticipantId, sessionId, reintento, registrar]);

  // Comandos desde fuera (barra lateral de la sala).
  useEffect(() => {
    function alComando(e: Event) {
      const tipo = (e as CustomEvent<{ tipo: ComandoSala }>).detail?.tipo;
      const irAConsola = () => document.getElementById("consola-sala")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      if (tipo === "enfocarChat") {
        setPanel("chat");
        irAConsola();
        setTimeout(() => chatInputRef.current?.focus(), 50);
      }
      if (tipo === "toggleParticipantsPane") apiRef.current?.executeCommand("toggleParticipantsPane");
      if (tipo === "abrirConfiguracion") setMenu((m) => (m === "config" ? null : "config"));
      if (tipo === "enfocarNotas") { setPanel("notas"); setTimeout(() => notasRef.current?.focus(), 50); }
      if (tipo === "abrirParticipantes") { setPanel("participantes"); irAConsola(); }
      if (tipo === "abrirBitacora") { setPanel("bitacora"); irAConsola(); }
      if (tipo === "abrirNotas") { setPanel("notas"); irAConsola(); }
      if (tipo === "abrirInfo") { setPanel("info"); irAConsola(); }
    }
    window.addEventListener(EVENTO_COMANDO_SALA, alComando);
    return () => window.removeEventListener(EVENTO_COMANDO_SALA, alComando);
  }, []);

  // Cronómetro de la conexión actual: un tic por segundo, solo estando dentro.
  const [transcurrido, setTranscurrido] = useState(0);
  useEffect(() => {
    if (!dentro) return;
    const inicio = Date.now();
    const t = setInterval(() => setTranscurrido(Math.floor((Date.now() - inicio) / 1000)), 1000);
    return () => { clearInterval(t); setTranscurrido(0); };
  }, [dentro]);

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

  const reloj = (() => {
    const h = Math.floor(transcurrido / 3600), m = Math.floor((transcurrido % 3600) / 60), sg = transcurrido % 60;
    const dd = (n: number) => String(n).padStart(2, "0");
    return h ? `${dd(h)}:${dd(m)}:${dd(sg)}` : `${dd(m)}:${dd(sg)}`;
  })();
  const manos = participantes.filter((p) => p.manoAlzada).length;

  return (
    <div className="sala-scope grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_384px]">
    <div ref={escenarioRef} className={cn("min-w-0", ampliado && "overflow-y-auto bg-[var(--sh-bg)] p-4")}>
      {/* ---------------- Escenario ---------------- */}
      <section
        id="llamada"
        data-dentro={dentro}
        className="sh-stage sh-rise relative overflow-hidden rounded-[var(--sh-radius)] border border-[var(--sh-line-strong)] bg-black shadow-[0_40px_90px_-40px_rgba(0,0,0,0.9)] scroll-mt-24"
        style={{ "--i": 2 } as React.CSSProperties}
      >
        <div className={cn("relative", ampliado ? "h-[calc(100vh-150px)] min-h-[320px]" : "h-[calc(100vh-250px)] min-h-[460px] max-h-[860px]")}>
          <div ref={contenedor} className="h-full w-full" />
          <div className="sh-corners pointer-events-none absolute inset-0" aria-hidden="true" />
          <div className="sh-scan" aria-hidden="true" />

          {cargando && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[var(--sh-bg)]/80 text-[var(--sh-muted)]">
              <Loader2 className="h-5 w-5 animate-spin text-[var(--sh-signal)]" aria-hidden="true" />
              <span className="sh-label">Preparando la sala</span>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 z-10 flex items-center justify-center px-6 text-center text-sm text-[var(--sh-muted)]">
              No se pudo cargar la sala. Verifica tu conexión e intenta de nuevo.
            </div>
          )}
          {salio && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[var(--sh-bg)]/95 px-6 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full border border-[var(--sh-line-strong)] bg-[var(--sh-panel-2)]">
                <PhoneOff className="h-6 w-6 text-[var(--sh-muted)]" aria-hidden="true" />
              </span>
              <p className="sh-display text-2xl font-bold uppercase tracking-wide">Saliste de la reunión</p>
              <p className="max-w-sm text-[13px] leading-relaxed text-[var(--sh-muted)]">
                Tu tiempo de conexión quedó registrado. Puedes volver a entrar mientras la jornada siga abierta.
              </p>
              <button
                type="button"
                onClick={() => { setSalio(false); setCargando(true); setReintento((n) => n + 1); }}
                className="sh-display mt-2 inline-flex items-center gap-2 rounded-full bg-[var(--sh-signal)] px-5 py-2.5 text-[13px] font-bold uppercase tracking-[0.14em] text-white shadow-[0_0_30px_-6px_var(--sh-signal)] transition-transform hover:-translate-y-0.5"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Volver a entrar
              </button>
            </div>
          )}

          {/* Telemetría sobre el video: solo escritorio (en móvil manda la barra nativa). */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[6] hidden items-start justify-between p-4 lg:flex">
            <span className="sh-chip bg-black/50 backdrop-blur-sm">
              {dentro ? <span className="sh-live-dot" aria-hidden="true" /> : <span className="h-2 w-2 rounded-full bg-[var(--sh-dim)]" aria-hidden="true" />}
              <span className="sh-label text-[var(--sh-text)]">{dentro ? "En vivo" : "En espera"}</span>
            </span>
            <div className="flex items-center gap-2">
              {dentro && manos > 0 && (
                <span className="sh-chip bg-black/50 text-warning backdrop-blur-sm">
                  <Hand className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="sh-mono text-[12px]">{manos}</span>
                </span>
              )}
              {dentro && (
                <span className="sh-chip bg-black/50 backdrop-blur-sm">
                  <Users className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="sh-mono text-[12px] text-[var(--sh-text)]">{participantes.length}</span>
                </span>
              )}
              <span className="sh-chip bg-black/50 backdrop-blur-sm">
                <span className="sh-mono text-[13px] text-[var(--sh-text)]">{reloj}</span>
              </span>
              {compartiendo && (
                <span className="sh-chip border-[var(--sh-signal)] bg-[var(--sh-signal)]/25 text-white">
                  <MonitorUp className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="sh-label text-white">Compartiendo</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Guía para quien no está familiarizado con videollamadas: en el
          teléfono los controles viven en la barra del propio video. */}
      <p className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-[var(--sh-line-strong)] bg-[var(--sh-panel)] px-4 py-3 text-center text-[13px] font-semibold lg:hidden">
        <Mic className="h-4 w-4 shrink-0 text-[var(--sh-signal)]" aria-hidden="true" />
        Para hablar, toca el micrófono en la barra del video y permite el acceso.
      </p>

      {/* ---------------- Dock de controles (flota sobre el borde del escenario) ---------------- */}
      <div className="sh-rise relative z-20 mx-auto -mt-9 hidden w-fit max-w-full lg:block" style={{ "--i": 4 } as React.CSSProperties}>
        <div className="sh-panel flex flex-wrap items-center justify-center gap-1 rounded-full bg-[color-mix(in_oklch,var(--sh-bg)_78%,transparent)] px-3 py-2 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.9)]">
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
          <BotonControl etiqueta="Mano" activo={manoAlzada} icono={Hand} disabled={inactivo} onClick={() => comando("toggleRaiseHand")} />
          <BotonControl etiqueta="Compartir" activo={compartiendo} icono={MonitorUp} disabled={inactivo} onClick={() => comando("toggleShareScreen")} />
          <BotonControl
            etiqueta="Personas"
            icono={Users}
            activo={panel === "participantes"}
            contador={dentro ? participantes.length : undefined}
            onClick={() => setPanel("participantes")}
          />
          <BotonControl
            etiqueta="Chat"
            activo={panel === "chat"}
            icono={MessageCircle}
            contador={noLeidos > 0 ? noLeidos : undefined}
            onClick={() => { setNoLeidos(0); setPanel("chat"); setTimeout(() => chatInputRef.current?.focus(), 50); }}
          />
          <BotonControl
            etiqueta={ampliado ? "Reducir" : "Ampliar"}
            activo={ampliado}
            icono={ampliado ? Minimize2 : Maximize2}
            onClick={alternarAmpliado}
          />
          <BotonControl
            etiqueta="Ajustes"
            activo={menu === "config"}
            icono={Settings}
            disabled={inactivo}
            onClick={() => setMenu((m) => (m === "config" ? null : "config"))}
          />
          <span className="mx-1 h-9 w-px bg-[var(--sh-line-strong)]" aria-hidden="true" />
          <button
            type="button"
            disabled={inactivo}
            onClick={() => comando("hangup")}
            className="sh-display inline-flex h-[52px] items-center gap-2 rounded-full bg-[var(--sh-danger)] px-5 text-[12px] font-bold uppercase tracking-[0.16em] text-white shadow-[0_0_28px_-4px_var(--sh-danger)] transition-transform hover:-translate-y-0.5 disabled:opacity-35 disabled:shadow-none disabled:hover:translate-y-0"
          >
            <PhoneOff className="h-5 w-5" aria-hidden="true" />
            Salir
          </button>
        </div>

        {/* Menús desplegables de los botones dinámicos */}
        {menu === "mic" && (
          <MenuFlotante titulo="Micrófono" onCerrar={() => setMenu(null)}>
            {dispositivos.mic.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-[var(--sh-dim)]">Sin dispositivos detectados.</p>
            ) : (
              dispositivos.mic.map((d) => (
                <OpcionMenu key={d.deviceId} onClick={() => { apiRef.current?.setAudioInputDevice(d.label, d.deviceId); setMenu(null); }}>
                  <Mic className="h-3.5 w-3.5 text-[var(--sh-signal)]" aria-hidden="true" /> {d.label || "Micrófono"}
                </OpcionMenu>
              ))
            )}
          </MenuFlotante>
        )}
        {menu === "cam" && (
          <MenuFlotante titulo="Cámara" onCerrar={() => setMenu(null)}>
            {dispositivos.cam.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-[var(--sh-dim)]">Sin cámaras detectadas.</p>
            ) : (
              dispositivos.cam.map((d) => (
                <OpcionMenu key={d.deviceId} onClick={() => { apiRef.current?.setVideoInputDevice(d.label, d.deviceId); setMenu(null); }}>
                  <Camera className="h-3.5 w-3.5 text-[var(--sh-signal)]" aria-hidden="true" /> {d.label || "Cámara"}
                </OpcionMenu>
              ))
            )}
            <OpcionMenu onClick={() => { comando("toggleVirtualBackgroundDialog"); setMenu(null); }}>
              <Sparkles className="h-3.5 w-3.5 text-[var(--sh-signal)]" aria-hidden="true" /> Fondo virtual…
            </OpcionMenu>
          </MenuFlotante>
        )}
        {menu === "config" && (
          <MenuFlotante titulo="Ajustes de la sala" onCerrar={() => setMenu(null)}>
            {esPresentador && (
              <OpcionMenu onClick={() => { const v = !sigueme; comando("setFollowMe", v); setSigueme(v); }}>
                <Presentation className="h-3.5 w-3.5 text-[var(--sh-signal)]" aria-hidden="true" /> Todos siguen mi vista
                {sigueme && <Check className="ml-auto h-3.5 w-3.5 text-[var(--sh-live)]" aria-hidden="true" />}
              </OpcionMenu>
            )}
            <OpcionMenu onClick={() => { comando("toggleFilmStrip"); setMenu(null); }}>
              <PanelRight className="h-3.5 w-3.5 text-[var(--sh-signal)]" aria-hidden="true" /> Mostrar u ocultar miniaturas
            </OpcionMenu>
            <OpcionMenu onClick={() => comando("toggleTileView")}>
              <LayoutGrid className="h-3.5 w-3.5 text-[var(--sh-signal)]" aria-hidden="true" /> Vista en mosaico
              {mosaico && <Check className="ml-auto h-3.5 w-3.5 text-[var(--sh-live)]" aria-hidden="true" />}
            </OpcionMenu>
            <OpcionMenu onClick={() => comando("setNoiseSuppressionEnabled", { enabled: true })}>
              <Volume2 className="h-3.5 w-3.5 text-[var(--sh-signal)]" aria-hidden="true" /> Activar supresión de ruido
            </OpcionMenu>
            <p className="sh-label mt-2 flex items-center gap-1.5 px-2 pt-2">
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
                {calidad === o.valor && <Check className="ml-auto h-3.5 w-3.5 text-[var(--sh-live)]" aria-hidden="true" />}
              </OpcionMenu>
            ))}
          </MenuFlotante>
        )}
      </div>

      {grabacion && (
        <div id="grabacion" className="sh-rise mt-4 scroll-mt-24" style={{ "--i": 5 } as React.CSSProperties}>
          {grabacion}
        </div>
      )}
    </div>

    {/* ---------------- Consola lateral ---------------- */}
    <aside
      id="consola-sala"
      className="sh-panel sh-rise flex min-h-[520px] flex-col overflow-hidden scroll-mt-24 xl:sticky xl:top-4 xl:h-[calc(100vh-250px)] xl:min-h-[460px] xl:max-h-[860px]"
      style={{ "--i": 3 } as React.CSSProperties}
      aria-label="Consola de la sala"
    >
      <div role="tablist" aria-label="Paneles de la sala" className="flex items-stretch border-b border-[var(--sh-line)] px-2">
        <PestanaConsola activa={panel === "chat"} onClick={() => { setPanel("chat"); setNoLeidos(0); }} icono={MessageCircle} etiqueta="Chat" contador={noLeidos > 0 ? noLeidos : undefined} />
        <PestanaConsola activa={panel === "participantes"} onClick={() => setPanel("participantes")} icono={Users} etiqueta="Personas" contador={dentro ? participantes.length : undefined} />
        <PestanaConsola activa={panel === "bitacora"} onClick={() => setPanel("bitacora")} icono={Activity} etiqueta="Bitácora" />
        <PestanaConsola activa={panel === "notas"} onClick={() => setPanel("notas")} icono={StickyNote} etiqueta="Notas" />
        {panelDerecho && <PestanaConsola activa={panel === "info"} onClick={() => setPanel("info")} icono={Info} etiqueta="Info" />}
      </div>

      {panel === "chat" && (
        <ChatSala
          mensajes={mensajes}
          dentro={dentro}
          inputRef={chatInputRef}
          onEnviar={enviarMensaje}
          onLeer={() => setNoLeidos(0)}
          participantes={participantes.length}
        />
      )}

      {panel === "participantes" && (
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {!dentro ? (
            <AvisoConsola>Únete a la reunión para ver quiénes están conectados.</AvisoConsola>
          ) : (
            <ul className="space-y-0.5">
              {participantes.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-2xl px-2.5 py-2.5 transition-colors hover:bg-[var(--sh-panel-2)]">
                  <span className="sh-display grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--sh-line-strong)] bg-[var(--sh-panel-2)] text-[13px] font-bold text-[var(--sh-text)]">
                    {iniciales(p.nombre)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold">
                      {p.nombre}
                      {p.esLocal && <span className="text-[var(--sh-dim)]"> · tú</span>}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      {p.esLocal && esPresentador && <span className="sh-label rounded-md bg-[var(--sh-signal)]/20 px-1.5 py-0.5 text-[0.58rem] text-[var(--sh-text)]">Presentador</span>}
                      {p.manoAlzada && (
                        <span className="sh-label inline-flex items-center gap-1 rounded-md bg-warning/20 px-1.5 py-0.5 text-[0.58rem] text-warning">
                          <Hand className="h-3 w-3" aria-hidden="true" /> Mano
                        </span>
                      )}
                      {p.esLocal && micSilenciado && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[var(--sh-dim)]">
                          <MicOff className="h-3 w-3 text-[var(--sh-danger)]" aria-hidden="true" /> Micrófono apagado
                        </span>
                      )}
                    </span>
                  </span>
                  {p.manoAlzada && <span className="sh-live-dot" style={{ background: "var(--warning)" }} aria-hidden="true" />}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {panel === "bitacora" && (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {eventos.length === 0 ? (
            <AvisoConsola>Aquí verás entradas, salidas y manos levantadas.</AvisoConsola>
          ) : (
            <ol className="relative space-y-4 border-l border-[var(--sh-line-strong)] pl-4">
              {eventos.map((e, i) => (
                <li key={i} className="relative text-[13px] leading-snug">
                  <span className="absolute -left-[21px] top-[5px] h-2 w-2 rounded-full bg-[var(--sh-signal)] shadow-[0_0_10px_var(--sh-signal)]" aria-hidden="true" />
                  <span className="sh-mono block text-[11px] text-[var(--sh-dim)]">{e.hora}</span>
                  <span className="text-[var(--sh-text)]">{e.texto}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {panel === "notas" && (
        <div className="flex min-h-0 flex-1 flex-col px-4 py-4">
          <NotasRapidas activityId={activityId} textareaRef={notasRef} />
        </div>
      )}

      {panel === "info" && <div className="min-h-0 flex-1 overflow-y-auto p-4">{panelDerecho}</div>}
    </aside>
    </div>
  );
}

function PestanaConsola({ activa, onClick, icono: Icono, etiqueta, contador }: {
  activa: boolean; onClick: () => void; icono: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>; etiqueta: string; contador?: number;
}) {
  return (
    <button type="button" role="tab" aria-selected={activa} onClick={onClick} className="sh-tab flex-1 justify-center">
      <Icono className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="hidden sm:inline">{etiqueta}</span>
      {contador !== undefined && (
        <span className="sh-mono grid h-4 min-w-4 place-items-center rounded-full bg-[var(--sh-signal)] px-1 text-[10px] font-bold text-white">{contador}</span>
      )}
    </button>
  );
}

function AvisoConsola({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-[var(--sh-line-strong)] px-4 py-5 text-center text-[12.5px] leading-relaxed text-[var(--sh-muted)]">
      {children}
    </p>
  );
}

/**
 * Chat de la sala. Solo funciona estando dentro de la reunión (el canal es
 * el de Jitsi); quien aún no entra ve el aviso, no un cuadro muerto.
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
    <div id="chat-sala" className="flex min-h-0 flex-1 flex-col" onFocus={onLeer} onMouseEnter={onLeer} aria-label="Chat de la sala">
      <div ref={listaRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {!dentro ? (
          <AvisoConsola>Únete a la reunión para escribir en el chat. Los mensajes llegan a todos los que están en la sala.</AvisoConsola>
        ) : mensajes.length === 0 ? (
          <p className="sh-label pt-8 text-center">{participantes} en línea · sin mensajes</p>
        ) : (
          mensajes.map((m) => (
            <div key={m.id} className={cn("flex flex-col", m.propio ? "items-end" : "items-start")}>
              {!m.propio && (
                <span className="sh-label mb-1 px-1 text-[0.6rem]">
                  {m.autor}
                  {m.privado && <span className="ml-1 text-warning">· privado</span>}
                </span>
              )}
              <div
                className={cn(
                  "max-w-[88%] rounded-2xl px-3.5 py-2 text-[13px] leading-snug break-words",
                  m.propio
                    ? "rounded-br-md bg-[var(--sh-signal)] text-white shadow-[0_8px_24px_-12px_var(--sh-signal)]"
                    : "rounded-bl-md border border-[var(--sh-line)] bg-[var(--sh-panel-2)] text-[var(--sh-text)]"
                )}
              >
                {m.texto}
              </div>
              <span className="sh-mono mt-1 px-1 text-[10px] text-[var(--sh-dim)]">{m.hora}</span>
            </div>
          ))
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); enviar(); }} className="flex items-center gap-2 border-t border-[var(--sh-line)] p-3">
        <input
          ref={inputRef}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          disabled={!dentro}
          maxLength={1000}
          placeholder={dentro ? "Escribe un mensaje…" : "Únete para chatear"}
          aria-label="Mensaje para el chat de la sala"
          className="sh-input h-11 min-w-0 flex-1 px-3.5 text-[13px] disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!dentro || !texto.trim()}
          aria-label="Enviar"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--sh-signal)] text-white shadow-[0_0_24px_-6px_var(--sh-signal)] transition-transform hover:-translate-y-0.5 disabled:opacity-35 disabled:shadow-none disabled:hover:translate-y-0"
        >
          <SendHorizontal className="h-4 w-4" aria-hidden="true" />
        </button>
      </form>
    </div>
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
        data-estado={activo ? "activo" : alerta ? "alerta" : undefined}
        className={cn("sh-dock-btn relative", desplegable && "rounded-r-none pr-2")}
      >
        <Icono className="h-5 w-5" aria-hidden="true" />
        {etiqueta}
        {contador !== undefined && (
          <span className="sh-mono absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--sh-signal)] px-1 text-[10px] font-bold text-white">
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
            "inline-flex w-6 items-center justify-center rounded-r-2xl border-l border-[var(--sh-line)] text-[var(--sh-dim)] transition-colors hover:bg-[var(--sh-panel-2)] hover:text-[var(--sh-text)] disabled:opacity-35",
            desplegable.abierto && "bg-[var(--sh-signal)]/20 text-[var(--sh-text)]"
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
    <div className="sh-panel absolute bottom-[calc(100%+10px)] left-1/2 z-30 w-72 -translate-x-1/2 bg-[color-mix(in_oklch,var(--sh-bg)_88%,transparent)] p-2">
      <div className="flex items-center justify-between px-2 pb-1.5">
        <p className="sh-label">{titulo}</p>
        <button type="button" onClick={onCerrar} className="text-xs text-[var(--sh-dim)] hover:text-[var(--sh-text)]">
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
      className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[12.5px] text-[var(--sh-text)] transition-colors hover:bg-[var(--sh-panel-2)]"
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
    const cargar = setTimeout(() => {
      try { setTexto(localStorage.getItem(clave) ?? ""); } catch { /* Notas solo en memoria. */ }
    }, 0);
    return () => clearTimeout(cargar);
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
    <div className="flex min-h-0 flex-1 flex-col">
      <textarea
        ref={textareaRef}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Escribe aquí notas importantes de la sesión…"
        className="sh-input min-h-[200px] flex-1 resize-none p-3.5 text-[13px] leading-relaxed"
      />
      <p className="sh-label mt-2 text-[0.58rem]">Privadas · solo tú las ves</p>
    </div>
  );
}
