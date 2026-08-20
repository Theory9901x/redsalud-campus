"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PERSONNEL_TYPE_LABELS } from "@/lib/personnel-labels";
import { VINCULACION_LABELS } from "@/components/admin/marca-planta";
import {
  assignEnrollmentsByFilterAction,
  countStudentsMatchingAction,
  type StudentFilters,
} from "@/app/admin/inscripciones/actions";
import type { PersonnelType, TipoVinculacion } from "@prisma/client";

type CourseOption = { id: string; title: string };
type MunicipioOption = { id: string; nombre: string };

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

/**
 * Asignación por audiencia, no por padrón: el admin describe A QUIÉN va el
 * curso (municipio, tipo de vinculación, tipo de personal, o una búsqueda
 * puntual) y el servidor resuelve cuántos y quiénes son sin que esa lista
 * pase nunca por el navegador. Antes este panel traía las 288 cuentas activas
 * al cliente para pintar un checklist -era el propio peso de esa lista lo que
 * ralentizaba la página, no la base de datos.
 */
export function AssignEnrollmentByFilterForm({
  courses,
  municipios,
}: {
  courses: CourseOption[];
  municipios: MunicipioOption[];
}) {
  const [courseId, setCourseId] = useState("");
  const [municipioId, setMunicipioId] = useState("");
  const [tipoVinculacion, setTipoVinculacion] = useState<TipoVinculacion | "">("");
  const [personnelType, setPersonnelType] = useState<PersonnelType | "">("");
  const [q, setQ] = useState("");

  const [count, setCount] = useState<number | null>(null);
  const [contando, startCountTransition] = useTransition();
  const [asignando, startAssignTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const filters: StudentFilters = {
    municipioId: municipioId || undefined,
    tipoVinculacion: tipoVinculacion || undefined,
    personnelType: personnelType || undefined,
    q: q.trim() || undefined,
  };

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      startCountTransition(async () => {
        setCount(await countStudentsMatchingAction(filters));
      });
    }, 250);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [municipioId, tipoVinculacion, personnelType, q]);

  const municipioNombre = municipios.find((m) => m.id === municipioId)?.nombre;
  const descripcionFiltro =
    [municipioNombre, tipoVinculacion && VINCULACION_LABELS[tipoVinculacion], personnelType && PERSONNEL_TYPE_LABELS[personnelType], q.trim() && `busqueda "${q.trim()}"`]
      .filter(Boolean)
      .join(" · ") || "todo el personal activo";

  function confirmar() {
    startAssignTransition(async () => {
      const res = await assignEnrollmentsByFilterAction(courseId, filters, descripcionFiltro);
      if (res.error) toast.error(res.error);
      else toast.success(`${res.assignedCount} ${res.assignedCount === 1 ? "persona quedó inscrita" : "personas quedaron inscritas"}.`);
    });
  }

  const cursoElegido = courses.find((c) => c.id === courseId);
  const puedeAsignar = !!courseId && count !== null && count > 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <label htmlFor="courseId" className="text-sm font-medium text-foreground">
            Curso
          </label>
          <select id="courseId" value={courseId} onChange={(e) => setCourseId(e.target.value)} className={selectClass}>
            <option value="">Selecciona un curso</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="municipioId" className="text-sm font-medium text-foreground">
            Municipio
          </label>
          <select id="municipioId" value={municipioId} onChange={(e) => setMunicipioId(e.target.value)} className={selectClass}>
            <option value="">Todos</option>
            {municipios.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="tipoVinculacion" className="text-sm font-medium text-foreground">
            Tipo de vinculación
          </label>
          <select
            id="tipoVinculacion"
            value={tipoVinculacion}
            onChange={(e) => setTipoVinculacion(e.target.value as TipoVinculacion | "")}
            className={selectClass}
          >
            <option value="">Todos</option>
            {Object.entries(VINCULACION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="personnelType" className="text-sm font-medium text-foreground">
            Tipo de personal
          </label>
          <select
            id="personnelType"
            value={personnelType}
            onChange={(e) => setPersonnelType(e.target.value as PersonnelType | "")}
            className={selectClass}
          >
            <option value="">Todos</option>
            {Object.entries(PERSONNEL_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="q" className="text-sm font-medium text-foreground">
          Acotar por nombre, cédula o correo <span className="font-normal text-muted-foreground">(opcional, para inscribir a una persona puntual)</span>
        </label>
        <Input id="q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Dejar vacío para no acotar..." className="max-w-md" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
        <p className="text-sm text-muted-foreground">
          {contando ? (
            "Contando coincidencias..."
          ) : count === null ? (
            "—"
          ) : (
            <>
              Este filtro alcanza a <span className="font-semibold text-foreground">{count}</span>{" "}
              {count === 1 ? "persona activa" : "personas activas"}
              {municipioNombre || tipoVinculacion || personnelType || q.trim() ? "" : " (todo el personal)"}.
            </>
          )}
        </p>

        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button type="button" disabled={!puedeAsignar || asignando}>
                <UserPlus className="h-4 w-4" />
                {asignando ? "Asignando..." : "Asignar al curso"}
              </Button>
            }
          />
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                ¿Inscribir a {count} {count === 1 ? "persona" : "personas"} en «{cursoElegido?.title}»?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Filtro: {descripcionFiltro}. Quien ya tenga una inscripción activa o completada en este curso no se
                duplica; quien la tenga cancelada, se reactiva.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmar}>Confirmar inscripción</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
