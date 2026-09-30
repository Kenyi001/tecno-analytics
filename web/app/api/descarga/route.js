import { bajar } from "../../../lib/blob";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RUTA = /^ciclo_\d{6}_21-20\/\d{4}-\d{2}-\d{2}\.xlsx$/;

export async function GET(request) {
  const archivo = new URL(request.url).searchParams.get("archivo") || "";
  if (!RUTA.test(archivo)) {
    return new Response("Archivo no permitido", { status: 400 });
  }
  const bytes = await bajar(archivo);
  if (!bytes) return new Response("Todavía no está ese archivo", { status: 404 });
  const nombre = archivo.split("/").pop();
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${nombre}"`,
    },
  });
}
