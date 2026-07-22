"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      // Sin `sticky`: el contenedor de la tabla usa overflow-x-auto, que hace
      // que overflow-y compute a auto y se vuelva contenedor de scroll; un
      // thead sticky ahí se ancla a un contenedor que nunca scrollea por
      // dentro y se mueve con la página. Sería CSS muerto.
      className={cn(
        "bg-slate-100 [&_tr]:border-b-2 [&_tr]:border-b-slate-300 dark:bg-slate-800 dark:[&_tr]:border-b-slate-600",
        className
      )}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn(
        "[&_tr:last-child]:border-0",
        // Ritmo visual de fila: zebra bien marcada + hover notorio con acento
        // de marca lateral, aplicado solo al cuerpo (no al encabezado) porque
        // TableRow es el mismo primitivo para ambos. Colores planos de la
        // paleta gris (no el --border/--muted del tema, casi invisibles
        // sobre blanco) para que las líneas y el zebrado sean inequívocos.
        "[&_tr:nth-child(odd)]:bg-card [&_tr:nth-child(even)]:bg-slate-100 [&_tr]:transition-[background-color,box-shadow] [&_tr]:duration-200 [&_tr:hover]:bg-primary/10 [&_tr:hover]:shadow-[inset_3px_0_0_0_var(--primary)] dark:[&_tr:nth-child(even)]:bg-slate-800/60",
        className
      )}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t-2 border-t-slate-300 bg-slate-100 font-medium [&>tr]:last:border-b-0 dark:border-t-slate-600 dark:bg-slate-800",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b border-slate-300 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted dark:border-slate-700",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-11 px-3 text-left align-middle text-[11px] font-semibold tracking-wide whitespace-nowrap text-slate-600 uppercase [&:has([role=checkbox])]:pr-0 dark:text-slate-300",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-3 py-3 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
