import { bajar } from "../../../lib/blob";
import { rutaDelDia } from "../../../lib/ciclo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request) {
  const dia = new URL(request.url).searchParams.get("dia") || "";
  const ruta = rutaDelDia(dia);
  if (!ruta) return new Response("Archivo no permitido", { status: 400 });
  const bytes = await bajar(ruta.xlsx);
  if (!bytes) return new Response("Todavía no está ese archivo", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${dia}.xlsx"`,
    },
  });
}
