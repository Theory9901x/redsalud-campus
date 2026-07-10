"use client";

import { useState } from "react";
import { FileDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const SECTION_OPTIONS = [
  { value: "cronograma", label: "Cronograma y adherencia por actividad" },
  { value: "documentos", label: "Documentos asociados" },
  { value: "encuestas", label: "Encuestas" },
  { value: "noAdherentes", label: "Personal no adherente (jornadas cerradas)" },
] as const;

export function PlanReportExportDialog({ planId }: { planId: string }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set(SECTION_OPTIONS.map((o) => o.value)));

  function toggle(value: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  const href = `/api/planes-capacitacion/${planId}/informe?secciones=${[...selected].join(",")}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" className="gap-1.5" />}>
        <FileDown className="h-4 w-4" />
        Exportar informe
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar informe del plan</DialogTitle>
          <DialogDescription>Elige qué secciones incluir en el PDF. El resumen y el cumplimiento siempre se incluyen.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {SECTION_OPTIONS.map((option) => (
            <div key={option.value} className="flex items-center gap-2.5">
              <Checkbox
                id={`section-${option.value}`}
                checked={selected.has(option.value)}
                onCheckedChange={() => toggle(option.value)}
              />
              <Label htmlFor={`section-${option.value}`} className="font-normal">
                {option.label}
              </Label>
            </div>
          ))}
        </div>

        <DialogFooter>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <Download className="h-4 w-4" />
            Descargar informe
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
