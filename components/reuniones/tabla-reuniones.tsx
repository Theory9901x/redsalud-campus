"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EliminarReunion, ReprogramarSesion } from "@/components/reuniones/formularios";
import { eliminarReunionAction, reprogramarSesionAction } from "@/app/admin/reuniones/actions";

type Fila = {
  id: string; titulo: string; responsable: string; creador: string;
  fecha: string; fechaOrden: string; sesiones: number; abiertas: number;
  registrados: number; actas: number;
  sesionUnica: { id: string; fecha: string; inicio: string; fin: string } | null;
};

export function TablaReuniones({ reuniones, basePath, puedeGestionar = false }: { reuniones: Fila[]; basePath: string; puedeGestionar?: boolean }) {
  const [busqueda, setBusqueda] = useState("");
  const [orden, setOrden] = useState("fecha");
  const [pagina, setPagina] = useState(1);
  const normalizar = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const filas = reuniones.filter((r) => normalizar(`${r.titulo} ${r.responsable} ${r.creador}`).includes(normalizar(busqueda.trim())))
    .sort((a, b) => orden === "titulo" ? a.titulo.localeCompare(b.titulo, "es") : b.fechaOrden.localeCompare(a.fechaOrden));
  const paginas = Math.max(1, Math.ceil(filas.length / 20));
  const actual = Math.min(pagina, paginas);
  const visibles = filas.slice((actual - 1) * 20, actual * 20);
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card font-sans">
      <div className="flex flex-wrap items-end gap-4 border-b p-5">
        <div className="min-w-48 flex-1 space-y-2">
          <label htmlFor="buscar-reuniones" className="text-base font-semibold">Buscar reuniones</label>
          <Input id="buscar-reuniones" placeholder="Nombre, responsable o creador" value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }} className="h-11 text-base" />
        </div>
        <div className="space-y-2">
          <label htmlFor="orden-reuniones" className="block text-base font-semibold">Ordenar por</label>
          <select id="orden-reuniones" value={orden} onChange={(e) => { setOrden(e.target.value); setPagina(1); }} className="h-11 rounded-md border border-input bg-background px-3 text-base">
            <option value="fecha">Fecha más reciente</option><option value="titulo">Nombre A–Z</option>
          </select>
        </div>
      </div>
      <Table className="text-base">
        <TableHeader><TableRow>
          {["Reunión", "Creada por", "Responsable", "Fecha", "Sesiones", "Abiertas", "Asistentes", "Actas firmadas", "Administrar"].map((t) => <TableHead key={t} className="px-4 py-4 font-sans text-sm font-semibold normal-case tracking-normal">{t}</TableHead>)}
        </TableRow></TableHeader>
        <TableBody>
          {visibles.map((r) => <TableRow key={r.id}>
            <TableCell className="min-w-60 whitespace-normal px-4 py-4 font-semibold"><Link className="text-primary hover:underline" href={`${basePath}/${r.id}`}>{r.titulo}</Link></TableCell>
            <TableCell className="whitespace-normal px-4">{r.creador}</TableCell>
            <TableCell className="whitespace-normal px-4">{r.responsable}</TableCell>
            <TableCell className="px-4">{r.fecha}</TableCell>
            <TableCell className="px-4 tabular-nums">{r.sesiones}</TableCell>
            <TableCell className="px-4 tabular-nums">{r.abiertas}</TableCell>
            <TableCell className="px-4 tabular-nums">{r.registrados}</TableCell>
            <TableCell className="px-4 tabular-nums">{r.actas}/{r.sesiones}</TableCell>
            <TableCell className="px-4"><div className="flex flex-wrap items-center gap-2"><Link href={`${basePath}/${r.id}`} className="inline-flex min-h-10 items-center rounded-lg border border-border px-3 font-semibold hover:bg-muted">Abrir</Link>{puedeGestionar && r.sesionUnica && <ReprogramarSesion action={reprogramarSesionAction.bind(null, r.id, r.sesionUnica.id)} fecha={r.sesionUnica.fecha} inicio={r.sesionUnica.inicio} fin={r.sesionUnica.fin} className="min-h-10" />}{puedeGestionar && <EliminarReunion action={eliminarReunionAction.bind(null, r.id)} titulo={r.titulo} />}</div></TableCell>
          </TableRow>)}
          {!visibles.length && <TableRow><TableCell colSpan={9} className="py-10 text-center text-muted-foreground">No hay reuniones que coincidan con la búsqueda.</TableCell></TableRow>}
        </TableBody>
      </Table>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4 text-sm">
        <p aria-live="polite">{filas.length} reuniones · Página {actual} de {paginas}</p>
        <div className="flex gap-2">
          <Button variant="outline" disabled={actual === 1} onClick={() => setPagina(actual - 1)}>Anterior</Button>
          <Button variant="outline" disabled={actual === paginas} onClick={() => setPagina(actual + 1)}>Siguiente</Button>
        </div>
      </div>
    </section>
  );
}
