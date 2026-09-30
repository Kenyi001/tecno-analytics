import { NextResponse } from "next/server";
import { bajar } from "../../../../lib/blob";
import { rutaDelDia } from "../../../../lib/ciclo";
import { leerHoja } from "../../../../lib/libro";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  const url = new URL(request.url);
  const ruta = rutaDelDia(url.searchParams.get("dia") || "");
  if (!ruta) return NextResponse.json({ error: "Día no permitido" }, { status: 400 });
  const bytes = await bajar(ruta.xlsx);
  if (!bytes) return NextResponse.json({ error: "Todavía no está ese archivo" }, { status: 404 });
  try {
    return NextResponse.json(await leerHoja(bytes, url.searchParams.get("hoja") || ""));
  } catch {
    return NextResponse.json({ error: "No se pudo abrir esa hoja" }, { status: 500 });
  }
}
