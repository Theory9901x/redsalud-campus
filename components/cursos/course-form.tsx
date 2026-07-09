"use client";

import { useActionState, useState } from "react";
import { FileText, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { slugify } from "@/lib/slug";
import { COURSE_TYPE_LABELS, ENROLLMENT_MODE_LABELS, COURSE_AUDIENCE_LABELS } from "@/components/cursos/labels";
import type { CourseType, EnrollmentMode, CourseAudience, Role } from "@prisma/client";

export type CourseFormState = { error: string | null };

type CourseFormValues = {
  title: string;
  slug: string;
  shortDescription: string;
  fullDescription: string;
  categoryId: string;
  courseType: CourseType;
  durationHours: number;
  passingScore: number;
  enrollmentMode: EnrollmentMode;
  targetAudience: CourseAudience;
  isSequential: boolean;
  tutorId: string;
};

const EMPTY_VALUES: CourseFormValues = {
  title: "",
  slug: "",
  shortDescription: "",
  fullDescription: "",
  categoryId: "",
  courseType: "CAPACITACION",
  durationHours: 1,
  passingScore: 80,
  enrollmentMode: "OPEN",
  targetAudience: "AMBOS",
  isSequential: true,
  tutorId: "",
};

const initialState: CourseFormState = { error: null };

export function CourseForm({
  mode,
  action,
  defaultValues,
  categories,
  tutors,
  isAdmin,
  submitLabel,
}: {
  mode: "create" | "edit";
  action: (prevState: CourseFormState, formData: FormData) => Promise<CourseFormState>;
  defaultValues?: Partial<CourseFormValues>;
  categories: { id: string; name: string }[];
  tutors: { id: string; fullName: string; role: Role }[];
  isAdmin: boolean;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const values = { ...EMPTY_VALUES, ...defaultValues };

  const [title, setTitle] = useState(values.title);
  const [slug, setSlug] = useState(values.slug);
  const [slugTouched, setSlugTouched] = useState(mode === "edit");

  return (
    <form action={formAction} className="space-y-6">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <FileText className="h-4 w-4 text-primary" />
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
          Información general
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="title">Título del curso</Label>
          <Input
            id="title"
            name="title"
            required
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
          />
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="slug">Slug (URL pública)</Label>
          <Input
            id="slug"
            name="slug"
            required
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
          />
          <p className="text-xs text-muted-foreground">/cursos/{slug || "..."}</p>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="shortDescription">Descripción corta</Label>
          <Textarea
            id="shortDescription"
            name="shortDescription"
            required
            rows={2}
            defaultValue={values.shortDescription}
          />
          <p className="text-xs text-muted-foreground">Aparece en la tarjeta del catálogo público.</p>
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="fullDescription">Descripción completa</Label>
          <Textarea id="fullDescription" name="fullDescription" rows={5} defaultValue={values.fullDescription} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="categoryId">Categoría</Label>
          <select
            id="categoryId"
            name="categoryId"
            defaultValue={values.categoryId}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Sin categoría</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="courseType">Tipo de curso</Label>
          <select
            id="courseType"
            name="courseType"
            defaultValue={values.courseType}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            {Object.entries(COURSE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 border-b border-border pb-3 pt-2 sm:col-span-2">
          <Settings2 className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
            Configuración del curso
          </h2>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="durationHours">Intensidad horaria</Label>
          <Input
            id="durationHours"
            name="durationHours"
            type="number"
            min={1}
            required
            defaultValue={values.durationHours}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="passingScore">Puntaje mínimo (%)</Label>
          <Input
            id="passingScore"
            name="passingScore"
            type="number"
            min={1}
            max={100}
            required
            defaultValue={values.passingScore}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="enrollmentMode">Modalidad de inscripción</Label>
          <select
            id="enrollmentMode"
            name="enrollmentMode"
            defaultValue={values.enrollmentMode}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            {Object.entries(ENROLLMENT_MODE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="targetAudience">Dirigido a</Label>
          <select
            id="targetAudience"
            name="targetAudience"
            required
            defaultValue={values.targetAudience}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          >
            {Object.entries(COURSE_AUDIENCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Solo el personal de este tipo verá el curso en su catálogo (o todos, si eliges &quot;Todo el personal&quot;).
          </p>
        </div>

        {isAdmin && (
          <div className="space-y-1.5">
            <Label htmlFor="tutorId">Tutor a cargo</Label>
            <select
              id="tutorId"
              name="tutorId"
              required
              defaultValue={values.tutorId}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Selecciona un tutor</option>
              {tutors.map((tutor) => (
                <option key={tutor.id} value={tutor.id}>
                  {tutor.fullName} {tutor.role === "ADMIN" ? "(Admin)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center gap-3 sm:col-span-2">
          <Switch id="isSequential" name="isSequential" defaultChecked={values.isSequential} />
          <Label htmlFor="isSequential" className="font-normal">
            Módulos secuenciales (el estudiante debe completarlos en orden)
          </Label>
        </div>
      </div>

      {state.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.error}</p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Guardando..." : submitLabel}
      </Button>
    </form>
  );
}
