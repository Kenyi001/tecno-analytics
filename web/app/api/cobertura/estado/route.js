import { NextResponse } from "next/server";
import { resumenCobertura } from "../../../../lib/blob";
import { estadoCobertura } from "../../../../lib/github";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  const desde = Number(new URL(request.url).searchParams.get("desde") || 0);
  let resumen;
  try {
    resumen = await resumenCobertura();
  } catch {
    return NextResponse.json({ estado: "actualizando", avance: 12, frase: "Buscando la actualización." });
  }
  const subido = resumen.generado ? new Date(resumen.generado).getTime() : 0;
  if (subido && subido >= desde - 10000) {
    return NextResponse.json({ estado: "listo", avance: 100, frase: "Listo." });
  }
  const trabajo = await estadoCobertura(desde);
  if (trabajo.estado === "termino") {
    // El workflow terminó; a veces el Blob tarda un instante en verse.
    if (subido && subido >= desde - 60000) {
      return NextResponse.json({ estado: "listo", avance: 100, frase: "Listo." });
    }
    return NextResponse.json({
      estado: "actualizando",
      avance: 96,
      frase: "Guardando los números nuevos.",
    });
  }
  if (trabajo.estado === "fallo") {
    return NextResponse.json({ estado: "fallo", aviso: trabajo.aviso });
  }
  return NextResponse.json({
    estado: "actualizando",
    avance: trabajo.avance || 12,
    frase: trabajo.frase || "Trabajando en la actualización.",
  });
}
