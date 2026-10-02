import { NextResponse } from "next/server";
import { libroCobertura } from "../../../../lib/blob";
import { leerHoja } from "../../../../lib/libro";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request) {
  const bytes = await libroCobertura();
  if (!bytes) return NextResponse.json({ error: "Todavía no está el Excel de cobertura." }, { status: 404 });
  try {
    const hoja = new URL(request.url).searchParams.get("hoja") || "";
    return NextResponse.json(await leerHoja(bytes, hoja));
  } catch {
    return NextResponse.json({ error: "No se pudo abrir esa hoja" }, { status: 500 });
  }
}
