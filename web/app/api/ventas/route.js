import { NextResponse } from "next/server";
import { resumenVentas } from "../../../lib/blob";
import { dispararVentas, estadoTrabajo } from "../../../lib/github";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await resumenVentas());
  } catch {
    return NextResponse.json({ error: "No se pudieron leer las ventas." }, { status: 500 });
  }
}

export async function POST() {
  try {
    await dispararVentas();
    return NextResponse.json({ ok: true, desde: Date.now() });
  } catch (error) {
    const status = error.codigo || 502;
    const aviso = status === 503 ? "Falta el permiso para actualizar." : "No se pudo pedir la actualización.";
    return NextResponse.json({ ok: false, aviso }, { status });
  }
}
