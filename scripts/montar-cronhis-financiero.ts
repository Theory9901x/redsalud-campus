import { prisma } from "../lib/prisma";

/**
 * VIDEOTECA CRONHIS FINANCIERO en "Inducción y reinducción".
 *
 * 44 videotutoriales del canal del proveedor (@cronhis.financiero)
 * en UNA sola lección: la vista de videoteca del aula pinta un único
 * reproductor y la lista vertical de títulos agrupada por tema. Crear
 * 44 sub-lecciones haría tediosa la navegación con lo que ya
 * tiene el curso.
 *
 * El contenido de la lección es el JSON de la videoteca (no HTML): lo lee
 * la vista del aula. No editar esta lección desde el constructor.
 *
 * Módulo dirigido a ADMINISTRATIVO, no obligatorio. Idempotente.
 */
const SLUG_CURSO = "induccion-y-reinduccion";
const TITULO_MODULO = "Sistemas · Cronhis Financiero (administrativo)";
const TITULO_LECCION = "Videoteca Cronhis Financiero · 44 videotutoriales";

const CONTENIDO = "{\"videoteca\": true, \"videos\": [{\"id\": \"feu_BrXC6mI\", \"titulo\": \"Configurar contratos de prestación de servicios\", \"grupo\": \"Contratación\", \"seg\": 137}, {\"id\": \"EvChFeBrHhQ\", \"titulo\": \"Configurar tipo de contrato\", \"grupo\": \"Contratación\", \"seg\": 84}, {\"id\": \"7wi1-x5TR6I\", \"titulo\": \"Creación de perfiles contratos de prestación de servicios\", \"grupo\": \"Contratación\", \"seg\": 86}, {\"id\": \"IJuFf3-gvy4\", \"titulo\": \"Creación de terceros proveedores y contratistas\", \"grupo\": \"Contratación\", \"seg\": 37}, {\"id\": \"ilylCTqfq5E\", \"titulo\": \"Iniciar un proceso de contratación en el sistema Cronhis Financiero\", \"grupo\": \"Contratación\", \"seg\": 140}, {\"id\": \"JdWJtPx0178\", \"titulo\": \"Parametrización y cargue de formatos\", \"grupo\": \"Contratación\", \"seg\": 96}, {\"id\": \"1yXdNFfTTbY\", \"titulo\": \"Registrar servicios perfiles de contratistas o contratos especificos\", \"grupo\": \"Contratación\", \"seg\": 45}, {\"id\": \"mknqjUUhuHk\", \"titulo\": \"Registrar un contrato en el sistema de información\", \"grupo\": \"Contratación\", \"seg\": 372}, {\"id\": \"B96QKImM88c\", \"titulo\": \"Registro de contratos en Cronhis financiero\", \"grupo\": \"Contratación\", \"seg\": 77}, {\"id\": \"DkfIFDkS7Ec\", \"titulo\": \"Variables que se utilizan para la parametrización de contratos\", \"grupo\": \"Contratación\", \"seg\": 50}, {\"id\": \"o8rWIdft6rw\", \"titulo\": \"Cargar presupuesto inicial\", \"grupo\": \"Presupuesto\", \"seg\": 151}, {\"id\": \"QQw5XAE-1Cc\", \"titulo\": \"Como realizar un traslado presupuestal\", \"grupo\": \"Presupuesto\", \"seg\": 83}, {\"id\": \"6gmpi-XJ2J4\", \"titulo\": \"Crear un certificado de disponibilidad presupuestal\", \"grupo\": \"Presupuesto\", \"seg\": 105}, {\"id\": \"qfQHzm4iqhE\", \"titulo\": \"Homologacion presupuestal para informes cuipo, sia, siho\", \"grupo\": \"Presupuesto\", \"seg\": 98}, {\"id\": \"SZqz0L2X5KU\", \"titulo\": \"Liberación de saldos no ejecutados en registro presupuestal y disponibilidad\", \"grupo\": \"Presupuesto\", \"seg\": 86}, {\"id\": \"l63oDkbBwAU\", \"titulo\": \"Realizar una adición presupuestal\", \"grupo\": \"Presupuesto\", \"seg\": 76}, {\"id\": \"QR2QzlMY0r4\", \"titulo\": \"¿Cómo crear un rubro presupuestal?\", \"grupo\": \"Presupuesto\", \"seg\": 54}, {\"id\": \"9NLpw2fN7w0\", \"titulo\": \"Bases y tarifa de aplicación de impuestos y retenciones en el módulo de contabilidad\", \"grupo\": \"Contabilidad\", \"seg\": 80}, {\"id\": \"ti2Fu9lhMtk\", \"titulo\": \"Causación de cuentas por pagar\", \"grupo\": \"Contabilidad\", \"seg\": 205}, {\"id\": \"4cTMisLJLKw\", \"titulo\": \"Causación de cuentas por pagar\", \"grupo\": \"Contabilidad\", \"seg\": 255}, {\"id\": \"BpxNqsrkR9o\", \"titulo\": \"Cofiguracion de cuentas para traslado de costos\", \"grupo\": \"Contabilidad\", \"seg\": 92}, {\"id\": \"ThecTtvEYfA\", \"titulo\": \"Contabilidad libros auxiliares\", \"grupo\": \"Contabilidad\", \"seg\": 48}, {\"id\": \"lwPrsI1Uqf0\", \"titulo\": \"Crear centro de costo\", \"grupo\": \"Contabilidad\", \"seg\": 49}, {\"id\": \"FwI7P6KsMM8\", \"titulo\": \"Crear cuentas contables\", \"grupo\": \"Contabilidad\", \"seg\": 67}, {\"id\": \"BWcxE3C0Wrg\", \"titulo\": \"Emisión de documento soporte a la Dian\", \"grupo\": \"Contabilidad\", \"seg\": 44}, {\"id\": \"SvZp2u5sz2k\", \"titulo\": \"Homologacion para información exogena\", \"grupo\": \"Contabilidad\", \"seg\": 181}, {\"id\": \"kAVKiZ1ma6Y\", \"titulo\": \"Registro de costos de almacen y farmacia\", \"grupo\": \"Contabilidad\", \"seg\": 42}, {\"id\": \"QpoIqgzna7U\", \"titulo\": \"Registros contables\", \"grupo\": \"Contabilidad\", \"seg\": 73}, {\"id\": \"dxl6X9p0Luo\", \"titulo\": \"Traslado de costos cuenta 7 a la 6\", \"grupo\": \"Contabilidad\", \"seg\": 72}, {\"id\": \"7mGgh2_VhHQ\", \"titulo\": \"Configura cuenta de bancos en tesorería\", \"grupo\": \"Tesorería\", \"seg\": 40}, {\"id\": \"zfX0WFK3yLA\", \"titulo\": \"Pagos sin afectación presupuestal\", \"grupo\": \"Tesorería\", \"seg\": 112}, {\"id\": \"fz3sVc2EZFM\", \"titulo\": \"Proceso de conciliación bancaria\", \"grupo\": \"Tesorería\", \"seg\": 59}, {\"id\": \"MvPu8LZX6Hw\", \"titulo\": \"Realizar pagos en el sistema Cronhis Financiero\", \"grupo\": \"Tesorería\", \"seg\": 93}, {\"id\": \"XJUbfmxEbIA\", \"titulo\": \"Recaudo de recursos de venta de servicios de salud en el módulo de tesorería\", \"grupo\": \"Tesorería\", \"seg\": 117}, {\"id\": \"vVognZMSM9Y\", \"titulo\": \"Recibo de caja - recaudo de cuotas moderadoras, copagos y ventas particulares\", \"grupo\": \"Tesorería\", \"seg\": 85}, {\"id\": \"A8lPCeeZEM0\", \"titulo\": \"Reconocimiento, causación y recaudo de otros ingresos diferentes a venta de servicios de salud\", \"grupo\": \"Tesorería\", \"seg\": 175}, {\"id\": \"ZH3OjTli50w\", \"titulo\": \"Registro de pagos de caja menor\", \"grupo\": \"Tesorería\", \"seg\": 64}, {\"id\": \"R63A495Ekq0\", \"titulo\": \"Afectación presupuestal, contable y tesorería de una nómina\", \"grupo\": \"Nómina\", \"seg\": 71}, {\"id\": \"maq0EJeW3v8\", \"titulo\": \"Configuración de fondos de seguridad social, libranzas, embargos y sindicatos\", \"grupo\": \"Nómina\", \"seg\": 82}, {\"id\": \"o5FNycdj91I\", \"titulo\": \"Crear empleados en el módulo de nómina del sistema Cronhis Financiero\", \"grupo\": \"Nómina\", \"seg\": 256}, {\"id\": \"eXoyYnMjVH8\", \"titulo\": \"Parametrización de cuentas contables en el módulo de nómina\", \"grupo\": \"Nómina\", \"seg\": 65}, {\"id\": \"9s2dEdZMfQc\", \"titulo\": \"Configuración de cuenta del inventario\", \"grupo\": \"Almacén y activos\", \"seg\": 31}, {\"id\": \"8nO2TMXQ3QM\", \"titulo\": \"Configurar cuentas del gasto por consumo de artículos de almacen\", \"grupo\": \"Almacén y activos\", \"seg\": 71}, {\"id\": \"M2Lp9eBms-Q\", \"titulo\": \"Parametrización de cuentas contables\", \"grupo\": \"Almacén y activos\", \"seg\": 44}]}";

async function main() {
  const curso = await prisma.course.findUniqueOrThrow({ where: { slug: SLUG_CURSO }, select: { id: true } });

  let modulo = await prisma.courseModule.findFirst({ where: { courseId: curso.id, title: TITULO_MODULO }, select: { id: true } });
  if (!modulo) {
    const max = await prisma.courseModule.aggregate({ where: { courseId: curso.id }, _max: { sortOrder: true } });
    modulo = await prisma.courseModule.create({
      data: {
        courseId: curso.id,
        title: TITULO_MODULO,
        description: "Videoteca del sistema financiero Cronhis: 44 videotutoriales del proveedor, embebidos y agrupados por tema en una sola pantalla.",
        isRequired: false,
        audience: "ADMINISTRATIVO",
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
      select: { id: true },
    });
    console.log("módulo creado:", TITULO_MODULO);
  } else {
    console.log("módulo ya existía");
  }

  const ya = await prisma.lesson.findFirst({ where: { moduleId: modulo.id, title: TITULO_LECCION }, select: { id: true } });
  if (ya) {
    // Refrescar el contenido (por si cambió la lista de videos).
    await prisma.lesson.update({ where: { id: ya.id }, data: { contentBody: CONTENIDO } });
    console.log("lección ya existía: contenido refrescado");
  } else {
    const max = await prisma.lesson.aggregate({ where: { moduleId: modulo.id }, _max: { sortOrder: true } });
    await prisma.lesson.create({
      data: {
        moduleId: modulo.id,
        title: TITULO_LECCION,
        description:
          "Todos los videotutoriales del sistema Cronhis Financiero en una sola pantalla, agrupados por tema (contratación, presupuesto, contabilidad, tesorería, nómina y almacén). Elige un título de la lista y se reproduce arriba.",
        contentType: "YOUTUBE",
        contentBody: CONTENIDO,
        videoUrl: "https://www.youtube.com/watch?v=feu_BrXC6mI",
        estimatedMinutes: 72,
        isRequired: false,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });
    console.log("lección creada:", TITULO_LECCION);
  }
  console.log("listo · 44 videos · 72 min");
}

main().finally(() => prisma.$disconnect());
