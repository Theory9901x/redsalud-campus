# Sistema de diseño — RedSalud Te Forma

Guía corta de las superficies y tokens definidos en `app/globals.css`. Regla número uno:
**extender este sistema, nunca estilos sueltos ni valores mágicos repetidos.**

## Escalas (variables en `:root`)

| Token | Valor | Uso |
|---|---|---|
| `--radius-surface` | 24px | Superficies grandes (paneles, heros, glass) |
| `--radius-card` | 20px | Tarjetas e ítems clay |
| `--radius-chip` | 12px | Chips de metadato |
| (Tailwind `rounded-full`) | — | Badges y píldoras |
| `--shadow-0` … `--shadow-3` | — | Elevación 0 (plano) → 3 (panel destacado) |
| `--shadow-clay` / `--shadow-clay-pressed` | — | Doble sombra clay normal / presionada |

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
