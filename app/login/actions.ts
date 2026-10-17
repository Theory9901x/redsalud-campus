"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export type LoginState = {
  error: string | null;
  /**
   * Destino que debe abrirse con navegación COMPLETA del navegador: los
   * enlaces de capacitación (/c/...) son rutas que redirigen (QR de cada
   * jornada); seguirlas con la navegación interna dejaba la barra de
   * direcciones en /c/... y la evaluación no podía enviarse.
   */
  irA?: string;
};

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");
  const callbackUrl = formData.get("callbackUrl");

  const destino = typeof callbackUrl === "string" && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : null;
  try {
    if (destino && /^\/(c|api)\//.test(destino)) {
      await signIn("credentials", { email, password, redirect: false });
      return { error: null, irA: destino };
    }
    await signIn("credentials", {
      email,
      password,
      redirectTo: typeof callbackUrl === "string" && callbackUrl ? callbackUrl : "/",
    });
    return { error: null };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Correo o contraseña incorrectos." };
    }
    // Los redirects de Auth.js se implementan lanzando un error especial: debe propagarse.
    throw error;
  }
}
