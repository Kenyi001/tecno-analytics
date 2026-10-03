import { NextResponse } from "next/server";
import { resumenCobertura } from "../../../lib/blob";
import { dispararCobertura } from "../../../lib/github";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  try {
    return NextResponse.json(await resumenCobertura());
  } catch {
    return NextResponse.json({ error: "No se pudo leer la cobertura." }, { status: 500 });
  }
}

export async function POST() {
  try {
    const resumen = await resumenCobertura();
    if (!resumen.tieneLibro) {
      return NextResponse.json(
        { ok: false, aviso: "Primero sube el Excel de cobertura. Sin ese libro no se puede pegar el stock." },
        { status: 409 }
      );
    }
    await dispararCobertura();
    return NextResponse.json({ ok: true, desde: Date.now() });
  } catch (error) {
    const status = error.codigo || 502;
    const aviso = status === 503 ? "Falta el permiso para actualizar." : "No se pudo pedir la actualización.";
    return NextResponse.json({ ok: false, aviso }, { status });
  }
}
