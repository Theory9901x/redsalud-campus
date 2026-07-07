"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { enrollInCourseAction, type EnrollState } from "@/app/cursos/[slug]/actions";

const initialState: EnrollState = { error: null };

export function EnrollButton({ courseId, slug }: { courseId: string; slug: string }) {
  const [state, formAction, pending] = useActionState(
    enrollInCourseAction.bind(null, courseId, slug),
    initialState
  );

  return (
    <form action={formAction} className="space-y-2">
      <Button
        type="submit"
        disabled={pending}
        className="w-full gap-1.5 bg-gradient-to-r from-primary to-teal-400 text-white hover:opacity-90"
      >
        {pending ? "Inscribiendo..." : "Inscribirme"}
      </Button>
      {state.error && <p className="text-center text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
