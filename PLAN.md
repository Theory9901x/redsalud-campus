# RedSalud Te Forma — Campus Virtual (LMS) · Plan de construcción por fases

Plataforma de capacitación institucional para **Red Salud Casanare E.S.E.**: inducción, reinducción, plan de capacitaciones y certificación de cumplimiento.

**Regla de oro:** se construye una fase a la vez. Al terminar cada fase se ejecuta su prueba de aceptación antes de pasar a la siguiente. No se avanza con una fase a medias.

**Stack (decidido, no reabrir):** Next.js 16 + TypeScript + Tailwind CSS + shadcn/ui + Framer Motion + Prisma + PostgreSQL + Auth.js (credenciales + JWT). Sin carpeta `src/` (todo en la raíz: `app/`, `lib/`, `components/`).

**Infraestructura:** PostgreSQL en VPS propio (Ubuntu). Desarrollo local vía túnel SSH a la base `redsalud_dev`. Producción en el mismo VPS con PM2 + Nginx + SSL, en el subdominio del campus. El proyecto es portátil (todo en git, todo lo del entorno en `.env`) para poder clonarlo y redesplegarlo en el VPS institucional de RedSalud cuando el proyecto pase a producción.

**Estética:** moderna, limpia e institucional — gradientes sutiles, tarjetas con sombras suaves, microinteracciones, dashboard pulido, responsive. Marca RedSalud: navy `#0F2438` (base/sidebar), azul `#2BA6DE` (primario), rojo `#E8414D` (error), verde `#3BB54A` (éxito/aprobado), amarillo `#FFC20E` (advertencia/en progreso), fondos gris muy claro. Tipografía display Bricolage Grotesque 800 para títulos y métricas; Inter para cuerpo. Motivo de marca: línea de pulso ECG como detalle sutil.

**Reglas transversales:** interfaz en español · contraseñas con bcrypt · rutas protegidas por rol (ADMIN, TUTOR, STUDENT) · calificación de cuestionarios siempre en el servidor, el campo `isCorrect` nunca viaja al cliente antes de calificar · `.env` nunca se sube a git, mantener `.env.example` · commits pequeños y descriptivos · mantener un `DEPLOY.md` con los pasos de despliegue.

---

## FASE 1 — Fundación: autenticación, roles, usuarios y panel administrativo

Alcance:
- Auth.js con login por correo y contraseña (credenciales + JWT). El admin crea cuentas con contraseña temporal (`mustChangePassword`).
- Middleware de protección de rutas por rol: `/admin/*` solo ADMIN, `/tutor/*` TUTOR y ADMIN, `/(app)/*` cualquier usuario autenticado.
- Seed inicial: un usuario ADMIN, categorías de curso base, y datos demo mínimos.
- Layout del panel admin: sidebar con Dashboard, Usuarios, Cursos, Inscripciones, Certificados, Reportes, Configuración (las secciones futuras muestran "Próximamente"). Identidad visual de marca aplicada.
- Dashboard admin con tarjetas de métricas leyendo conteos reales (total estudiantes, tutores, cursos, certificados).
- Gestión de usuarios completa: tabla con búsqueda (nombre, cédula, correo) y filtros (rol, estado); crear, editar, activar/desactivar; vista de detalle.

Prueba de aceptación F1:
1. Crear un admin, un tutor y un estudiante desde el panel.
2. Iniciar sesión con cada uno y verificar que cada rol ve solo sus rutas.
3. Como estudiante, intentar entrar a `/admin` por URL directa → debe rechazar y redirigir.
4. Confirmar que las contraseñas se guardan hasheadas (nunca en texto plano) en la base.

---

## FASE 2 — Cursos, módulos, lecciones y contenidos

Alcance:
- CRUD de categorías (solo admin).
- CRUD de cursos: el tutor crea/edita sus cursos en borrador; el admin edita todos y es el único que publica.
- Editor de estructura: módulos reordenables, y lecciones reordenables dentro de cada módulo.
- Editor de lección por tipo de contenido: texto enriquecido, video de YouTube embebido, PDF/imagen subidos al servidor, enlace externo. Marcar lección obligatoria y tiempo estimado.
- Subida de archivos (imagen destacada del curso, PDFs, imágenes) al almacenamiento del VPS.
- Vista pública: catálogo de cursos publicados (`/cursos`) y página de detalle con temario (contenido bloqueado si no está inscrito).

Prueba de aceptación F2:
1. Como tutor: crear un curso con 2 módulos y 4 lecciones (texto, YouTube, PDF, imagen). Reordenar.
2. Como admin: publicar el curso; aparece en el catálogo.
3. El detalle muestra el temario sin exponer el contenido a no inscritos.
4. Subir un PDF de varios MB y confirmar que se sirve correctamente.

---

## FASE 3 — Inscripciones, aula virtual y progreso

Alcance:
- Inscripciones: asignación individual y masiva por el admin; autoinscripción si el curso es de modalidad abierta; cancelación; estado y avance por estudiante.
- Dashboard del estudiante: "Mis cursos" con barra de progreso y estado.
- Aula virtual: sidebar de módulos/lecciones (con bloqueo secuencial si el curso lo define), render del contenido según tipo, botón "Marcar como completada".
- Cálculo automático del porcentaje de avance (lecciones obligatorias completadas / total). El curso pasa a "completado" al cumplir el 100% de lo obligatorio.

Prueba de aceptación F3:
1. Asignar el estudiante al curso de la F2; completar las lecciones; la barra llega a 100%.
2. Un estudiante no inscrito no puede acceder al aula por URL directa.
3. Al cancelar la inscripción desde admin, el estudiante pierde acceso al contenido.

---

## FASE 4 — Cuestionarios y aprobación

Alcance (MVP: 3 tipos de pregunta — selección única, selección múltiple, verdadero/falso):
- Constructor de cuestionarios por curso o por módulo: preguntas con opciones, marcar correctas, puntaje, retroalimentación, puntaje mínimo, intentos máximos, tiempo límite opcional, orden aleatorio.
- Presentación del quiz dentro del aula. La calificación se hace **en el servidor**; `isCorrect` nunca se envía al cliente antes de responder.
- Resultado con puntaje, aprobado/reprobado, retroalimentación, intentos restantes; historial de intentos.
- Completitud del curso ahora exige: lecciones obligatorias completadas **y** cuestionarios aprobados. `finalScore` = promedio de quizzes.

Prueba de aceptación F4:
1. Quiz de 5 preguntas mezclando los 3 tipos, mínimo 80, 2 intentos: reprobar el primero, aprobar el segundo.
2. Con DevTools abiertas durante el quiz, verificar que ninguna respuesta de red expone `isCorrect` antes de enviar.
3. El curso solo pasa a "aprobado" cuando lecciones + quiz están cumplidos.

---

## FASE 5 — Certificados, PDF, QR y validación pública

Alcance:
- Emisión automática al cumplir los requisitos del curso: código único (formato `RSC-AAAA-XXXXXX`), hash de validación, registro.
- Generación de PDF con plantilla institucional fija (logo, nombre completo, tipo y número de documento, curso, tipo de curso, intensidad horaria, fecha, código, QR, firma y cargo del responsable, ciudad). Los valores institucionales se leen de la configuración, editable por el admin.
- El QR codifica la URL pública de validación.
- Estudiante: "Mis certificados" con descarga. Admin: buscar, ver, anular (revoca) y re-descargar.
- Página pública de validación (`/validar` y `/validar/:codigo`): devuelve solo nombre, documento enmascarado, curso, fecha y estado (válido/anulado). Nunca expone datos sensibles adicionales.

Prueba de aceptación F5:
1. Completar el curso como estudiante → el certificado se emite solo, sin acción del admin.
2. Revisar el PDF: datos correctos, QR legible, sin desbordes con un nombre largo.
3. Escanear el QR → abre la validación con estado válido y cédula enmascarada.
4. Anular desde admin → la página pública lo muestra anulado de inmediato.
5. Código inexistente → mensaje de "no encontrado", sin errores crudos.

**→ Punto de decisión:** al terminar la Fase 5 se evalúa si el desarrollo custom vale la pena frente a la alternativa (WordPress + Tutor LMS). Criterios: fiabilidad del flujo inscripción→progreso→quiz→certificado, costo de mantenimiento, seguridad verificable, y si es sostenible por un solo desarrollador durante el contrato. La Fase 6 solo se construye si el custom se confirma.

---

## FASE 6 — Reportes y cierre del MVP

Alcance:
- Reportes con filtros y export a CSV (UTF-8): estudiantes por curso, avance por dependencia, resultados de cuestionarios, certificados emitidos/anulados por fechas.
- Dashboard admin completo: certificados, estudiantes certificados, promedio de aprobación, top cursos, actividad reciente.
- Pulido: recuperación de contraseña, estados vacíos amigables, revisión responsive en móvil.

Prueba de aceptación F6:
1. Exportar cada reporte a CSV y abrirlo sin caracteres rotos (tildes y ñ correctas).
2. Flujo completo de punta a punta con un usuario nuevo: creación → asignación → curso → quiz → certificado → validación por QR, sin tocar la base a mano.

---

## Post-MVP (solo si el custom se confirma)

Constructor visual de certificados (drag-and-drop) · tipos de pregunta adicionales (ordenamiento, relacionar, respuesta abierta, completar) · export a Excel y PDF de reportes · biblioteca de medios con carpetas · auditoría (`AuditLog`) · notificaciones por correo · inscripciones masivas por CSV · verificación de correo.
