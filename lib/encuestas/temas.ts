/** Temas de las sugerencias (P9), por palabras clave. Compartido por el centro de datos y el PDF. */
export const TEMAS_SUGERENCIAS: { tema: string; claves: RegExp }[] = [
  { tema: "Trato y amabilidad", claves: /amab|trato|respet|grosero|mal genio|atenci[oó]n/i },
  { tema: "Oportunidad y esperas", claves: /esper|demora|cita|turno|ficha|tiempo|tard|fila|agenda/i },
  { tema: "Instalaciones y aseo", claves: /limpi|aseo|baño|instalac|silla|comod|infraestruct/i },
  { tema: "Información y comunicación", claves: /inform|explic|comunic|duda|claridad/i },
  { tema: "Medicamentos y farmacia", claves: /medicament|farmacia|droga|f[oó]rmula/i },
  { tema: "Personal insuficiente", claves: /m[aá]s m[eé]dic|m[aá]s personal|falta.*(m[eé]dic|enfermer)|un solo/i },
];
