import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { gestionaGalardones } from "@/lib/galardones/acceso";
import { ganadoresGalardones } from "@/lib/galardones/consultas";

export const dynamic = "force-dynamic";

/**
 * Ganadores por centro AHORA MISMO, para la ceremonia en vivo. Es un GET a
 * propósito: la ceremonia lo consultaba con una acción de servidor (POST) y
 * el proxy rechaza todo POST de los perfiles de solo lectura, así que a esas
 * cuentas la pantalla se les quedaba con los datos de cuando la abrieron.
 */
export async function GET() {
  const sesion = await auth();
  const u = sesion?.user;
  if (!(await gestionaGalardones(u))) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  return NextResponse.json(await ganadoresGalardones(), { headers: { "Cache-Control": "no-store" } });
}
