import { NextResponse } from "next/server";
import { resumenMayorista } from "../../../lib/blob";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const desde = searchParams.get("desde") || undefined;
    const marca = searchParams.get("marca") || undefined;
    return NextResponse.json(
      await resumenMayorista({
        umbralFecha: desde || undefined,
        marca: marca || undefined,
      }),
    );
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "No se pudo leer el stock mayorista." },
      { status: 500 },
    );
  }
}
