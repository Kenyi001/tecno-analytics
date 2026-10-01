import { NextResponse } from "next/server";
import { resumenCobertura } from "../../../lib/blob";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await resumenCobertura());
  } catch {
    return NextResponse.json({ error: "No se pudo leer la cobertura." }, { status: 500 });
  }
}
