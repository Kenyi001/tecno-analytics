import { NextResponse } from "next/server";
import { firma, igual } from "../../../lib/oficina";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const secreto = process.env.OFFICE_PASSWORD || "";
  const form = await request.formData();
  const clave = String(form.get("clave") || "");
  const destinoMal = new URL("/acceso?error=1", request.url);
  if (!secreto || !igual(clave, secreto)) {
    return NextResponse.redirect(destinoMal, 303);
  }
  const respuesta = NextResponse.redirect(new URL("/", request.url), 303);
  respuesta.cookies.set("oficina", await firma(secreto), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return respuesta;
}
