"use client";

import { useActionState, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { assignEnrollmentsAction, type AssignEnrollmentState } from "@/app/admin/inscripciones/actions";

const initialState: AssignEnrollmentState = { error: null };

type Student = { id: string; fullName: string; documentNumber: string; email: string };
type CourseOption = { id: string; title: string };

export function AssignEnrollmentForm({ courses, students }: { courses: CourseOption[]; students: Student[] }) {
  const [state, formAction, pending] = useActionState(assignEnrollmentsAction, initialState);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        s.documentNumber.includes(q) ||
        s.email.toLowerCase().includes(q)
    );
  }, [search, students]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="courseId" className="text-sm font-medium text-foreground">
          Curso
        </label>
        <select
          id="courseId"
          name="courseId"
          required
          className="h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Selecciona un curso</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          Estudiantes ({selected.size} seleccionados)
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, cédula o correo..."
            className="pl-9"
          />
        </div>
        <div className="max-h-64 overflow-y-auto rounded-lg border border-border">
          {filteredStudents.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">Sin resultados.</p>
          )}
          {filteredStudents.map((student) => (
            <label
              key={student.id}
              className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0 hover:bg-muted/50"
            >
              <input
                type="checkbox"
                name="studentIds"
                value={student.id}
                checked={selected.has(student.id)}
                onChange={() => toggle(student.id)}
                className="h-4 w-4 rounded border-input"
              />
              <span className="flex-1">
                <span className="font-medium text-foreground">{student.fullName}</span>{" "}
                <span className="text-muted-foreground">· {student.documentNumber}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}
      {state.success && (
        <p className="rounded-md bg-success/10 px-3 py-2 text-sm text-success">Estudiantes asignados correctamente.</p>
      )}

      <Button type="submit" disabled={pending || selected.size === 0}>
        {pending ? "Asignando..." : "Asignar al curso"}
      </Button>
    </form>
  );
}
