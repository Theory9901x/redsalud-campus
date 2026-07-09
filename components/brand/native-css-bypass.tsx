/**
 * CSS nativa moderna que Lightning CSS (el motor de Tailwind v4) todavía no
 * sabe parsear y descarta en silencio durante el build -sin error visible en
 * `npm run build`-, junto con cualquier @keyframes asociado. Se sirve como
 * <style> literal para que llegue intacta al navegador. Dos sintaxis afectadas:
 *
 * 1. animation-timeline: view()/scroll() -- entrada de tarjetas ligada al
 *    scroll real y barra de progreso de lectura del aula virtual.
 *    StaggerGrid/StaggerSections (Framer Motion) ya hacen el mismo fade+slide
 *    vía whileInView y se dejan intactos como fallback: en un navegador sin
 *    soporte, el bloque @supports de abajo simplemente no aplica y Framer
 *    Motion sigue animando como antes. Donde sí hay soporte, la animación CSS
 *    (origen "animación" en la cascada) pisa visualmente el estilo inline que
 *    escribe Framer Motion en cada frame -aunque su JS siga corriendo de
 *    fondo-, así que el resultado es el nativo: progresivo y ligado a la
 *    posición real de scroll, no a un disparador de "entró en viewport" con
 *    duración fija.
 *
 * 2. ::view-transition-*() -- pseudo-elementos funcionales que genera la View
 *    Transitions API nativa (ver native-view-transitions.tsx) al navegar.
 */
const CSS = `
@supports (animation-timeline: view()) {
  .view-fade-in {
    animation: view-fade-slide-up linear both;
    animation-timeline: view();
    animation-range: entry 0% entry 100%;
  }

  @media (prefers-reduced-motion: reduce) {
    .view-fade-in {
      animation: none;
    }
  }
}

@keyframes view-fade-slide-up {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Barra de progreso de lectura del aula virtual: oculta por completo si el
   navegador no soporta scroll-timelines, en vez de mostrar una barra
   estática sin sentido. */
.reading-progress {
  display: none;
}

@supports (animation-timeline: scroll()) {
  .reading-progress {
    position: fixed;
    inset-inline: 0;
    top: 0;
    z-index: 40;
    display: block;
    height: 3px;
    transform: scaleX(0);
    transform-origin: left;
    background: linear-gradient(to right in oklch, var(--primary), var(--success));
    animation: reading-progress-grow linear forwards;
    animation-timeline: scroll(root block);
  }

  @media (prefers-reduced-motion: reduce) {
    .reading-progress {
      animation: none;
      transform: scaleX(0);
    }
  }
}

@keyframes reading-progress-grow {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

/*
 * Transición nativa de página (ver native-view-transitions.tsx): un poco más
 * lenta que el crossfade instantáneo por defecto del navegador, para que se
 * sienta deliberada en vez de un parpadeo.
 */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 320ms;
  animation-timing-function: ease;
}

@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}
`;

export function NativeCssBypass() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}
