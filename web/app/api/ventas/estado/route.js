import { NextResponse } from "next/server";
import { resumenVentas } from "../../../../lib/blob";
import { estadoTrabajo } from "../../../../lib/github";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  const desde = Number(new URL(request.url).searchParams.get("desde") || 0);
  let resumen;
  try {
    resumen = await resumenVentas();
  } catch {
    return NextResponse.json({ estado: "actualizando" });
  }
  const subido = resumen.hoy ? new Date(resumen.hoy.subido).getTime() : 0;
  if (subido && subido >= desde - 10000) {
    return NextResponse.json({ estado: "listo" });
  }
  const trabajo = await estadoTrabajo(desde);
  if (trabajo.estado === "termino") return NextResponse.json({ estado: "listo" });
  if (trabajo.estado === "fallo") {
    return NextResponse.json({ estado: "fallo", aviso: trabajo.aviso });
  }
  return NextResponse.json({ estado: "actualizando" });
}
