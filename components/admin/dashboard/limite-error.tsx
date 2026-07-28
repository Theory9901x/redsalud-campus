"use client";

import { Component } from "react";
import type { ReactNode } from "react";
import { ErrorWidget } from "@/components/admin/dashboard/estados";

/**
 * Límite de error por widget.
 *
 * `error.tsx` de Next.js cubre el segmento entero: si una sola consulta
 * revienta, se lleva el panel completo y el administrador se queda sin los
 * otros siete datos, que eran correctos. Este límite acota el fallo al widget
 * que lo produjo.
 *
 * Tiene que ser un componente de clase: React no expone `componentDidCatch`
 * como hook, así que no hay versión de función de esto.
 */
export class LimiteError extends Component<{ children: ReactNode }, { fallo: boolean }> {
  state = { fallo: false };

  static getDerivedStateFromError() {
    return { fallo: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Widget del panel falló:", error);
  }

  render() {
    if (this.state.fallo) {
      return <ErrorWidget reintentar={() => this.setState({ fallo: false })} />;
    }
    return this.props.children;
  }
}
