import { NextResponse } from "next/server";
import { firma, igual } from "./lib/oficina";

export async function middleware(request) {
  const secreto = process.env.OFFICE_PASSWORD;
  if (!secreto) {
    return new NextResponse("La página no tiene clave de oficina.", { status: 503 });
  }
  const esperada = await firma(secreto);
  const cookie = request.cookies.get("oficina")?.value || "";
  if (igual(cookie, esperada)) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/acceso";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|acceso|api/acceso).*)"],
};
