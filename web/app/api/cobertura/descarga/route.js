import { libroCobertura } from "../../../../lib/blob";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const bytes = await libroCobertura();
  if (!bytes) return new Response("Todavía no está el Excel de cobertura.", { status: 404 });
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="cobertura.xlsx"',
    },
  });
}
