import { NextResponse } from "next/server";
import { handleUpload } from "@vercel/blob/client";
import { marcarLibroMayorista, RUTA_LIBRO_MAYORISTA } from "../../../../lib/blob";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const TOPE = 80 * 1024 * 1024;

export async function POST(request) {
  const body = await request.json();
  try {
    const respuesta = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (pathname !== RUTA_LIBRO_MAYORISTA) throw new Error("Ruta no permitida");
        return {
          allowedContentTypes: [
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/octet-stream",
            "application/zip",
          ],
          maximumSizeInBytes: TOPE,
          addRandomSuffix: false,
          allowOverwrite: true,
        };
      },
      onUploadCompleted: async () => {
        await marcarLibroMayorista();
      },
    });
    return NextResponse.json(respuesta);
  } catch (error) {
    return NextResponse.json({ error: error?.message || "No se pudo subir el Excel." }, { status: 400 });
  }
}
