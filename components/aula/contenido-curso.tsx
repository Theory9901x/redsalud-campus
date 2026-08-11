"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Lock, Play, Search, ClipboardCheck } from "lucide-react";
import { LESSON_CONTENT_TYPE_ICONS, LESSON_CONTENT_TYPE_LABELS } from "@/components/cursos/labels";
import type { AulaModule, AulaQuiz } from "@/lib/aula";
import type { LessonContentType } from "@prisma/client";

/**
 * Contenido del curso: buscador + acordeón de módulos con línea de tiempo.
 *
 * Es cliente porque filtra y recuerda qué módulos están abiertos. Los datos
 * llegan ya resueltos desde el servidor -incluido si cada lección está
 * abierta y por qué no lo está-: aquí no se decide nada sobre permisos.
 */
export function ContenidoCurso({
  courseId,
  leccionActualId,
  modulos,
  cuestionariosFinales,
}: {
  courseId: string;
  leccionActualId: string | null;
  modulos: AulaModule[];
  cuestionariosFinales: AulaQuiz[];
}) {
  const [busqueda, setBusqueda] = useState("");

  /**
   * Qué módulos están desplegados, en absoluto: el carril se queda como el
   * estudiante lo dejó.
   *
   * La versión anterior guardaba "qué módulos cambió el usuario respecto del
   * valor por defecto", y ese valor por defecto -el módulo de la lección en
   * curso- se recalcula al navegar. El efecto era desconcertante: abrías un
   * módulo a mano, entrabas en una de sus lecciones y se cerraba solo, porque
   * al pasar a ser el de por defecto la marca de "cambiado" lo invertía. Con
   * el módulo plegado desaparecían sus lecciones, el carril encogía y el
   * desplazamiento se iba arriba.
   *
   * Ahora solo se AÑADEN módulos: al entrar en una lección se abre el suyo,
   * pero nunca se cierra ninguno por navegar. Cerrar es siempre un acto
   * explícito.
   *
   * No hace falta sessionStorage: este carril vive en el layout del aula, así
   * que no se desmonta al pasar de una lección a otra.
   */
  const moduloDeLaLeccion = useMemo(
    () => modulos.find((m) => m.lessons.some((l) => l.id === leccionActualId))?.id ?? modulos[0]?.id,
    [modulos, leccionActualId]
  );
  const [abiertos, setAbiertos] = useState<Set<string>>(() =>
    moduloDeLaLeccion ? new Set([moduloDeLaLeccion]) : new Set()
  );

  // Ajuste de estado durante el render al cambiar de lección: es el patrón que
  // React documenta para esto, y evita el useEffect que provocaba un render en
  // cascada en cada navegación. Solo abre; jamás cierra.
  const [moduloPrevio, setModuloPrevio] = useState(moduloDeLaLeccion);
  if (moduloDeLaLeccion !== moduloPrevio) {
    setModuloPrevio(moduloDeLaLeccion);
    if (moduloDeLaLeccion && !abiertos.has(moduloDeLaLeccion)) {
      setAbiertos(new Set(abiertos).add(moduloDeLaLeccion));
    }
  }

  /**
   * Abre o cierra un módulo SIN que se mueva la vista.
   *
   * Al plegar un módulo desaparecen sus lecciones, el contenido de arriba
   * encoge y el navegador recorta el desplazamiento: el carril salta hacia
   * arriba y parece que volviera a empezar. Al desplegarlo pasa lo contrario.
   *
   * La solución es anclar: se mide dónde está la cabecera pulsada respecto de
   * la ventana, se deja que el DOM cambie y se corrige el desplazamiento del
   * carril por la diferencia. El módulo que tocaste se queda exactamente
   * donde estaba y solo se mueve lo que hay debajo.
   */
  function alternar(id: string, boton: HTMLElement) {
    const carril = boton.closest<HTMLElement>("[data-carril]");
    const antes = boton.getBoundingClientRect().top;

    setAbiertos((previo) => {
      const siguiente = new Set(previo);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });

    if (!carril) return;
    // Un cuadro después: para entonces React ya pintó el nuevo alto.
    requestAnimationFrame(() => {
      const despues = boton.getBoundingClientRect().top;
      if (despues !== antes) carril.scrollTop += despues - antes;
    });
  }

  const termino = busqueda.trim().toLowerCase();
  const filtrados = useMemo(() => {
    if (!termino) return modulos;
    return modulos
      .map((m) => {
        // Si coincide el título del módulo, se muestra entero; si no, solo
        // sus lecciones coincidentes.
        if (m.title.toLowerCase().includes(termino)) return m;
        const lessons = m.lessons.filter((l) => l.title.toLowerCase().includes(termino));
        return lessons.length > 0 ? { ...m, lessons } : null;
      })
      .filter((m): m is AulaModule => m !== null);
  }, [modulos, termino]);

  // Al buscar se abren todos los que quedaron: obligar a desplegar uno por
  // uno para ver el resultado de la búsqueda no tiene sentido.
  const estaAbierto = (id: string) => (termino ? true : abiertos.has(id));

  return (
    <div className="space-y-3">
      <label className="surface-inset flex items-center gap-2.5 px-3 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar en el contenido"
          aria-label="Buscar en el contenido del curso"
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </label>

      {termino && filtrados.length === 0 ? (
        <p className="surface-inset px-4 py-6 text-center text-sm text-muted-foreground">
          Nada coincide con «{busqueda}». Prueba con otra palabra del título.
        </p>
      ) : (
        <div className="surface-glass space-y-2 p-3">
          {filtrados.map((modulo) => {
            const abierto = estaAbierto(modulo.id);
            return (
              <section key={modulo.id}>
                <button
                  type="button"
                  onClick={(e) => alternar(modulo.id, e.currentTarget)}
                  aria-expanded={abierto}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted/50"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[color-mix(in_oklch,var(--accent)_14%,transparent)] text-[var(--accent)]">
                    <span className="text-xs font-bold tabular-nums">
                      {modulo.completadas}/{modulo.total}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-foreground">
                      <Resaltado texto={modulo.title} termino={termino} />
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {modulo.completadas} de {modulo.total} completadas
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${abierto ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </button>

                {abierto && (
                  <ul className="carril-lecciones mt-3 mb-1">
                    {/* Lecciones y evaluaciones intercaladas: cada tema del
                        módulo muestra su presentación y, justo debajo, su
                        propia evaluación. */}
                    {modulo.items.map((item) =>
                      item.tipo === "leccion" ? (
                        <li key={item.leccion.id}>
                          <FilaLeccion
                            courseId={courseId}
                            leccion={item.leccion}
                            esActual={item.leccion.id === leccionActualId}
                            termino={termino}
                          />
                        </li>
                      ) : (
                        <li key={item.quiz.id}>
                          <FilaCuestionario courseId={courseId} quiz={item.quiz} />
                        </li>
                      )
                    )}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {cuestionariosFinales.map((quiz) => (
        <FilaCuestionario key={quiz.id} courseId={courseId} quiz={quiz} destacado />
      ))}
    </div>
  );
}

/** Resalta la coincidencia de la búsqueda sin usar dangerouslySetInnerHTML. */
function Resaltado({ texto, termino }: { texto: string; termino: string }) {
  if (!termino) return <>{texto}</>;
  const indice = texto.toLowerCase().indexOf(termino);
  if (indice === -1) return <>{texto}</>;
  return (
    <>
      {texto.slice(0, indice)}
      <mark className="rounded bg-[color-mix(in_oklch,var(--warning)_45%,transparent)] text-foreground">
        {texto.slice(indice, indice + termino.length)}
      </mark>
      {texto.slice(indice + termino.length)}
    </>
  );
}

function FilaLeccion({
  courseId,
  leccion,
  esActual,
  termino,
}: {
  courseId: string;
  leccion: AulaModule["lessons"][number];
  esActual: boolean;
  termino: string;
}) {
  const estado = !leccion.unlocked ? "bloqueada" : leccion.completed ? "completada" : esActual ? "en-curso" : "pendiente";
  const IconoTipo = LESSON_CONTENT_TYPE_ICONS[leccion.contentType as LessonContentType];
  const etiquetaTipo = LESSON_CONTENT_TYPE_LABELS[leccion.contentType as LessonContentType];

  const contenido = (
    <>
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full">
        {estado === "completada" ? (
          <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
        ) : estado === "bloqueada" ? (
          <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        ) : estado === "en-curso" ? (
          <Play className="h-3 w-3 fill-current text-[var(--accent)]" aria-hidden="true" />
        ) : (
          <IconoTipo className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate">
          <Resaltado texto={leccion.title} termino={termino} />
        </span>
        {/* El estado va también en texto: el color del punto por sí solo no
            sirve para quien no distingue colores. */}
        <span className="block text-[11px] text-muted-foreground">
          {etiquetaTipo}
          {leccion.estimatedMinutes ? ` · ${leccion.estimatedMinutes} min` : ""}
          {estado === "completada" ? " · Completada" : estado === "bloqueada" ? " · Bloqueada" : ""}
        </span>
      </span>
    </>
  );

  if (!leccion.unlocked) {
    return (
      <div
        className="leccion cursor-not-allowed"
        data-estado="bloqueada"
        title={leccion.motivoBloqueo ?? undefined}
        aria-disabled="true"
      >
        {contenido}
      </div>
    );
  }

  return (
    <Link
      href={`/aula/${courseId}/${leccion.id}`}
      className="leccion"
      data-estado={estado}
      aria-current={esActual ? "page" : undefined}
    >
      {contenido}
    </Link>
  );
}

function FilaCuestionario({
  courseId,
  quiz,
  destacado = false,
}: {
  courseId: string;
  quiz: AulaQuiz;
  destacado?: boolean;
}) {
  const estado = !quiz.unlocked ? "bloqueada" : quiz.passed ? "completada" : "pendiente";
  const sinIntentos = quiz.attemptsRemaining === 0 && !quiz.passed;

  const detalle = quiz.passed
    ? `Aprobada${quiz.bestScore !== null ? ` con ${quiz.bestScore}%` : ""}`
    : sinIntentos
      ? "Sin intentos disponibles"
      : `Mínimo ${quiz.passingScore}% · ${quiz.attemptsRemaining} de ${quiz.maxAttempts} intentos`;

  const contenido = (
    <>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[color-mix(in_oklch,var(--accent)_16%,transparent)] text-[var(--accent)]">
        <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-foreground">{quiz.title}</span>
        <span className="block text-[11px] text-muted-foreground">{detalle}</span>
      </span>
    </>
  );

  const clases = destacado
    ? "surface-glass flex items-center gap-3 p-4 transition-colors"
    : "leccion";

  if (!quiz.unlocked) {
    return (
      <div
        className={`${clases} cursor-not-allowed opacity-75`}
        data-estado="bloqueada"
        title="Termina el contenido anterior para abrir la evaluación."
        aria-disabled="true"
      >
        {contenido}
      </div>
    );
  }

  return (
    <Link href={`/aula/${courseId}/quiz/${quiz.id}`} className={clases} data-estado={estado}>
      {contenido}
    </Link>
  );
}
