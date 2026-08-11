/**
 * Montaje del material de los TRIMESTRES (Escritorio/CURSOSREDSALUD/drive-download).
 *
 * Cada tema de las carpetas ya existe como línea del PIC 2026; aquí se le
 * monta su curso (presentación + evaluación), se vincula a la actividad y la
 * actividad se abre. El ciclo presaber/postsaber queda AUTOMÁTICO (las cuatro
 * marcas de ventana en null): presaber hasta presentarlo, postsaber después.
 *
 * Reglas de instrumento:
 * - Documento único "Pre y Pos test" -> ese es el quiz final del curso
 *   (moduleId null), presentado dos veces.
 * - PRE-TEST y POST-TEST separados (Salud Pública) -> el PRE es el quiz final
 *   (mismo instrumento en ambos momentos = adherencia comparable) y el POST
 *   queda como evaluación del módulo justo después de la presentación.
 * - Precursoras no traía clave: va con clave clínica marcada para REVISIÓN
 *   del área (ver explanation de cada pregunta).
 *
 * Archivos esperados en ORIGEN (subidos por scp antes de correr).
 */
import { mkdir, copyFile, stat } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";

const ORIGEN = "/opt/redsalud/current/montaje-trimestres";
const UPLOADS = path.join(process.cwd(), "uploads");
const APROBAR = 60;
const INTENTOS = 10;

// ---------------------------------------------------------------- utilidades

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

type Opcion = { t: string; ok?: boolean };
type Pregunta = {
  enunciado: string;
  opciones: Opcion[];
  multiple?: boolean;
  explanation?: string;
};

/** Pregunta de selección única: `correcta` es la letra (A=0...). */
function q(enunciado: string, opciones: string[], correcta: string, explanation?: string): Pregunta {
  const idx = correcta.charCodeAt(0) - 65;
  if (idx < 0 || idx >= opciones.length) throw new Error(`Clave ${correcta} fuera de rango en: ${enunciado}`);
  return { enunciado, opciones: opciones.map((t, i) => ({ t, ok: i === idx })), explanation };
}

/** Pregunta de selección múltiple: varias letras correctas. */
function qm(enunciado: string, opciones: string[], correctas: string[]): Pregunta {
  const idxs = new Set(correctas.map((c) => c.charCodeAt(0) - 65));
  return { enunciado, opciones: opciones.map((t, i) => ({ t, ok: idxs.has(i) })), multiple: true };
}

type LeccionDef = { titulo: string; tipo: "PDF" | "VIDEO"; archivo: string; minutos: number };
type QuizDef = { titulo: string; preguntas: Pregunta[] };
type CursoDef = {
  titulo: string;
  categoria: string;
  resumen: string;
  actividadIds: string[];
  lecciones: LeccionDef[];
  /** Evaluación final del curso: el instrumento del ciclo presaber/postsaber. */
  quizFinal: QuizDef;
  /** Post-tests que van DENTRO del módulo, después de la lección indicada. */
  quizzesModulo?: { trasLeccion: number; def: QuizDef }[];
};

// ---------------------------------------------------------------- contenidos

const CURSOS: CursoDef[] = [
  // ============================== PAI ==============================
  {
    titulo: "Esquema de vacunación y esquemas incompletos en menores de 6 años",
    categoria: "Rutas Integrales",
    resumen: "Esquema nacional de vacunación y conducta ante esquemas incompletos en el menor de 6 años.",
    actividadIds: ["cmsbjggj0000fvkl8defjfhw4"],
    lecciones: [
      { titulo: "Presentación · Vacunación en población objeto", tipo: "PDF", archivo: "vac-poblacion-objeto.pdf", minutos: 30 },
      { titulo: "Esquema de vacunación (documento de consulta)", tipo: "PDF", archivo: "vac-esquema.pdf", minutos: 10 },
    ],
    quizFinal: {
      titulo: "Evaluación · Esquema de vacunación en menores de 6 años",
      preguntas: [
        q("¿Qué enfermedades previene la vacuna Pentavalente?", ["Influenza estacional, Virus del papiloma humano y Toxoide tetánico", "Polio, Rotavirus, Neumococo y Meningitis tuberculosa", "Difteria, Tos ferina, Tétanos, Haemophilus Influenzae tipo b y Hepatitis B", "Varicela, Hepatitis A y Fiebre amarilla"], "C"),
        q("¿Cuál es la vacuna que se aplica como refuerzo a los 18 meses en el esquema?", ["Influenza estacional", "Polio oral", "DTP (Difteria, Tétanos y Tos ferina)", "Hepatitis A"], "C"),
        q("¿A qué edad se administra la primera dosis de la vacuna contra la fiebre amarilla?", ["9 meses", "12 meses", "18 meses", "6 meses"], "A"),
        q("¿Cuál de las siguientes vacunas es obligatoria en adolescentes de 9 a 17 años de edad según el esquema nacional?", ["Hepatitis A", "Virus del Papiloma Humano (VPH)", "Influenza estacional", "Rotavirus"], "B"),
        q("¿Cuál es la principal finalidad del Programa Ampliado de Inmunizaciones (PAI) en Colombia?", ["Reducir costos hospitalarios", "Prevenir enfermedades transmisibles mediante vacunación gratuita y universal", "Promover la investigación en biotecnología", "Aumentar la cobertura de seguros médicos"], "B"),
        q("¿Qué vacuna se aplica al recién nacido en las primeras 12 horas de vida?", ["Influenza", "Hepatitis B", "Rotavirus", "Polio"], "B"),
        q("¿Cuál es la periodicidad recomendada para la vacuna contra la influenza en Colombia?", ["Cada 5 años", "Cada 2 años", "Cada año", "Solo una vez en la vida"], "C"),
        q("¿Cuál es el objetivo de la vacunación de la vacuna contra el rotavirus en niños menores de 1 año?", ["Prevenir hepatitis", "Disminuir casos graves de diarrea y deshidratación", "Evitar meningitis", "Reducir fiebre amarilla"], "B"),
        q("Un niño de 2 meses llega al servicio de vacunación con antecedente vacunal de recién nacido. Según el esquema, ¿qué biológico aplicaría?", ["Fiebre amarilla, Rotavirus, BCG, Pentavalente", "Pentavalente, Polio, Neumococo, Rotavirus", "Triple Viral, Neumococo, DPT, Polio", "Pentavalente, Hepatitis B, Polio, Neumococo"], "B"),
        q("Seleccione cuál es la edad máxima del inmunobiológico de Rotavirus de primera y segunda dosis.", ["3 meses 29 días primera dosis, 6 meses segunda dosis", "2 meses 21 días primera dosis, 11 meses 29 días segunda dosis", "3 meses 21 días primera dosis, 11 meses 29 días segunda dosis", "Ninguna de las anteriores"], "C"),
      ],
    },
  },
  {
    titulo: "Manejo de derrames, limpieza y desinfección en el servicio de vacunación",
    categoria: "Rutas Integrales",
    resumen: "Manejo seguro de derrames biológicos y protocolos de limpieza y desinfección en vacunación.",
    actividadIds: ["cmsbjggjt000jvkl8rov4eqiz"],
    lecciones: [{ titulo: "Presentación · Manejo de derrames, limpieza y desinfección", tipo: "PDF", archivo: "vac-derrames.pdf", minutos: 25 }],
    quizFinal: {
      titulo: "Evaluación · Manejo de derrames, limpieza y desinfección",
      preguntas: [
        q("¿Cuál es el primer paso ante un derrame de material biológico en el servicio de vacunación?", ["Limpiar el derrame con las manos.", "Señalizar el área y utilizar los elementos de protección personal (EPP).", "Ignorar el derrame.", "Aplicar alcohol directamente sobre el derrame sin protección."], "B"),
        q("¿Qué elementos de protección personal (EPP) deben utilizarse para atender un derrame biológico?", ["Solo bata.", "Guantes, bata y, según el riesgo, mascarilla y protección ocular.", "Solo gorro.", "Zapatos deportivos."], "B"),
        q("¿Qué debe hacerse con los materiales utilizados para limpiar un derrame biológico?", ["Guardarlos para reutilizarlos.", "Desecharlos en los recipientes destinados para residuos biosanitarios, según la normatividad.", "Dejarlos secar sobre una mesa.", "Tirarlos a la basura común."], "B"),
        q("¿Cuál es el objetivo principal de la limpieza y desinfección en el servicio de vacunación?", ["Mejorar únicamente la apariencia del área.", "Disminuir el riesgo de contaminación y transmisión de microorganismos.", "Reducir el consumo de agua.", "Evitar el uso de guantes."], "B"),
        q("¿Cuál es la diferencia entre limpieza y desinfección?", ["Son exactamente el mismo procedimiento.", "La limpieza elimina suciedad y materia orgánica; la desinfección reduce o elimina microorganismos mediante agentes químicos o físicos.", "La desinfección se realiza antes de la limpieza.", "La limpieza elimina todos los microorganismos."], "B"),
        q("¿Con qué frecuencia deben limpiarse y desinfectarse las superficies del área de vacunación?", ["Solo cuando se observe suciedad.", "De acuerdo con el protocolo institucional y siempre que exista contaminación o al finalizar la jornada.", "Una vez al mes.", "Solo durante auditorías."], "B"),
        q("Si ocurre un derrame de un frasco de vacuna, el personal debe:", ["Recoger los vidrios con las manos.", "Utilizar los elementos adecuados para recoger el vidrio, desinfectar el área y desechar los residuos según el protocolo.", "Barrer el vidrio hacia un rincón.", "Continuar vacunando sin limpiar."], "B"),
        q("¿Qué tipo de residuos representan las agujas y jeringas usadas en vacunación?", ["Residuos reciclables.", "Residuos ordinarios.", "Residuos cortopunzantes que deben depositarse en un guardián o recipiente rígido.", "Residuos orgánicos."], "C"),
        q("¿Por qué es importante respetar el tiempo de acción del desinfectante?", ["Porque mejora el olor del ambiente.", "Porque permite que el desinfectante actúe de forma eficaz sobre los microorganismos.", "Porque evita el uso de agua.", "Porque acelera la aplicación de vacunas."], "B"),
        q("¿Qué acción ayuda a prevenir derrames y contaminación en el servicio de vacunación?", ["Manipular los biológicos sin cuidado.", "Mantener el área organizada, aplicar las normas de bioseguridad y realizar limpieza y desinfección de forma periódica.", "Reutilizar materiales desechables.", "Almacenar residuos en cualquier recipiente."], "B"),
      ],
    },
  },
  {
    titulo: "Módulos del sistema nominal del PAI (PAIWEB V2)",
    categoria: "Rutas Integrales",
    resumen: "Registro, consulta y seguimiento nominal de la vacunación en el sistema PAIWEB V2.",
    actividadIds: ["cmsbjggk2000kvkl84oxfmvu6"],
    lecciones: [{ titulo: "Presentación · Módulos del PAIWEB V2", tipo: "PDF", archivo: "vac-paiweb.pdf", minutos: 25 }],
    quizFinal: {
      titulo: "Evaluación · Módulos del sistema nominal del PAI (PAIWEB V2)",
      preguntas: [
        q("¿Qué es el PAIWEB V2?", ["Un programa para registrar historias clínicas.", "Un sistema de información del Programa Ampliado de Inmunizaciones (PAI) para registrar y consultar la vacunación nominal.", "Un software para administrar hospitales.", "Un sistema de facturación."], "B"),
        q("¿Cuál es la función principal del módulo de usuarios en PAIWEB V2?", ["Registrar el inventario de medicamentos.", "Crear y administrar los usuarios con acceso al sistema y sus permisos.", "Registrar incapacidades médicas.", "Generar certificados laborales."], "B"),
        q("¿Qué permite el módulo de registro nominal?", ["Registrar la información de cada persona vacunada y las dosis aplicadas.", "Controlar las finanzas del programa.", "Registrar únicamente el inventario.", "Programar citas médicas."], "A"),
        q("¿Para qué sirve el módulo de consultas en PAIWEB V2?", ["Editar documentos.", "Buscar y verificar el historial de vacunación de un usuario.", "Eliminar registros antiguos.", "Crear nuevos biológicos."], "B"),
        q("¿Cuál es la utilidad del módulo de reportes?", ["Elaborar únicamente documentos administrativos.", "Generar informes y estadísticas sobre la vacunación registrada en el sistema.", "Solicitar vacunas al proveedor.", "Modificar datos personales."], "B"),
        q("¿Qué información se registra al ingresar una dosis aplicada en PAIWEB V2?", ["Solo el nombre del vacunador.", "Datos del usuario, biológico, lote, fecha de aplicación y demás información requerida.", "Únicamente el número de lote.", "Solo la edad del usuario."], "B"),
        q("¿Cuál es el objetivo del sistema nominal PAIWEB V2?", ["Llevar únicamente el control financiero del PAI.", "Registrar, consultar y hacer seguimiento individual al esquema de vacunación de cada persona.", "Controlar el ingreso del personal de salud.", "Gestionar historias clínicas hospitalarias."], "B"),
        q("¿Quién debe registrar la información en PAIWEB V2?", ["Cualquier persona.", "El personal autorizado y capacitado por la institución de salud.", "Solo el gerente del hospital.", "Únicamente el paciente."], "B"),
        q("¿Cuál es una ventaja del sistema PAIWEB V2?", ["Elimina la necesidad de vacunar.", "Facilita el seguimiento de los esquemas de vacunación y mejora la calidad de la información.", "Reduce el número de vacunas disponibles.", "Reemplaza la cadena de frío."], "B"),
        q("¿Por qué es importante registrar la información de manera correcta en PAIWEB V2?", ["Para evitar el uso del carné de vacunación.", "Para garantizar información confiable, facilitar el seguimiento de los usuarios y apoyar la toma de decisiones en salud pública.", "Para disminuir el tiempo de atención únicamente.", "Para reducir el número de dosis aplicadas."], "B"),
      ],
    },
  },
  {
    titulo: "Solicitud, selección, recepción, transporte y almacenamiento de biológicos",
    categoria: "Rutas Integrales",
    resumen: "Procedimiento completo del manejo de biológicos: de la solicitud al almacenamiento seguro.",
    actividadIds: ["cmsbjggkn000mvkl8i2alac75"],
    lecciones: [{ titulo: "Presentación · Selección, transporte y almacenamiento de biológicos", tipo: "PDF", archivo: "vac-seleccion.pdf", minutos: 25 }],
    quizFinal: {
      titulo: "Evaluación · Solicitud, selección, recepción, transporte y almacenamiento de biológicos",
      preguntas: [
        q("¿Qué se debe tener en cuenta al solicitar biológicos?", ["Pedir la mayor cantidad posible.", "Solicitar los biológicos según el consumo, la población objetivo y la capacidad de almacenamiento.", "Solicitar únicamente vacunas nuevas.", "Hacer el pedido sin revisar el inventario."], "B"),
        q("¿Cuál es el primer paso al recibir un pedido de biológicos?", ["Guardarlos inmediatamente sin revisarlos.", "Verificar la cantidad, el lote, la fecha de vencimiento y la temperatura de recepción.", "Abrir todos los frascos.", "Aplicar las vacunas de inmediato."], "B"),
        q("Durante la selección de biológicos para su uso, se deben elegir primero:", ["Los frascos con la fecha de vencimiento más lejana.", "Los frascos más nuevos.", "Los biológicos con la fecha de vencimiento más próxima (PEPS: Primero en Expirar, Primero en Salir).", "Cualquier frasco disponible."], "C"),
        q("¿Cuál es la temperatura recomendada para almacenar la mayoría de los biológicos?", ["-20 °C a -10 °C.", "10 °C a 15 °C.", "2 °C a 8 °C.", "20 °C a 25 °C."], "C"),
        q("¿Qué debe utilizarse para transportar biológicos durante una jornada de vacunación?", ["Bolsas plásticas comunes.", "Cajas de cartón.", "Termos o cajas térmicas con paquetes fríos acondicionados.", "Maletas de tela."], "C"),
        q("Si al recibir los biológicos se detecta un frasco roto o con el sello alterado, se debe:", ["Utilizarlo primero.", "Aislarlo, reportar la novedad y seguir el procedimiento establecido.", "Mezclarlo con los demás biológicos.", "Aplicarlo solo en adultos."], "B"),
        q("¿Por qué es importante mantener la cadena de frío durante el transporte de los biológicos?", ["Para reducir el peso del termo.", "Para conservar la potencia, calidad y seguridad de los biológicos.", "Para facilitar el transporte.", "Para evitar registrar la temperatura."], "B"),
        q("¿Dónde deben almacenarse los biológicos dentro del refrigerador?", ["En la puerta del refrigerador.", "En cualquier espacio disponible.", "En los estantes destinados para biológicos, sin contacto directo con las paredes y con adecuada circulación de aire.", "En el congelador."], "C"),
        q("¿Qué información debe registrarse durante la recepción de biológicos?", ["Solo el nombre del transportador.", "La temperatura, cantidad recibida, número de lote, fecha de vencimiento y estado de los biológicos.", "Únicamente la fecha de entrega.", "El color de las cajas."], "B"),
        q("¿Cuál es el objetivo principal de realizar correctamente la solicitud, recepción, transporte y almacenamiento de los biológicos?", ["Disminuir el número de vacunas disponibles.", "Garantizar la calidad, seguridad y eficacia de los biológicos hasta su aplicación.", "Reducir el tiempo de vacunación.", "Evitar el uso de formatos de registro."], "B"),
      ],
    },
  },
  {
    titulo: "Red de frío, toma de temperatura y formatos",
    categoria: "Rutas Integrales",
    resumen: "Conservación de biológicos: red de frío, registro de temperatura y diligenciamiento de formatos.",
    actividadIds: ["cmsbjggj5000gvkl86indldav"],
    lecciones: [{ titulo: "Presentación · Vacunación extramural y red de frío", tipo: "PDF", archivo: "vac-extramural-redfrio.pdf", minutos: 25 }],
    quizFinal: {
      titulo: "Evaluación · Red de frío, toma de temperatura y formatos",
      preguntas: [
        q("¿Qué es la red de frío?", ["Un sistema para almacenar medicamentos a temperatura ambiente.", "Un conjunto de actividades y equipos que mantienen los biológicos a la temperatura adecuada desde su fabricación hasta su aplicación.", "Un método para transportar alimentos congelados.", "Un proceso para fabricar vacunas."], "B"),
        q("¿Cuál es el rango de temperatura recomendado para almacenar la mayoría de los biológicos?", ["-20 °C a -10 °C", "0 °C a 5 °C", "2 °C a 8 °C", "10 °C a 15 °C"], "C"),
        q("¿Qué puede ocurrir si un biológico se expone a temperaturas fuera del rango recomendado?", ["Se vuelve más efectivo.", "Puede perder su potencia y eficacia.", "Aumenta su tiempo de conservación.", "Cambia únicamente su color."], "B"),
        q("¿Cuál de los siguientes equipos hace parte de la red de frío?", ["Estufa eléctrica.", "Refrigerador para vacunas.", "Microondas.", "Ventilador."], "B"),
        q("¿Con qué frecuencia se recomienda registrar la temperatura del refrigerador de biológicos?", ["Una vez al mes.", "Solo cuando se reciben vacunas.", "Al menos dos veces al día, al inicio y al finalizar la jornada.", "Una vez por semana."], "C"),
        q("¿Cuál es el principal objetivo del formato de control de temperatura?", ["Registrar las ventas de vacunas.", "Llevar el inventario de medicamentos.", "Verificar y documentar que los biológicos se mantengan dentro del rango de temperatura establecido.", "Registrar la asistencia del personal."], "C"),
        q("Si la temperatura registrada es de 10 °C, ¿qué se debe hacer primero?", ["Ignorar el registro.", "Aplicar inmediatamente los biológicos.", "Reportar la novedad y seguir el protocolo institucional para evaluar los biológicos.", "Apagar el refrigerador."], "C"),
        q("¿Qué instrumento se utiliza para medir y registrar la temperatura de los biológicos?", ["Tensiómetro.", "Oxímetro.", "Termómetro o datalogger calibrado.", "Cronómetro."], "C"),
        q("¿Cuál de los siguientes datos debe registrarse en el formato de temperatura?", ["Nombre del paciente.", "Fecha, hora, temperatura y nombre o firma del responsable.", "Número de vacunas aplicadas únicamente.", "Color del refrigerador."], "B"),
        q("¿Por qué es importante mantener la cadena o red de frío?", ["Para ahorrar energía eléctrica.", "Para evitar limpiar el refrigerador.", "Para conservar la calidad, seguridad y eficacia de los biológicos hasta su aplicación.", "Para disminuir el tamaño de las vacunas."], "C"),
      ],
    },
  },
  {
    titulo: "Vacunación antirrábica, víctimas de violencia sexual, gestantes y adultos",
    categoria: "Rutas Integrales",
    resumen: "Vacunación en poblaciones especiales: profilaxis antirrábica, víctimas de violencia sexual, gestantes y adultos.",
    actividadIds: ["cmsbjggjj000ivkl8fehprtdm"],
    lecciones: [
      { titulo: "Presentación · Vacunación en población objeto", tipo: "PDF", archivo: "vac-poblacion-objeto.pdf", minutos: 30 },
      { titulo: "Infografía · Escenarios y conductas pos exposición ante el virus de la rabia", tipo: "PDF", archivo: "vac-antirrabica-infografia-conductas.pdf", minutos: 10 },
      { titulo: "Infografía · Inmunoglobulina antirrábica de origen equino", tipo: "PDF", archivo: "vac-antirrabica-infografia-inmunoglobulina.pdf", minutos: 10 },
      { titulo: "Circular 0031 de 2014 · Código fucsia", tipo: "PDF", archivo: "vac-antirrabica-circular-0031.pdf", minutos: 10 },
    ],
    quizFinal: {
      titulo: "Evaluación · Vacunación antirrábica y poblaciones especiales",
      preguntas: [
        q("¿Qué vacunas se recomiendan para adultos mayores de 60 años?", ["Pentavalente", "Influenza estacional, Fiebre Amarilla", "Rotavirus", "Varicela"], "B"),
        q("¿Cuál es la principal finalidad del Programa Ampliado de Inmunizaciones (PAI) en Colombia?", ["Reducir costos hospitalarios", "Prevenir enfermedades transmisibles mediante vacunación gratuita y universal", "Promover la investigación en biotecnología", "Aumentar la cobertura de seguros médicos"], "B"),
        q("¿Cuál es la periodicidad recomendada para la vacuna contra la influenza en Colombia?", ["Cada 5 años", "Cada 2 años", "Cada año", "Solo una vez en la vida"], "C"),
        q("La vacunación antirrábica pos exposición debe iniciarse lo más pronto posible después de una mordedura, arañazo o contacto de riesgo con un animal sospechoso de rabia.", ["Falso", "Verdadero"], "B"),
        q("¿Puede suspenderse el esquema de vacunación antirrábica?", ["Sí", "No"], "A"),
        q("¿Cuál es la dosis de inmunoglobulina humana?", ["20 UI/kg de peso corporal.", "40 UI/kg de peso corporal.", "10 UI/kg de peso corporal.", "15 UI/kg de peso corporal."], "A"),
        q("¿Cuál es el esquema para una persona no vacunada, víctima de violencia sexual?", ["Tres dosis: 0, 1 y 6 meses.", "Tres dosis: 0, 6 y 12 meses.", "Dos dosis: 0 y 6 meses.", "Tres dosis: 0, 2 y 18 meses."], "A"),
        q("¿Cuáles vacunas están recomendadas durante el embarazo?", ["dpaT acelular, VSR, influenza, Covid", "dpaT pediátrico, VSR, influenza, Covid", "VSR, influenza, Covid, Neumococo", "Fiebre Amarilla, Tétanos, Neumococo"], "A"),
      ],
    },
  },
  {
    titulo: "Vacunación segura y política de frascos abiertos",
    categoria: "Rutas Integrales",
    resumen: "Garantía de calidad, eficacia y seguridad de las vacunas y aplicación de la política de frascos abiertos.",
    actividadIds: ["cmsbjggj9000hvkl8d5nuv798"],
    lecciones: [{ titulo: "Presentación · Vacunación segura y política de frascos abiertos", tipo: "PDF", archivo: "vac-segura.pdf", minutos: 25 }],
    quizFinal: {
      titulo: "Evaluación · Vacunación segura y política de frascos abiertos",
      preguntas: [
        q("¿Cuál es el principal objetivo de la vacunación segura?", ["Disminuir el número de vacunadores.", "Garantizar la calidad, eficacia y seguridad de las vacunas durante todo el proceso de inmunización.", "Reducir el tiempo de atención al usuario.", "Aplicar todas las vacunas el mismo día."], "B"),
        q("¿Cuál es el rango de temperatura recomendado para conservar las vacunas del PAI?", ["-20 °C a -10 °C.", "0 °C a +10 °C.", "+2 °C a +8 °C.", "+8 °C a +15 °C."], "C"),
        q("Antes de administrar una vacuna, el vacunador debe verificar:", ["Únicamente la edad del usuario.", "El color del frasco.", "El lote, la fecha de vencimiento, el biológico y el usuario correcto.", "Solo el nombre de la vacuna."], "C"),
        q("La Política de Frascos Abiertos tiene como finalidad:", ["Utilizar todos los frascos hasta vaciarlos, sin importar las condiciones.", "Permitir la reutilización de algunos frascos multidosis cuando cumplen los criterios de seguridad.", "Evitar la apertura de frascos multidosis.", "Reutilizar cualquier vacuna durante un mes."], "B"),
        q("¿Cuál de las siguientes vacunas NO hace parte de la Política de Frascos Abiertos una vez reconstituida?", ["Hepatitis B.", "Triple Viral.", "DPT.", "BCG."], "A"),
        q("¿Cuál de las siguientes condiciones permite conservar un frasco multidosis abierto para otra jornada?", ["Haber permanecido siempre entre +2 °C y +8 °C y cumplir todos los criterios establecidos.", "Haber permanecido fuera de refrigeración durante varias horas.", "No tener etiqueta con la fecha de apertura.", "Haber vencido, pero conservar buen aspecto."], "A"),
        q("¿Qué debe hacerse con una vacuna reconstituida que no fue utilizada al finalizar la jornada y no cumple con los criterios establecidos de la política de frascos abiertos?", ["Guardarla para el siguiente día.", "Congelarla.", "Descartarla de acuerdo con la norma.", "Mezclarla con otro frasco."], "C"),
        q("¿Qué significa la sigla ESAVI?", ["Estrategia de Seguridad para la Aplicación de Vacunas e Inmunización.", "Evento Supuestamente Atribuible a la Vacunación o Inmunización.", "Evaluación Sistemática de Aplicación de Vacunas.", "Evento de Salud Asociado a Virus Inmunológicos."], "B"),
        q("¿Cuál de las siguientes acciones contribuye a una vacunación segura?", ["Omitir el lavado de manos para ahorrar tiempo.", "Reutilizar jeringas si están en buen estado.", "Aplicar técnicas asépticas y cumplir las normas de bioseguridad.", "Transportar las vacunas sin control de temperatura."], "C"),
        q("¿Cuál es uno de los beneficios de aplicar correctamente la Política de Frascos Abiertos?", ["Incrementar el desperdicio de biológicos.", "Disminuir la cobertura de vacunación.", "Optimizar el uso de las vacunas y reducir pérdidas sin afectar la seguridad.", "Reducir la cadena de frío."], "C"),
      ],
    },
  },
  {
    titulo: "Procedimiento de vacunación extramural",
    categoria: "Rutas Integrales",
    resumen: "Planeación, ejecución y cierre de jornadas de vacunación fuera de la institución.",
    actividadIds: ["cmsbjggke000lvkl81gmyqhxo"],
    lecciones: [{ titulo: "Presentación · Vacunación extramural y red de frío", tipo: "PDF", archivo: "vac-extramural-redfrio.pdf", minutos: 25 }],
    quizFinal: {
      titulo: "Evaluación · Procedimiento de vacunación extramural",
      preguntas: [
        q("¿Qué es la vacunación extramural?", ["La vacunación realizada únicamente en hospitales.", "La vacunación que se realiza fuera de la institución de salud para acercar los servicios a la comunidad.", "La vacunación aplicada solo en campañas internacionales.", "La vacunación exclusiva para adultos mayores."], "B"),
        q("¿Cuál es el objetivo principal de la vacunación extramural?", ["Reducir el uso de vacunas.", "Facilitar el acceso a la vacunación y aumentar las coberturas.", "Disminuir el número de vacunadores.", "Vacunar únicamente a personas con enfermedades."], "B"),
        q("Antes de salir a una jornada de vacunación extramural, el personal debe verificar:", ["Solo el uniforme.", "El inventario de vacunas, insumos, formatos y equipos de cadena de frío.", "Únicamente la cantidad de jeringas.", "Solo el vehículo de transporte."], "B"),
        q("Durante el transporte de los biológicos en una jornada extramural, las vacunas deben mantenerse:", ["A temperatura ambiente.", "Entre 2 °C y 8 °C, utilizando termos o cajas térmicas con paquetes fríos acondicionados.", "Congeladas a -20 °C.", "Expuestas al sol para conservarlas."], "B"),
        q("¿Qué documento debe revisarse antes de aplicar una vacuna?", ["La licencia de conducción.", "El carné o registro de vacunación del usuario.", "El certificado laboral.", "La historia clínica de otro paciente."], "B"),
        q("Antes de aplicar una vacuna, el vacunador debe:", ["Aplicarla sin hacer preguntas.", "Verificar la identidad del usuario, revisar antecedentes y confirmar que no existan contraindicaciones.", "Esperar a que el usuario lo solicite nuevamente.", "Aplicar dos dosis para mayor protección."], "B"),
        q("Después de aplicar una vacuna, es obligatorio:", ["Desechar el carné de vacunación.", "Registrar la información de la vacuna aplicada y actualizar el carné del usuario.", "Guardar la jeringa para reutilizarla.", "No informar al usuario."], "B"),
        q("¿Dónde deben depositarse las agujas y jeringas utilizadas durante la vacunación?", ["En una bolsa de basura común.", "En un recipiente para residuos cortopunzantes.", "En una caja de cartón.", "En cualquier recipiente plástico."], "B"),
        q("Al finalizar una jornada extramural, el personal debe:", ["Dejar los biológicos en el vehículo.", "Regresar los biológicos, consolidar los registros y reportar las dosis aplicadas y los saldos.", "Desechar todas las vacunas sobrantes.", "Entregar únicamente las jeringas utilizadas."], "B"),
        q("¿Qué acción contribuye a garantizar la calidad y seguridad de una jornada de vacunación extramural?", ["Mantener la cadena de frío, cumplir las normas de bioseguridad y registrar correctamente la información.", "Aplicar las vacunas sin verificar la temperatura.", "Transportar las vacunas sin termo.", "Omitir el registro de las dosis aplicadas."], "A"),
      ],
    },
  },
  // ============================== RIAMP ==============================
  {
    titulo: "Auditoría GAUDI: puntos críticos de la Ruta Materno Perinatal",
    categoria: "Rutas Integrales",
    resumen: "Criterios de la auditoría GAUDI aplicados a los puntos críticos de la RIAMP.",
    actividadIds: ["cmsbjggml000uvkl80byippgh"],
    lecciones: [{ titulo: "Presentación · Auditoría GAUDI, puntos críticos RIAMP", tipo: "PDF", archivo: "riamp-gaudi.pdf", minutos: 30 }],
    quizFinal: {
      titulo: "Evaluación · Auditoría GAUDI",
      preguntas: [
        q("¿Qué etapas principales evalúa la auditoría GAUDI en la Ruta Materno Perinatal?", ["Infancia, adolescencia y adultez", "Gestación, parto-puerperio y recién nacido", "Preconcepción y adultez mayor", "Vacunación y nutrición"], "B"),
        q("¿A qué corresponde el Criterio 10 de la auditoría GAUDI?", ["Atención del recién nacido", "Atención del puerperio", "Auditoría de la gestación", "Atención de urgencias"], "C"),
        q("¿Cuál de los siguientes hace parte de los 5 pilares del cuidado prenatal evaluados en el Criterio 10?", ["Hospitalización", "Laboratorios y tamizajes", "Cirugía", "Rehabilitación"], "B"),
        q("¿Qué evalúa principalmente el Criterio 11?", ["Crecimiento y desarrollo", "Vacunación infantil", "Consulta preconcepcional", "Atención del parto y puerperio"], "D"),
        q("¿Entre qué días debe asignarse el control ambulatorio del recién nacido según la presentación?", ["Entre los días 10 y 15", "El mismo día del nacimiento", "Entre los 3 y 5 días posteriores al egreso", "Después del primer mes"], "C"),
      ],
    },
  },
  {
    titulo: "Estrategia IAMII",
    categoria: "Rutas Integrales",
    resumen: "Institución Amiga de la Mujer y la Infancia: pilares, política institucional y continuidad del cuidado.",
    actividadIds: ["cmsbjgglx000qvkl8hi1nw4cf"],
    lecciones: [{ titulo: "Presentación · Estrategia IAMII", tipo: "PDF", archivo: "riamp-iamii.pdf", minutos: 30 }],
    quizFinal: {
      titulo: "Evaluación · Estrategia IAMII",
      preguntas: [
        q("¿Qué significa la sigla IAMII?", ["Institución de Atención Materna Integral", "Institución Amiga de la Mujer y la Infancia", "Instituto de Atención a la Mujer y la Infancia", "Integración de Atención Materna e Infantil"], "B"),
        q("¿Cuál es uno de los pilares fundamentales de la estrategia IAMII?", ["Competitividad", "Productividad", "Integralidad", "Rentabilidad"], "C"),
        q("En Red Salud Casanare E.S.E., ¿qué resolución actualiza la política institucional de la estrategia IAMII?", ["Resolución 3280 de 2018", "Resolución 520 de 2025", "Resolución 539 de 2026", "Resolución 2626 de 2019"], "B"),
        q("¿Durante cuánto tiempo se recomienda mantener la lactancia materna exclusiva?", ["2 meses", "4 meses", "Los primeros 6 meses", "12 meses"], "C"),
        q("¿Qué busca el Paso 10 de la estrategia IAMII?", ["Suspender el seguimiento después del alta", "Limitar la atención únicamente a la institución", "Evitar la participación de la comunidad", "Garantizar la continuidad del cuidado entre la institución, el hogar y la comunidad"], "D"),
      ],
    },
  },
  {
    titulo: "Estrategia IAMII con enfoque en lactancia materna",
    categoria: "Rutas Integrales",
    resumen: "Lactancia materna dentro de la estrategia IAMII: hora de oro, libre demanda, agarre correcto y alternativas.",
    actividadIds: ["cmsbjggmc000svkl8y13g65dj"],
    lecciones: [{ titulo: "Presentación · Estrategia IAMII, enfoque en lactancia materna", tipo: "PDF", archivo: "riamp-iamii-lm.pdf", minutos: 30 }],
    quizFinal: {
      titulo: "Evaluación · IAMII con enfoque en lactancia materna",
      preguntas: [
        q("Según la línea de tiempo de alimentación óptima, durante los primeros 6 meses de vida el bebé debe recibir:", ["Leche materna combinada con agua.", "Lactancia materna exclusiva.", "Leche materna y alimentación complementaria.", "Fórmula infantil durante la noche."], "B"),
        q("¿Cuál es uno de los principales beneficios del contacto piel a piel durante la «Hora de Oro»?", ["Permite que el recién nacido duerma durante más tiempo.", "Evita la necesidad de realizar seguimiento posterior.", "Favorece la termorregulación, el vínculo afectivo y el inicio temprano de la lactancia.", "Sustituye la necesidad de alimentación durante las primeras horas."], "C"),
        q("¿Qué significa ofrecer lactancia materna a «libre demanda»?", ["Alimentar al bebé exactamente cada tres horas.", "Ofrecer el pecho únicamente durante el día.", "Establecer horarios según la edad del bebé.", "Ofrecer el pecho cada vez que el bebé muestre señales de hambre, respetando su ritmo y necesidad."], "D"),
        q("¿Cuál de las siguientes características indica un agarre correcto durante la lactancia materna?", ["Boca poco abierta y mentón separado del pecho.", "Boca muy abierta, labios evertidos y mentón pegado al pecho.", "El bebé toma únicamente el pezón.", "La madre presenta dolor durante toda la succión."], "B"),
        q("Según la estrategia IAMII, cuando es necesario ofrecer leche materna extraída, ¿cuál es la alternativa indicada para evitar interferencias con la lactancia?", ["Biberón y chupo.", "Únicamente biberón.", "Taza y cucharita.", "Cualquier recipiente disponible."], "C"),
      ],
    },
  },
  {
    titulo: "Estrategias ETMI-Plus y FÉNIX",
    categoria: "Rutas Integrales",
    resumen: "Eliminación de la transmisión materno infantil (VIH, sífilis, hepatitis B, Chagas) e indicadores FÉNIX.",
    actividadIds: ["cmsbjggmh000tvkl8k131jl66"],
    lecciones: [{ titulo: "Presentación · Estrategias ETMI-Plus y FÉNIX", tipo: "PDF", archivo: "riamp-etmiplus-fenix.pdf", minutos: 30 }],
    quizFinal: {
      titulo: "Evaluación · ETMI-Plus y FÉNIX",
      preguntas: [
        q("¿Qué enfermedades prioriza la estrategia ETMI-Plus?", ["Dengue, malaria y tuberculosis", "Influenza, COVID-19 y dengue", "VIH, sífilis, hepatitis B y enfermedad de Chagas", "Diabetes, hipertensión y obesidad"], "C"),
        q("¿Cuál es la meta de transmisión materno infantil del VIH para 2030?", ["Menor o igual al 10%", "Menor o igual al 2%", "Menor o igual al 5%", "0%"], "B"),
        q("¿Cuándo debe realizarse la captación temprana de la gestante según la presentación?", ["Después de la semana 20", "Antes de la semana 30", "Antes de la semana 10 de gestación", "Únicamente al momento del parto"], "C"),
        q("¿Cuál es la meta del indicador FÉNIX de mortalidad materna?", ["Menos de 10 muertes", "Menos de 5 muertes", "1 muerte", "0 muertes"], "D"),
        q("¿Cuál es la meta del tamizaje de VIH en gestantes dentro de los indicadores FÉNIX?", ["Mayor al 70%", "Mayor al 80%", "Mayor al 90%", "Mayor al 95%"], "D"),
      ],
    },
  },
  {
    titulo: "Ruta Materno Perinatal según Resolución 3280 de 2018",
    categoria: "Rutas Integrales",
    resumen: "Inducción y reinducción en la RIAMP 3280: captación temprana, controles, PTOG y lactancia.",
    actividadIds: ["cmsbjggm9000rvkl8c2bwehc1"],
    lecciones: [{ titulo: "Presentación · RIAMP Resolución 3280 de 2018", tipo: "PDF", archivo: "riamp-3280.pdf", minutos: 35 }],
    quizFinal: {
      titulo: "Evaluación · RIAMP 3280",
      preguntas: [
        q("¿Antes de qué semana se considera captación temprana de la gestante?", ["Semana 20", "Semana 16", "Semana 10", "Semana 24"], "C"),
        q("¿Cuál es el número mínimo de controles prenatales para una gestante nulípara?", ["5 controles", "7 controles", "10 controles", "12 controles"], "C"),
        q("¿Cada cuánto se realiza el control prenatal hasta la semana 36?", ["Cada semana", "Cada 15 días", "Mensualmente", "Cada dos meses"], "C"),
        q("¿Entre qué semanas se realiza la prueba de tolerancia oral a la glucosa (PTOG)?", ["Entre las semanas 10 y 12", "Entre las semanas 18 y 20", "Entre las semanas 24 y 28", "Entre las semanas 35 y 37"], "C"),
        q("¿Cuándo se recomienda iniciar la lactancia materna después del nacimiento?", ["Después de 6 horas", "Al día siguiente", "Después de las primeras 3 horas", "Dentro de la primera hora de vida"], "D"),
      ],
    },
  },
  // ============================== PRECURSORAS ==============================
  {
    titulo: "Patologías precursoras y ruta cardiovascular",
    categoria: "Rutas Integrales",
    resumen: "Diagnóstico adecuado, control terapéutico y descarte de patologías precursoras en el programa de crónicos.",
    actividadIds: ["cmsbjggnc0010vkl8ae5ty5h0", "cmsbjggnh0011vkl8613xyexo", "cmsbjggnm0012vkl8mr24av5j"],
    lecciones: [
      { titulo: "Presentación · Inducción precursoras", tipo: "PDF", archivo: "precursoras-induccion.pdf", minutos: 30 },
      { titulo: "Presentación · Descarte de patología precursora", tipo: "PDF", archivo: "precursoras-descarte.pdf", minutos: 25 },
    ],
    quizFinal: {
      titulo: "Evaluación · Ruta cardiovascular (pre y post test)",
      preguntas: [
        q("¿Cuál de las siguientes cifras se consideran hipertensión arterial?", ["110/70 mmHg", "125/80 mmHg", "140/90 mmHg", "90/60 mmHg"], "C", "Clave asignada por criterio clínico: el documento del área no traía las respuestas marcadas. Confirmar con Rutas Integrales."),
        q("¿Cuál es uno de los principales factores de riesgo para desarrollar Diabetes Mellitus?", ["Obesidad y sobrepeso", "Realizar actividad física frecuentemente", "Dormir 8 horas diarias"], "A", "Clave asignada por criterio clínico: confirmar con Rutas Integrales."),
        q("¿Qué complicaciones se pueden presentar cuando la hipertensión o la diabetes no son controladas?", ["Mejoría espontánea de la enfermedad", "Infarto, ACV, daño renal", "Cefalea"], "B", "Clave asignada por criterio clínico: confirmar con Rutas Integrales."),
        q("¿Cuándo se indica la RAC?", ["Cuando la TFG es mayor a 60 ml/min", "Cuando la creatinina está en rango normal", "Cuando el paciente refiere disuria"], "A", "Clave asignada por criterio clínico: confirmar con Rutas Integrales."),
        q("¿Es indicada la hemoglobina glicosilada en pacientes hipertensos?", ["Sí", "No"], "A", "Clave asignada por criterio clínico: confirmar con Rutas Integrales."),
        q("¿Cada cuánto se realizan los controles médicos a pacientes con enfermedades crónicas controladas?", ["Cada mes", "Cada 6 meses", "Cada 3 meses"], "C", "Clave asignada por criterio clínico: confirmar con Rutas Integrales."),
        q("¿Qué pacientes se estudian para enfermedad renal crónica?", ["Asmáticos", "Epocosos", "Hipertensos y diabéticos"], "C", "Clave asignada por criterio clínico: confirmar con Rutas Integrales."),
        q("¿Con qué hemoglobina glicosilada ingresa el paciente a la ruta cardiovascular?", ["5%", ">6.5%", "3.2%"], "B", "Clave asignada por criterio clínico: confirmar con Rutas Integrales."),
      ],
    },
  },
  // ============================== SALUD ORAL ==============================
  {
    titulo: "Salud oral: asignación de citas y ruta de Promoción y Mantenimiento",
    categoria: "Rutas Integrales",
    resumen: "Casos prácticos de asignación de citas odontológicas, cumplimiento de metas RPYM y estrategia Soy Generación Más Sonriente.",
    actividadIds: ["cmsbjggnx0015vkl8yvrtcg5c", "cmsbjggns0014vkl8kbhrhriv", "cmsbjggnp0013vkl8to6w5mww"],
    lecciones: [{ titulo: "Presentación · Salud oral", tipo: "PDF", archivo: "salud-oral.pdf", minutos: 25 }],
    quizFinal: {
      titulo: "Evaluación · Salud oral (casos prácticos)",
      preguntas: [
        q("Caso 1. Usuaria de 28 años que se comunica con el call center. Refiere que hace dos meses le realizaron una limpieza y que está en tratamiento odontológico con restauraciones en resina; además informa que hace dos días confirmó que está en embarazo. ¿Cuál cita debe asignarse?", ["Cita para continuar tratamiento de restauraciones (calzas).", "Cita de Promoción y Mantenimiento de la Salud (PMS) para iniciar la Ruta Materno Perinatal."], "B"),
        q("Caso 2. Usuaria de 50 años que solicita cita odontológica para una restauración (calza). En el sistema se evidencia que no asiste a consulta odontológica desde hace 26 meses. ¿Cuál cita debe asignarse?", ["Cita para realizar la restauración (calza).", "Cita de Promoción y Mantenimiento de la Salud (PMS)."], "B"),
        q("Caso 3. Usuaria de 15 años que solicita cita para la extracción de una pieza dental. Su última consulta fue de Promoción y Mantenimiento de la Salud (PMS) hace 5 meses y 17 días. ¿Cuál cita debe asignarse?", ["Cita para realizar la exodoncia (extracción dental).", "Cita de Promoción y Mantenimiento de la Salud (PMS)."], "B"),
        q("Caso 4. Usuaria de 20 años del municipio de Pore, primera vez que solicita cita odontológica; el municipio cuenta con odontólogo e higienista oral. ¿Con cuál profesional debe asignarse la cita?", ["Odontólogo.", "Higienista oral."], "A"),
        q("Caso 5. Usuaria de 29 años con dolor al masticar por erupción de cordales; nunca ha asistido a consulta odontológica y se le asigna cita de PMS. ¿En qué curso de vida se clasifica para el cumplimiento del indicador?", ["Curso de vida juventud.", "Curso de vida adultez."], "B"),
      ],
    },
  },
  // ============================== PMS ==============================
  {
    titulo: "Ruta de Promoción y Mantenimiento de la Salud (PMS)",
    categoria: "Rutas Integrales",
    resumen: "Cursos de vida, tamizajes y registro clínico en la ruta de Promoción y Mantenimiento de la Salud (Res. 3280).",
    actividadIds: [
      "cmsbjggmt000vvkl8ywvdxg1m",
      "cmsbjggmw000wvkl89t1pfzwb",
      "cmsbjggn1000xvkl8ktvkm4al",
      "cmsbjggn3000yvkl8ng4nqmu9",
      "cmsbjggn8000zvkl8nxvj0oku",
    ],
    lecciones: [{ titulo: "Video · Capacitación PMS", tipo: "VIDEO", archivo: "capacitacion-pms.mp4", minutos: 60 }],
    quizFinal: {
      titulo: "Evaluación · Promoción y Mantenimiento de la Salud (pre y post test)",
      preguntas: [
        q("¿Cuál es el propósito principal de la Ruta de Promoción y Mantenimiento de la Salud?", ["Atender únicamente a personas con enfermedades crónicas.", "Organizar exclusivamente las consultas de la población afiliada.", "Promover la salud, prevenir la enfermedad, detectar tempranamente alteraciones y gestionar oportunamente los riesgos en salud durante el curso de vida.", "Garantizar únicamente el tratamiento de enfermedades de alto costo."], "C"),
        q("¿Cuáles de las siguientes hacen parte de las intervenciones de la Ruta de Promoción y Mantenimiento de la Salud?", ["Diagnóstico, tratamiento, hospitalización y rehabilitación.", "Promoción, tratamiento, rehabilitación y cuidados paliativos.", "Valoración integral, protección específica, detección temprana y educación para la salud.", "Consulta especializada, hospitalización, cirugía y rehabilitación."], "C"),
        q("¿Cuál es la importancia de identificar correctamente el curso de vida durante la atención?", ["Permite definir únicamente el tipo de profesional que debe atender al usuario.", "Permite establecer las intervenciones, valoraciones y acciones de promoción y mantenimiento que corresponden según la edad y las necesidades de la persona.", "Permite determinar exclusivamente el diagnóstico médico.", "Permite evitar el registro de antecedentes en la historia clínica."], "B"),
        qm("En relación con el tamizaje de cáncer de cuello uterino, ¿cuáles afirmaciones son correctas? (Seleccione dos respuestas)", ["Entre los 25 y 29 años se utiliza citología de cuello uterino.", "Entre los 30 y 65 años se utiliza prueba de ADN para VPH de alto riesgo.", "La mamografía es la prueba principal para detectar cáncer de cuello uterino.", "La prueba de sangre oculta en materia fecal es el tamizaje para cáncer de cuello uterino."], ["A", "B"]),
        q("En la población de riesgo promedio, ¿a quién está dirigida la tamización para cáncer colorrectal?", ["Hombres y mujeres de 30 a 49 años.", "Mujeres de 40 a 69 años.", "Hombres y mujeres de 50 a 75 años.", "Únicamente hombres mayores de 40 años."], "C"),
        q("En relación con la detección temprana del cáncer de próstata, ¿cuál afirmación es correcta?", ["Está dirigida exclusivamente a hombres menores de 40 años.", "En la población objeto, la tamización puede involucrar PSA y tacto rectal, teniendo en cuenta la información y decisión concertada con el usuario.", "Se realiza únicamente mediante mamografía.", "Se realiza únicamente cuando el usuario presenta síntomas."], "B"),
        qm("Respecto al tamizaje de cáncer de mama, seleccione las dos afirmaciones correctas.", ["El examen clínico de mama hace parte de la atención de las mujeres desde los 40 años.", "La mamografía de tamización está dirigida a mujeres de 50 a 69 años.", "La mamografía de tamización está indicada únicamente entre los 30 y 39 años.", "La detección temprana de cáncer de mama no requiere considerar antecedentes ni factores de riesgo."], ["A", "B"]),
        qm("Respecto a las infecciones de transmisión sexual, ¿cuáles afirmaciones son correctas? (Seleccione dos respuestas)", ["La oferta de pruebas para ITS debe relacionarse con la valoración del riesgo y las condiciones individuales.", "Las pruebas para VIH y sífilis están dirigidas exclusivamente a mujeres gestantes.", "La identificación de riesgo puede llevar a la necesidad de realizar pruebas o establecer seguimiento.", "Las ITS solamente deben abordarse cuando la persona presenta síntomas."], ["A", "C"]),
        q("En primera infancia, ¿cuál de los siguientes instrumentos se relaciona con la valoración del desarrollo infantil?", ["Índice de Barthel.", "Escala de Yesavage.", "Escala Abreviada de Desarrollo – EAD-3.", "Cuestionario FINDRISC."], "C"),
        q("Durante la atención de niños y niñas, ¿qué debe hacerse cuando se identifica una señal de alerta o una alteración?", ["Registrarla únicamente y finalizar la atención.", "Ignorarla si el niño no presenta síntomas.", "Interpretar el hallazgo y establecer la conducta, seguimiento o remisión que corresponda.", "Esperar hasta la siguiente consulta para decidir qué hacer."], "C"),
        q("¿Cuál de las siguientes herramientas hace parte de la valoración integral del adolescente para valorar el desarrollo puberal?", ["Escala Abreviada de Desarrollo – EAD-3.", "Índice de Barthel.", "Estadios de Tanner.", "Escala de Yesavage."], "C"),
        q("Durante la adultez, una de las prioridades de la Ruta de Promoción y Mantenimiento de la Salud es:", ["Atender exclusivamente enfermedades crónicas ya diagnosticadas.", "Realizar únicamente actividades de rehabilitación.", "Detectar tempranamente alteraciones y controlar factores de riesgo para prevenir complicaciones y favorecer una mejor calidad de vida.", "Remitir todos los usuarios a atención especializada."], "C"),
        q("¿Cuál de las siguientes afirmaciones describe mejor el propósito de la atención integral de la persona mayor?", ["Identificar únicamente enfermedades crónicas.", "Promover la autonomía, preservar la funcionalidad, identificar riesgos y favorecer un envejecimiento saludable.", "Realizar exclusivamente actividades de rehabilitación.", "Remitir a todas las personas mayores a medicina especializada."], "B"),
        qm("¿Cuáles elementos son fundamentales para garantizar un registro clínico completo y trazable? (Seleccione dos respuestas)", ["Registrar los hallazgos, resultados, intervenciones y conducta definida.", "Registrar únicamente que la consulta fue realizada.", "Documentar los resultados de los instrumentos o tamizajes aplicados y el seguimiento cuando corresponda.", "Utilizar expresiones generales como «todo normal» sin especificar lo valorado."], ["A", "C"]),
        q("Un profesional realiza un tamizaje y obtiene un resultado alterado. ¿Cuál es la conducta más adecuada?", ["Registrar únicamente que el tamizaje fue realizado.", "Esperar a que el usuario solicite nuevamente atención.", "Registrar el resultado, interpretarlo y establecer la conducta, remisión o seguimiento que corresponda.", "Eliminar el resultado de la historia clínica para evitar inconsistencias."], "C"),
      ],
    },
  },
  // ============================== SALUD PÚBLICA ==============================
  {
    titulo: "Lineamiento programático de tuberculosis (Resolución 227 de 2020)",
    categoria: "Salud Pública",
    resumen: "Detección, clasificación, tratamiento y seguimiento de la tuberculosis según la Resolución 227 de 2020.",
    actividadIds: ["cmsbjggpw001fvkl80tm61pv1"],
    lecciones: [
      { titulo: "Presentación · Lineamiento programático TB", tipo: "PDF", archivo: "sp-tb.pdf", minutos: 30 },
      { titulo: "Resolución No. 227 de 2020 (documento de consulta)", tipo: "PDF", archivo: "sp-tb-resolucion-227.pdf", minutos: 20 },
    ],
    quizFinal: {
      titulo: "Evaluación · Lineamiento programático TB (pre test)",
      preguntas: [
        q("Según el lineamiento programático, en la población general se considera sintomático respiratorio a la persona que presenta:", ["Tos durante 3 días.", "Tos y expectoración por más de 15 días.", "Fiebre por más de 5 días.", "Dolor torácico únicamente."], "B"),
        q("En una persona con VIH o inmunosupresión, ¿cuál de los siguientes criterios permite sospechar tuberculosis?", ["Tos con o sin expectoración, fiebre, pérdida de peso o sudoración nocturna, de cualquier tiempo de evolución.", "Solo tos por más de 15 días.", "Hemoptisis exclusivamente.", "Fiebre mayor de 15 días."], "A"),
        q("¿Cuál de las siguientes afirmaciones define mejor un caso de tuberculosis presuntiva?", ["Persona con baciloscopia positiva.", "Persona con síntomas o signos sugestivos de tuberculosis identificados durante la valoración médica.", "Persona con radiografía normal.", "Persona que finalizó tratamiento."], "B"),
        q("La tuberculosis que afecta la pleura, ganglios, meninges o huesos se clasifica como:", ["Tuberculosis pulmonar.", "Tuberculosis farmacorresistente.", "Tuberculosis extrapulmonar.", "Tuberculosis latente."], "C"),
        q("Un paciente que nunca ha recibido tratamiento antituberculoso o lo ha recibido por menos de un mes se clasifica como:", ["Caso previamente tratado.", "Recaída.", "Caso nuevo.", "Fracaso terapéutico."], "C"),
        q("¿Cuál de las siguientes es una responsabilidad de las IPS frente al programa de tuberculosis?", ["Garantizar el diagnóstico, tratamiento y seguimiento oportuno de los pacientes.", "Atender únicamente los casos hospitalizados.", "Realizar seguimiento solo a pacientes con TB pulmonar.", "Notificar únicamente los casos confirmados por cultivo."], "A"),
        q("¿Qué estrategia debe implementar la IPS para favorecer el cumplimiento del tratamiento?", ["Hospitalización obligatoria.", "Tratamiento Directamente Observado (TDO).", "Tratamiento únicamente domiciliario.", "Suspensión del seguimiento cuando el paciente mejora."], "B"),
        q("Una persona afectada por tuberculosis que interrumpe el tratamiento durante un mes o más se clasifica como:", ["Curado.", "Tratamiento terminado.", "Pérdida en el seguimiento.", "Fracaso."], "C"),
        q("Además del tratamiento, las IPS deben fortalecer la adherencia mediante:", ["Estrategias concertadas con la persona afectada.", "Suspensión del tratamiento ante efectos adversos.", "Atención únicamente cuando el paciente consulte.", "Remisión automática a otra institución."], "A"),
        q("El principal propósito de la Resolución 227 de 2020 es:", ["Regular únicamente la notificación al SIVIGILA.", "Adoptar el lineamiento técnico y operativo para la prevención, diagnóstico, tratamiento, seguimiento y control de la tuberculosis en Colombia.", "Definir únicamente los medicamentos antituberculosos.", "Establecer las funciones exclusivas de los laboratorios."], "B"),
      ],
    },
    quizzesModulo: [
      {
        trasLeccion: 1,
        def: {
          titulo: "Post test · Lineamiento programático TB",
          preguntas: [
            q("Un paciente consulta por tos con expectoración desde hace 20 días. Según el lineamiento programático, esta persona debe ser considerada como:", ["Caso confirmado de tuberculosis.", "Sintomático respiratorio.", "Caso previamente tratado.", "Tuberculosis extrapulmonar."], "B"),
            q("Una persona que vive con VIH presenta fiebre, pérdida de peso y tos de cuatro días de evolución. Según el lineamiento, el profesional de salud debe:", ["Esperar que complete 15 días de tos.", "Considerarlo sintomático respiratorio e iniciar el proceso diagnóstico.", "Tratarlo únicamente con antibióticos.", "Solicitar control en un mes."], "B"),
            q("¿Cuál de las siguientes acciones corresponde a una responsabilidad de la IPS frente al Programa de Tuberculosis?", ["Implementar el Tratamiento Directamente Observado (TDO) para favorecer la adherencia.", "Remitir todos los pacientes sin iniciar tratamiento.", "Notificar únicamente los casos de TB pulmonar.", "Suspender el seguimiento cuando el paciente mejora."], "A"),
            q("Un paciente recibió tratamiento antituberculoso durante dos meses hace tres años y nuevamente presenta tuberculosis. Según el lineamiento, este paciente se clasifica como:", ["Caso nuevo.", "Caso previamente tratado.", "Tuberculosis presuntiva.", "Sintomático respiratorio."], "B"),
            q("Un paciente con tuberculosis pulmonar completa el tratamiento, pero no cuenta con baciloscopia o cultivo negativo documentado al finalizar. El resultado del tratamiento corresponde a:", ["Curado.", "Tratamiento terminado.", "Fracaso.", "Pérdida en el seguimiento."], "B"),
            q("Una persona con tuberculosis abandona el tratamiento durante seis semanas. Según la clasificación de resultados, corresponde a:", ["Curado.", "Tratamiento terminado.", "Pérdida en el seguimiento.", "Recaída."], "C"),
            q("¿Cuál de las siguientes actividades fortalece la vigilancia epidemiológica y el seguimiento de los casos de tuberculosis?", ["Mantener actualizada la tarjeta individual de tratamiento y registrar oportunamente la información en CRONHIS.", "Registrar únicamente el diagnóstico inicial.", "Actualizar la información solo al finalizar el tratamiento.", "Llevar registros únicamente en la historia clínica."], "A"),
            q("¿Qué debe hacer la IPS cuando un paciente presenta reacciones adversas a los medicamentos antituberculosos?", ["Suspender definitivamente el tratamiento.", "Vigilar, notificar y brindar el manejo correspondiente, fortaleciendo la adherencia.", "Dar de alta al paciente.", "Esperar la siguiente consulta para reportarlo."], "B"),
            q("¿Cuál es el objetivo principal del Tratamiento Directamente Observado (TDO)?", ["Reducir el número de consultas.", "Garantizar la adherencia y el éxito del tratamiento, disminuyendo el riesgo de abandono y resistencia.", "Disminuir los costos del programa.", "Hospitalizar a todos los pacientes."], "B"),
            q("La principal responsabilidad del talento humano frente a la Resolución 227 de 2020 es:", ["Aplicar los lineamientos para garantizar la detección oportuna, el diagnóstico, tratamiento, seguimiento y control integral de la tuberculosis.", "Solicitar únicamente baciloscopias.", "Atender solo pacientes con TB pulmonar.", "Notificar únicamente los casos hospitalizados."], "A"),
          ],
        },
      },
    ],
  },
  {
    titulo: "Lineamiento programático de lepra (enfermedad de Hansen)",
    categoria: "Salud Pública",
    resumen: "Sospecha, clasificación, poliquimioterapia y seguimiento de la enfermedad de Hansen.",
    actividadIds: ["cmsbjggq1001gvkl8pqawxhg2"],
    lecciones: [{ titulo: "Presentación · Lineamiento programático LEPRA", tipo: "PDF", archivo: "sp-lepra.pdf", minutos: 30 }],
    quizFinal: {
      titulo: "Evaluación · Lineamiento programático lepra (pre test)",
      preguntas: [
        q("¿Cuál es el agente causal de la enfermedad de Hansen (lepra)?", ["Mycobacterium tuberculosis", "Mycobacterium leprae", "Staphylococcus aureus", "Treponema pallidum"], "B"),
        q("La principal vía de transmisión de la lepra es:", ["Contacto sexual.", "Agua contaminada.", "Persona a persona mediante vías respiratorias y convivencia prolongada.", "Picadura de insectos."], "C"),
        q("¿Cuál de los siguientes órganos o sistemas es uno de los principales afectados por la lepra?", ["Sistema digestivo.", "Sistema nervioso periférico.", "Sistema cardiovascular.", "Sistema endocrino."], "B"),
        q("Un paciente con cuatro lesiones cutáneas y baciloscopia negativa se clasifica como:", ["Multibacilar.", "Paucibacilar.", "Lepra lepromatosa.", "Caso descartado."], "B"),
        q("¿Cuál de los siguientes signos debe hacer sospechar enfermedad de Hansen?", ["Tos persistente.", "Mancha con pérdida de sensibilidad.", "Dolor abdominal.", "Diarrea persistente."], "B"),
        q("El tratamiento de la lepra es:", ["Exclusivamente quirúrgico.", "Poliquimioterapia (PQT).", "Antibióticos durante siete días.", "No existe tratamiento."], "B"),
        q("El esquema de tratamiento para un caso paucibacilar (PB) corresponde a:", ["3 dosis mensuales de PQT.", "6 dosis mensuales de PQT.", "9 dosis mensuales de PQT.", "12 dosis mensuales de PQT."], "B"),
        q("El esquema de tratamiento para un caso multibacilar (MB) corresponde a:", ["6 dosis mensuales.", "8 dosis mensuales.", "12 dosis mensuales de PQT.", "24 dosis mensuales."], "C"),
        q("Durante el seguimiento de un paciente con lepra, es importante evaluar:", ["Solo la presión arterial.", "Únicamente el peso.", "Sensibilidad, fuerza muscular, adherencia y aparición de nuevas lesiones.", "Solo la temperatura corporal."], "C"),
        q("¿Cuál es el principal beneficio del diagnóstico temprano de la lepra?", ["Evitar la hospitalización.", "Evitar discapacidad permanente e interrumpir la transmisión de la enfermedad.", "Disminuir el uso de medicamentos.", "Reducir el número de consultas médicas."], "B"),
      ],
    },
    quizzesModulo: [
      {
        trasLeccion: 0,
        def: {
          titulo: "Post test · Lineamiento programático lepra",
          preguntas: [
            q("Un paciente consulta por una lesión hipopigmentada en el brazo con pérdida de sensibilidad al tacto y al dolor. ¿Cuál debe ser la conducta del profesional de salud?", ["Tranquilizar al paciente y citarlo en seis meses.", "Considerar el caso como sospechoso de lepra e iniciar el proceso diagnóstico.", "Formular antibiótico por siete días.", "Solicitar únicamente una radiografía."], "B"),
            q("Un paciente presenta cuatro lesiones cutáneas, sin bacilos demostrados en el frotis. Según la clasificación operacional corresponde a:", ["Lepra multibacilar.", "Lepra paucibacilar.", "Lepra lepromatosa.", "Lepra indeterminada."], "B"),
            q("Un paciente presenta ocho lesiones cutáneas y compromiso de un nervio periférico. ¿Cómo se clasifica?", ["Paucibacilar.", "Multibacilar.", "Caso descartado.", "Contacto de lepra."], "B"),
            q("¿Cuál es el esquema de tratamiento indicado para un caso multibacilar (MB)?", ["Rifampicina y dapsona durante 6 dosis mensuales.", "Rifampicina, clofazimina y dapsona durante 12 dosis mensuales de poliquimioterapia (PQT).", "Rifampicina únicamente.", "Clofazimina durante 6 meses."], "B"),
            q("Durante el seguimiento de un paciente con lepra, ¿qué aspectos deben evaluarse en cada control?", ["Peso y talla únicamente.", "Sensibilidad, fuerza muscular, aparición de nuevas lesiones, adherencia al tratamiento y reacciones leprosas.", "Solo signos vitales.", "Solo el estado nutricional."], "B"),
            q("¿Cuál de las siguientes manifestaciones corresponde a una reacción leprosa tipo I?", ["Nódulos dolorosos generalizados.", "Inflamación de las lesiones y dolor en los nervios.", "Tos persistente.", "Úlcera genital."], "B"),
            q("Según el lineamiento, ¿qué estructuras deben evaluarse siempre para prevenir discapacidad?", ["Corazón, pulmones y riñones.", "Ojos, manos y pies.", "Abdomen y columna.", "Oídos y cuello."], "B"),
            q("¿Cuál es el principal objetivo del diagnóstico temprano de la lepra?", ["Reducir el tiempo de consulta.", "Evitar discapacidades permanentes, interrumpir la transmisión y mejorar la calidad de vida del paciente.", "Disminuir el uso de medicamentos.", "Evitar la realización de baciloscopias."], "B"),
            q("Respecto a la lepra, ¿cuál de las siguientes afirmaciones es correcta?", ["Es una enfermedad altamente contagiosa por contacto ocasional.", "No tiene tratamiento.", "Tiene cura y el tratamiento oportuno disminuye el riesgo de discapacidad.", "Siempre requiere hospitalización."], "C"),
            q("Como integrante del talento humano en salud, ¿cuál es su principal responsabilidad frente a la atención de una persona con lepra?", ["Esperar la confirmación por laboratorio antes de actuar.", "Identificar oportunamente los casos sospechosos, facilitar el diagnóstico, promover el tratamiento y realizar el seguimiento conforme al lineamiento programático.", "Remitir todos los pacientes sin realizar valoración.", "Iniciar tratamiento únicamente cuando el paciente presente discapacidad."], "B"),
          ],
        },
      },
    ],
  },
  {
    titulo: "Algoritmo diagnóstico de ETV: dengue y Chagas",
    categoria: "Salud Pública",
    resumen: "Diagnóstico, clasificación y notificación de las enfermedades transmitidas por vectores: dengue y enfermedad de Chagas.",
    actividadIds: ["cmsbjggq5001hvkl8fdkp6e9g"],
    lecciones: [
      { titulo: "Presentación · Enfermedad de Chagas", tipo: "PDF", archivo: "sp-chagas.pdf", minutos: 30 },
      { titulo: "Presentación · Dengue", tipo: "PDF", archivo: "sp-dengue.pdf", minutos: 30 },
    ],
    quizFinal: {
      titulo: "Evaluación · ETV dengue y Chagas (pre test)",
      preguntas: [
        q("¿Cuál es el agente causal de la enfermedad de Chagas?", ["Leishmania donovani", "Trypanosoma cruzi", "Plasmodium vivax", "Toxoplasma gondii"], "B"),
        q("La enfermedad de Chagas afecta principalmente:", ["Riñones y pulmón.", "Corazón y sistema digestivo.", "Hígado y páncreas.", "Piel y sistema urinario."], "B"),
        q("¿Cuál de las siguientes manifestaciones clínicas es característica de un caso probable de Chagas agudo?", ["Hipertensión arterial.", "Signo de Romaña o chagoma de inoculación.", "Ictericia.", "Exantema generalizado."], "B"),
        q("Según el lineamiento, un caso probable de Chagas agudo debe notificarse:", ["Mensualmente.", "Semanalmente.", "De manera superinmediata.", "Solo cuando el laboratorio confirme el diagnóstico."], "C"),
        q("¿Cómo se realiza la notificación de un caso probable de Chagas crónico latente?", ["Superinmediata.", "Semanal.", "Mensual.", "No requiere notificación."], "B"),
        q("En una persona con sospecha de enfermedad de Chagas, el diagnóstico debe confirmarse mediante:", ["Valoración clínica únicamente.", "Ayudas diagnósticas de laboratorio según la fase de la enfermedad.", "Radiografía de tórax.", "Ecografía abdominal."], "B"),
        q("Antes de iniciar tratamiento para Chagas, el paciente debe contar con:", ["Exámenes pretratamiento.", "Endoscopia digestiva.", "Colonoscopia.", "Resonancia magnética."], "A"),
        q("Al finalizar el tratamiento para la enfermedad de Chagas, el lineamiento indica que:", ["Debe repetirse la serología cada seis meses.", "Deben solicitarse serologías anualmente.", "No deben volver a solicitarse serologías como control del tratamiento.", "Debe realizarse una prueba rápida cada año."], "C"),
        q("En la cohorte de gestantes, uno de los objetivos del programa de Chagas es:", ["Realizar tamizaje en al menos el 50 % de las gestantes.", "Alcanzar un tamizaje igual o superior al 90 % de las gestantes.", "Realizar tamizaje únicamente en gestantes sintomáticas.", "Tamizar solo a las gestantes del área rural."], "B"),
        q("¿Cuál es una responsabilidad del personal asistencial frente a la enfermedad de Chagas?", ["Detectar oportunamente los casos, notificarlos y garantizar el manejo de acuerdo con el lineamiento.", "Esperar únicamente la confirmación por especialistas.", "Notificar únicamente los casos hospitalizados.", "Formular tratamiento sin confirmar el diagnóstico."], "A"),
        q("El dengue es una enfermedad causada por:", ["Una bacteria.", "Un virus transmitido por la picadura de mosquitos infectados.", "Un parásito.", "Un hongo."], "B"),
        q("¿Cuál es el principal vector transmisor del dengue?", ["Anopheles albimanus.", "Aedes aegypti.", "Culex quinquefasciatus.", "Lutzomyia longipalpis."], "B"),
        q("Según la clasificación de la OMS, el dengue se divide en:", ["Dengue leve y dengue hemorrágico.", "Dengue agudo y dengue crónico.", "Dengue sin signos de alarma, dengue con signos de alarma y dengue grave.", "Dengue clásico y dengue complicado."], "C"),
        q("El dengue grave se caracteriza principalmente por:", ["Tos persistente.", "Extravasación severa de plasma que puede producir choque por dengue.", "Hipertensión arterial.", "Diarrea intensa."], "B"),
        q("¿Cuál es el tipo de notificación del dengue al SIVIGILA?", ["Mensual.", "Semanal.", "Notificación inmediata.", "No requiere notificación."], "C"),
        q("¿Cuál es la prueba diagnóstica indicada entre el primer y quinto día de inicio de síntomas?", ["IgG.", "NS1 (prueba rápida).", "Hemocultivo.", "Coprológico."], "B"),
        q("¿A partir de qué día de síntomas se recomienda realizar IgM ELISA?", ["Desde el primer día.", "Entre el segundo y tercer día.", "A partir del sexto día.", "Después de 30 días."], "C"),
        q("El objetivo principal de clasificar correctamente un caso de dengue es:", ["Disminuir el número de consultas.", "Definir el manejo clínico oportuno y prevenir complicaciones.", "Evitar la toma de muestras.", "Reducir los costos de atención."], "B"),
        q("¿Cuál de las siguientes complicaciones puede presentarse en un paciente con dengue grave?", ["Miocarditis y encefalitis.", "Apendicitis.", "Otitis media.", "Gastritis."], "A"),
        q("Como profesional de salud, una de sus responsabilidades frente al dengue es:", ["Notificar oportunamente el caso y garantizar el manejo clínico conforme al lineamiento.", "Esperar la confirmación del laboratorio para notificar.", "Formular antibióticos a todos los pacientes.", "Remitir todos los casos al tercer nivel sin clasificación clínica."], "A"),
      ],
    },
    quizzesModulo: [
      {
        trasLeccion: 0,
        def: {
          titulo: "Post test · Enfermedad de Chagas",
          preguntas: [
            q("Un paciente consulta con fiebre, edema bipalpebral unilateral (signo de Romaña) y antecedente de exposición al vector. Según el lineamiento, este caso debe:", ["Esperar confirmación serológica antes de reportarlo.", "Notificarse de manera superinmediata como caso probable de Chagas agudo.", "Notificarse de forma semanal.", "No requiere notificación."], "B"),
            q("Un paciente es diagnosticado con Chagas crónico latente. ¿Cuál es el tipo de notificación correspondiente?", ["Superinmediata.", "Semanal.", "Mensual.", "No requiere notificación."], "B"),
            q("Antes de iniciar el tratamiento etiológico para la enfermedad de Chagas, el profesional de salud debe:", ["Solicitar únicamente una radiografía de tórax.", "Realizar los exámenes pretratamiento establecidos en el lineamiento.", "Esperar un año para iniciar el tratamiento.", "Solicitar únicamente una prueba rápida."], "B"),
            q("Al finalizar el tratamiento para la enfermedad de Chagas, ¿cuál es la conducta recomendada según la presentación?", ["Solicitar serología de control cada seis meses.", "Solicitar una nueva serología al año.", "No volver a ordenar serologías como control del tratamiento.", "Solicitar serología únicamente si el paciente presenta síntomas."], "C"),
            q("Una gestante tiene una prueba positiva para enfermedad de Chagas. Según el programa, una de las metas es:", ["Realizar seguimiento únicamente durante el embarazo.", "Garantizar el seguimiento de la gestante y su hijo dentro de la cohorte establecida.", "Finalizar el seguimiento al momento del parto.", "Notificar solo al recién nacido."], "B"),
            q("Un médico identifica un paciente con sospecha de enfermedad de Chagas. ¿Cuál es su responsabilidad inicial?", ["Esperar la confirmación del especialista.", "Detectar oportunamente el caso, diligenciar la ficha de notificación y garantizar el manejo correspondiente.", "Remitir al paciente sin registrar la información.", "Esperar el resultado del banco de sangre."], "B"),
            q("Según la presentación, ¿qué papel desempeña el bacteriólogo dentro del programa de vigilancia?", ["Formular el tratamiento.", "Apoyar el diagnóstico, reportar resultados compatibles con eventos de interés en salud pública e informar ausencia de insumos diagnósticos.", "Realizar únicamente actividades administrativas.", "Hacer seguimiento domiciliario."], "B"),
            q("Una persona es remitida por un banco de sangre con tamizaje reactivo para Chagas. Según el flujo presentado, ¿qué debe realizar la EAPB?", ["Dar de alta al paciente.", "Inducir la demanda para consulta médica y activar la ruta de tratamiento.", "Repetir únicamente el tamizaje.", "Esperar la aparición de síntomas."], "B"),
            q("¿Cuál es el objetivo principal del tratamiento y seguimiento de los pacientes con enfermedad de Chagas?", ["Confirmar nuevamente el diagnóstico mediante serología.", "Brindar manejo oportuno, vigilar la evolución clínica y favorecer el adecuado seguimiento del paciente.", "Disminuir únicamente los costos de atención.", "Realizar controles solo cuando el paciente presente síntomas."], "B"),
            q("Como integrante del talento humano en salud, ¿cuál de las siguientes acciones contribuye al fortalecimiento del programa de Chagas?", ["Detectar oportunamente los casos, notificarlos según el tipo de evento y garantizar el acceso al diagnóstico, tratamiento y seguimiento.", "Notificar únicamente los casos hospitalizados.", "Solicitar tratamiento únicamente cuando existan complicaciones cardíacas.", "Esperar confirmación por laboratorio antes de iniciar cualquier acción programática."], "A"),
          ],
        },
      },
      {
        trasLeccion: 1,
        def: {
          titulo: "Post test · Dengue",
          preguntas: [
            q("Un paciente consulta con fiebre de 3 días, cefalea intensa, mialgias y vive en un municipio endémico para dengue. Según el algoritmo diagnóstico presentado, ¿qué prueba es la más indicada?", ["IgM ELISA.", "Prueba rápida NS1.", "Hemocultivo.", "Coprológico."], "B"),
            q("Un paciente consulta con fiebre de 7 días y continúa con sospecha de dengue. ¿Cuál es la prueba diagnóstica indicada?", ["Prueba rápida NS1.", "IgM ELISA.", "Hemograma únicamente.", "Prueba de antígeno para influenza."], "B"),
            q("Un paciente presenta dolor abdominal intenso, vómito persistente y somnolencia. Según la clasificación de la OMS, corresponde a:", ["Dengue sin signos de alarma.", "Dengue con signos de alarma.", "Dengue descartado.", "Caso no clasificable."], "B"),
            q("Un paciente con dengue desarrolla choque por extravasación severa de plasma. ¿Cómo debe clasificarse?", ["Dengue sin signos de alarma.", "Dengue con signos de alarma.", "Dengue grave.", "Dengue probable."], "C"),
            q("¿Cuál de las siguientes complicaciones puede presentarse en un caso de dengue grave?", ["Miocarditis o encefalitis.", "Otitis media.", "Gastritis.", "Colelitiasis."], "A"),
            q("Frente a un caso sospechoso de dengue, el personal de salud debe:", ["Esperar la confirmación del laboratorio antes de notificar.", "Realizar la notificación inmediata al SIVIGILA conforme al lineamiento.", "Notificar únicamente los casos hospitalizados.", "Notificar solo cuando exista dengue grave."], "B"),
            q("¿Cuál es el objetivo principal de clasificar adecuadamente un paciente con dengue?", ["Reducir el tiempo de consulta.", "Definir el manejo clínico oportuno y disminuir el riesgo de complicaciones y muerte.", "Disminuir el número de pruebas diagnósticas.", "Facilitar únicamente la notificación."], "B"),
            q("Durante la atención de un paciente con sospecha de dengue, ¿cuál es una responsabilidad fundamental del talento humano en salud?", ["Administrar antibióticos de rutina.", "Identificar oportunamente el caso, clasificarlo correctamente e iniciar el manejo según el lineamiento vigente.", "Hospitalizar todos los pacientes.", "Esperar la confirmación laboratorial para iniciar el tratamiento."], "B"),
            q("En la presentación se resalta que la mejor estrategia para disminuir la mortalidad por dengue es:", ["Hospitalizar a todos los pacientes.", "Aplicar oportunamente los conocimientos mediante una correcta clasificación y manejo clínico.", "Realizar únicamente pruebas de laboratorio.", "Administrar antibióticos de amplio espectro."], "B"),
            q("Un paciente es clasificado correctamente desde su primera consulta y recibe un manejo oportuno conforme a los lineamientos. ¿Cuál es el principal beneficio esperado?", ["Disminuir el riesgo de progresión a dengue grave y reducir la mortalidad.", "Evitar la notificación al SIVIGILA.", "Eliminar la necesidad de seguimiento clínico.", "Evitar la toma de muestras diagnósticas."], "A"),
          ],
        },
      },
    ],
  },
];

// ---------------------------------------------------------------- montaje

async function adjuntarArchivo(lessonId: string, archivo: string, fileType: string, subidoPor: string) {
  const folder = `lessons/${lessonId}`;
  const dir = path.join(UPLOADS, folder);
  await mkdir(dir, { recursive: true });
  const fileName = `${Date.now()}-${path.basename(archivo).replace(/[^a-zA-Z0-9-_.]/g, "-").slice(0, 60)}`;
  await copyFile(path.join(ORIGEN, archivo), path.join(dir, fileName));
  const { size } = await stat(path.join(dir, fileName));
  const id = randomUUID();
  await prisma.media.create({
    data: { id, fileName, fileType, fileSize: size, folder, fileUrl: `/api/media/${id}`, uploadedBy: subidoPor },
  });
  await prisma.lesson.update({ where: { id: lessonId }, data: { fileUrl: `/api/media/${id}` } });
  return size;
}

async function crearPreguntas(quizId: string, preguntas: Pregunta[], area: string) {
  for (const [i, p] of preguntas.entries()) {
    if (!p.opciones.some((o) => o.ok)) throw new Error(`Pregunta sin clave: ${p.enunciado}`);
    await prisma.question.create({
      data: {
        quizId,
        type: p.multiple ? "MULTIPLE_CHOICE" : "SINGLE_CHOICE",
        statement: p.enunciado,
        area,
        score: 1,
        sortOrder: i,
        explanation: p.explanation ?? null,
        options: { create: p.opciones.map((o, j) => ({ text: o.t, isCorrect: !!o.ok, sortOrder: j })) },
      },
    });
  }
}

async function main() {
  const admin = await prisma.user.findFirstOrThrow({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  let montados = 0;
  for (const def of CURSOS) {
    console.log(`\n── ${def.titulo} ──`);
    const yaExiste = await prisma.course.findFirst({ where: { title: def.titulo }, select: { id: true } });
    if (yaExiste) {
      console.log("  Ya existe. Se salta.");
      continue;
    }

    const actividades = await prisma.trainingActivity.findMany({
      where: { id: { in: def.actividadIds } },
      select: { id: true, title: true, quarters: true, targetAudience: true, status: true, area: { select: { name: true, tutorId: true } } },
    });
    if (actividades.length !== def.actividadIds.length) {
      throw new Error(`Actividades no encontradas para «${def.titulo}»: esperaba ${def.actividadIds.length}, hay ${actividades.length}.`);
    }
    const responsable = actividades[0].area?.tutorId ?? admin.id;
    const audiencia = actividades[0].targetAudience;

    const categoria = await prisma.courseCategory.upsert({
      where: { name: def.categoria },
      update: {},
      create: { name: def.categoria },
    });

    const curso = await prisma.course.create({
      data: {
        title: def.titulo,
        slug: slugify(def.titulo),
        shortDescription: def.resumen,
        fullDescription: def.resumen,
        categoryId: categoria.id,
        courseType: "CAPACITACION",
        durationHours: 0,
        status: "PUBLISHED",
        publishedAt: new Date(),
        tutorId: responsable,
        passingScore: APROBAR,
        enrollmentMode: "ASSIGNED",
        targetAudience: audiencia,
        isSequential: false,
        instructions:
          `<p>Revisa el material completo y luego presenta la evaluación.</p>` +
          `<p>Necesitas <strong>${APROBAR}%</strong> para aprobar y tienes hasta ${INTENTOS} intentos.</p>`,
      },
    });

    const modulo = await prisma.courseModule.create({
      data: { courseId: curso.id, title: def.titulo, description: def.resumen, sortOrder: 0 },
    });

    // Lecciones en 0, 2, 4… para dejar el hueco impar al post-test del módulo.
    for (const [i, l] of def.lecciones.entries()) {
      const leccion = await prisma.lesson.create({
        data: {
          moduleId: modulo.id,
          title: l.titulo,
          contentType: l.tipo,
          sortOrder: i * 2,
          estimatedMinutes: l.minutos,
        },
      });
      const bytes = await adjuntarArchivo(
        leccion.id,
        l.archivo,
        l.tipo === "VIDEO" ? "video/mp4" : "application/pdf",
        responsable
      );
      console.log(`  Lección «${l.titulo}»: ${(bytes / 1048576).toFixed(1)} MB`);
    }

    // Post-tests del módulo (si el tema traía POST separado).
    for (const qm_ of def.quizzesModulo ?? []) {
      const quizModulo = await prisma.quiz.create({
        data: {
          courseId: curso.id,
          moduleId: modulo.id,
          title: qm_.def.titulo,
          description: `Refuerzo posterior a la presentación. Mínimo para aprobar: ${APROBAR}%.`,
          passingScore: APROBAR,
          maxAttempts: INTENTOS,
          showResultsNow: true,
          sortOrder: qm_.trasLeccion * 2 + 1,
        },
      });
      await crearPreguntas(quizModulo.id, qm_.def.preguntas, def.categoria);
      console.log(`  Post test «${qm_.def.titulo}»: ${qm_.def.preguntas.length} preguntas`);
    }

    // Evaluación final del curso: instrumento del ciclo presaber/postsaber.
    const quizFinal = await prisma.quiz.create({
      data: {
        courseId: curso.id,
        moduleId: null,
        title: def.quizFinal.titulo,
        description: `Se presenta como presaber antes de la capacitación y como postsaber después. Mínimo para aprobar: ${APROBAR}%.`,
        passingScore: APROBAR,
        maxAttempts: INTENTOS,
        showResultsNow: true,
      },
    });
    await crearPreguntas(quizFinal.id, def.quizFinal.preguntas, def.categoria);
    console.log(`  Evaluación final: ${def.quizFinal.preguntas.length} preguntas`);

    // Enganche con el PIC y apertura: curso vinculado y actividad ABIERTA.
    // Las ventanas quedan en null: ciclo automático (presaber hasta
    // presentarlo; postsaber después), como pidió la entidad.
    for (const act of actividades) {
      await prisma.trainingActivity.update({
        where: { id: act.id },
        data: {
          courseId: curso.id,
          ...(act.status === "DRAFT" ? { status: "OPEN", enabledAt: new Date() } : {}),
        },
      });
      console.log(`  PIC: «${act.title}» (T${act.quarters.join(",")}) → abierta con curso`);
    }
    montados++;
  }

  console.log(`\n${montados} cursos montados.`);

  const delPlan = { plan: { title: { contains: "Institucional" }, year: 2026 } };
  const total = await prisma.trainingActivity.count({ where: delPlan });
  const conCurso = await prisma.trainingActivity.count({ where: { ...delPlan, courseId: { not: null } } });
  console.log(`${conCurso} de ${total} capacitaciones del PIC con contenido montado.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
