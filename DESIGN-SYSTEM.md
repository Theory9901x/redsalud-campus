# Sistema de diseño — RedSalud Te Forma

Guía corta de las superficies y tokens definidos en `app/globals.css`. Regla número uno:
**extender este sistema, nunca estilos sueltos ni valores mágicos repetidos.**

## Los dos temas

La plataforma tiene tema **claro y oscuro**. El tema lo elige la persona en el selector
de la barra superior (y en la pantalla de acceso, antes de entrar); se guarda en su
navegador y por defecto sigue al sistema operativo.

**Regla número dos, y es la que más se rompe: nunca `white`, `black`, `rgba(255,…)` ni un
`oklch()` claro escrito a mano en una superficie.** Un blanco literal es una losa luminosa
en modo oscuro. Toda superficie se construye con este par de primitivas:

| Token | Claro | Oscuro | Qué es |
|---|---|---|---|
| `--shade` | navy de marca | negro | El color de **toda** sombra proyectada |
| `--tint` | blanco | azul muy pálido | El color que **ilumina**: brillos internos, vidrio, bordes altos |

Y de los tokens derivados, que ya vienen resueltos por tema:

| Token | Para qué |
|---|---|
| `--glass-bg` / `--glass-border` / `--glass-inset` | Vidrio (`.surface-glass`, `.panel-hud`) |
| `--clay-border` | Borde de las superficies clay |
| `--canvas-base` / `--canvas-page` / `--canvas-aula` | Lienzo nivel 0 completo (color + blobs) |
| `--panel-gradient` | Degradado de fondo del panel nivel 1 |
| `--shadow-clay` / `--shadow-clay-pressed` | Doble sombra clay (cambia de receta entre temas) |

Dos cosas que **sí** llevan blanco literal y está bien: lo que va sobre el **navy de marca**
en los dos temas (`.hud-hero`, `.surface-glass-dark`, `.chip-glass`, `.btn-hud`, el panel
institucional del acceso) y el barrido del certificado. Ahí el navy no cambia, el blanco tampoco.

**El oscuro no es el claro invertido.** En claro la profundidad viene de la sombra
proyectada; en oscuro una sombra negra sobre fondo casi negro no se ve, así que la
profundidad la da el **borde iluminado de arriba** (`--tint` con más peso) y los blobs de
color del lienzo, que pasan a ser la única fuente de luz de la página.

Para escribir una superficie nueva: consume los tokens y **no** escribas
`.dark .mi-clase { … }`. Si te hace falta esa regla, es señal de que falta una primitiva
de tema, no de que sobre un caso especial.

## Escalas (variables en `:root`)

| Token | Valor | Uso |
|---|---|---|
| `--radius-surface` | 24px | Superficies grandes (paneles, heros, glass) |
| `--radius-card` | 20px | Tarjetas e ítems clay |
| `--radius-chip` | 12px | Chips de metadato |
| (Tailwind `rounded-full`) | — | Badges y píldoras |
| `--shadow-0` … `--shadow-3` | — | Elevación 0 (plano) → 3 (panel destacado) |
| `--shadow-clay` / `--shadow-clay-pressed` | — | Doble sombra clay normal / presionada |

Las clases de superficie consumen estas escalas (`.surface` → `--shadow-1`,
`.surface-hover:hover` → `--shadow-2`, `.surface-panel` → `--shadow-3`) en vez de repetir la
misma receta de sombra. Cambiar la escala cambia toda la aplicación de una vez.

## Niveles de superficie

| Clase | Nivel | Cuándo usarla |
|---|---|---|
| `.page-canvas` | 0 | Lienzo de página (frío, con blobs de marca suaves; nunca blanco puro) |
| `.aula-canvas` | 0 | Variante del lienzo con blobs más intensos (aula: el glass necesita más color debajo) |
| `.surface-panel` | 1 | Panel de sección elevado |
| `.surface` (+ `.surface-hover`, `.surface-accent-top`) | 2 | Tarjeta estándar |
| `.surface-glass` | 1–2 | Vidrio sobre fondo claro (sidebar del aula, tarjetas de contenido) |
| `.surface-glass-dark` | 1–2 | Vidrio sobre navy (heros, sidebar oscuro) |
| `.surface-clay` | 2 | Tarjeta/ítem claymórfico (módulos, estados vacíos, botones flotantes) |
| `.surface-clay-pressed` | 2 | Estado activo/seleccionado de un ítem clay (sombra hacia adentro + tinte primario) |
| `.metric-card` (+ `-primary/-success/-warning/-destructive`) | 2 | KPIs con glow de acento en hover |
| `.chip-glass` | 3 | Píldora de metadato sobre fondos oscuros (ícono lucide + texto) |
| `.header-glass` | — | Topbar: sólido arriba, vidrio al hacer scroll (`data-scrolled`) |

## Acentos y detalle

- `.glow-brand` / `.glow-danger` — halo azul de marca / rojo de alerta. **El rojo queda reservado
  para "obligatorio / alerta"**, nunca decorativo.
- `.noise-overlay` — grano al 4% sobre heros con gradiente (aplicar al contenedor `relative`).
- `.progress-fill-animated` — relleno de barra de progreso con degradado primary→success en bucle.
- `.pulse-node` — anillo pulsante del nodo "lección actual" (pariente del pulso ECG).
- `.fade-edge` / `.fade-pattern` — viñeteado para fotos / apagado de patrones decorativos.

## Movimiento

Todo pasa por `lib/motion.ts` (`SIGNATURE_EASE`, `SIGNATURE_DURATION*`, `staggerContainer`,
`fadeSlideUp`) o por `--ease-signature`/`--duration-signature` en CSS. Los `@keyframes` respetan
`prefers-reduced-motion`.

## Reglas de uso

1. **Costo de render**: `backdrop-filter` es caro. Glass va en **contenedores** (pocos por vista);
   los ítems repetidos de una lista/grilla usan **clay** (sombras, baratas).
2. **El glass necesita color debajo**: solo sobre `.page-canvas`/`.aula-canvas` o sobre navy; sobre
   blanco plano se ve gris.
3. **Contraste AA** en texto sobre vidrio: texto principal `text-foreground`, nunca gris claro
   sobre blanco translúcido. En glass-dark, mínimo `text-white/80` para texto secundario.
4. **Focus visible** en todo lo interactivo (`focus-visible:outline-*` con color de marca).
5. Paleta: azul primario + verde éxito sobre navy; el rojo solo para obligatorio/alerta.
6. **Los dos temas, siempre**: nada de blancos ni negros literales en superficies (ver arriba).
   Cualquier vista nueva se revisa en claro **y** en oscuro antes de darla por hecha.
