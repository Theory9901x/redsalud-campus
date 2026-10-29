import type { SesionReunion } from "@/lib/reuniones";

export function VistaPreviaActa({ sesion: d }: { sesion: SesionReunion }) {
  const bloques = [
    ["Objetivo", d.objetivo || "Sin objetivo registrado."],
    ["Orden del día", d.reunion.ordenDelDia.map((p, i) => `${i + 1}. ${p.replace(/^\d+[.)]\s*/, "")}`).join("\n") || "Sin puntos registrados."],
    ["Desarrollo de la sesión", d.desarrollo || "Sin desarrollo registrado."],
    ["Compromisos y acuerdos", d.compromisos.map((c, i) => `${i + 1}. ${c}`).join("\n") || "Sin compromisos registrados."],
  ];
  return <details className="rounded-xl border bg-card p-5">
    <summary className="cursor-pointer text-base font-semibold">Revisar estructura y contenido guardado del acta</summary>
    <div className="mt-5 space-y-5 text-base">
      <header className="border-b pb-4"><p className="text-sm font-semibold text-primary">Acta de reunión · {d.estado === "CLOSED" ? "Sesión cerrada" : "Borrador de sesión abierta"}</p><h3 className="mt-1 text-xl font-semibold">{d.reunion.titulo}</h3><p className="mt-1 text-muted-foreground">{d.titulo}</p><p className="mt-2">Responsable: {d.responsable}</p></header>
      {bloques.map(([titulo, texto], i) => <section key={titulo}><h4 className="mb-2 font-semibold">{i + 2}. {titulo}</h4><p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">{texto}</p></section>)}
      <section><h4 className="mb-2 font-semibold">6. Documentos y evidencias</h4>{d.documentos.length ? <ul className="list-inside list-disc space-y-1 text-muted-foreground">{d.documentos.map(doc => <li key={doc.id}>{doc.fileName}{doc.description ? ` · ${doc.description}` : ""}</li>)}</ul> : <p className="text-muted-foreground">Sin documentos registrados.</p>}</section>
      <section><h4 className="mb-2 font-semibold">7. Resumen y anexo de asistencia</h4><p className="text-muted-foreground">{d.asistentes.length} personas con ingreso real a la sala. El PDF incluye la tabla completa con nombre, cargo, ingreso, salida, permanencia y número de ingresos.</p></section>
      <section><h4 className="mb-2 font-semibold">8. Revisión y firmas</h4><p className="text-muted-foreground">Espacios para el responsable de la reunión y quien elabora o revisa el acta. El archivo firmado se adjunta a esta sesión.</p></section>
      <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Esta vista y el PDF usan la información guardada. Guarda los cambios del formulario antes de descargar.</p>
    </div>
  </details>;
}
