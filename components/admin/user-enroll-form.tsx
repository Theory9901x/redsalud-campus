"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { assignEnrollmentsAction, type AssignEnrollmentState } from "@/app/admin/inscripciones/actions";

const initialState: AssignEnrollmentState = { error: null };

export function UserEnrollForm({
  userId,
  courses,
}: {
  userId: string;
  courses: { id: string; title: string }[];
}) {
  const [state, formAction, pending] = useActionState(assignEnrollmentsAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="studentIds" value={userId} />
      <div className="min-w-[220px] flex-1 space-y-1.5">
        <label htmlFor="courseId" className="text-xs font-medium text-muted-foreground">
          Inscribir en un curso nuevo
        </label>
        <select
          id="courseId"
          name="courseId"
          required
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Selecciona un curso</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </select>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Inscribiendo..." : "Inscribir"}
      </Button>
      {state.error && <p className="w-full text-xs text-destructive">{state.error}</p>}
    </form>
  );
}
