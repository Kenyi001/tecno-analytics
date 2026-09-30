import { get, put } from "@vercel/blob";

export const PLANTILLA_VENTAS = "ventas/plantilla/ciclo.xlsx";

function token() {
  const valor = process.env.BLOB_READ_WRITE_TOKEN;
  if (!valor) throw new Error("Falta BLOB_READ_WRITE_TOKEN");
  return valor;
}

async function aBuffer(archivo) {
  if (!archivo || archivo.statusCode !== 200 || !archivo.stream) return null;
  return Buffer.from(await new Response(archivo.stream).arrayBuffer());
}

async function leer(pathname) {
  const archivo = await get(pathname, { access: "private", token: token(), useCache: false });
  return aBuffer(archivo);
}

export async function bajarPlantilla() {
  const actual = await leer(PLANTILLA_VENTAS);
  if (actual) return actual;
  const anterior = await leer("template/ciclo.xlsx");
  if (!anterior) throw new Error("Falta ventas/plantilla/ciclo.xlsx en el Blob");
  await put(PLANTILLA_VENTAS, anterior, {
    access: "private",
    token: token(),
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  return anterior;
}

export async function subirDia(ciclo, xlsx, json) {
  const tok = token();
  await put(ciclo.xlsx, xlsx, {
    access: "private",
    token: tok,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  await put(ciclo.json, JSON.stringify(json), {
    access: "private",
    token: tok,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}
