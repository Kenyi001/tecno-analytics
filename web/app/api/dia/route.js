import { NextResponse } from "next/server";
import { bajar, ultimoJson } from "../../../lib/blob";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const blob = await ultimoJson();
  if (!blob) return NextResponse.json({ vacio: true });
  const bytes = await bajar(blob.pathname);
  if (!bytes) return NextResponse.json({ vacio: true });
  const vista = JSON.parse(bytes.toString("utf8"));
  return NextResponse.json(vista);
}
