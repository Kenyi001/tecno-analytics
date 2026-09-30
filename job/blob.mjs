import { get, put } from "@vercel/blob";

const PLANTILLA = "template/ciclo.xlsx";

function token() {
  const valor = process.env.BLOB_READ_WRITE_TOKEN;
  if (!valor) throw new Error("Falta BLOB_READ_WRITE_TOKEN");
  return valor;
}

async function aBuffer(archivo) {
  if (!archivo || archivo.statusCode !== 200 || !archivo.stream) return null;
  return Buffer.from(await new Response(archivo.stream).arrayBuffer());
}

export async function bajarPlantilla() {
  const archivo = await get(PLANTILLA, { access: "private", token: token(), useCache: false });
  const buffer = await aBuffer(archivo);
  if (!buffer) throw new Error("Falta template/ciclo.xlsx en el Blob");
  return buffer;
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
