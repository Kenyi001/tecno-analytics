import { NextResponse } from "next/server";
import { consultarCodigo } from "../../../../lib/blob";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  const codigo = new URL(request.url).searchParams.get("codigo") || "";
  if (!codigo.trim()) return NextResponse.json({ error: "Falta el código." }, { status: 400 });
  try {
    return NextResponse.json(await consultarCodigo(codigo));
  } catch {
    return NextResponse.json({ error: "No se pudo consultar ese código." }, { status: 500 });
  }
}
