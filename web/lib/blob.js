import { get, list } from "@vercel/blob";

function token() {
  const valor = process.env.BLOB_READ_WRITE_TOKEN;
  if (!valor) throw new Error("Falta el token del Blob");
  return valor;
}

export async function ultimoJson() {
  const tok = token();
  const jsons = [];
  let cursor;
  do {
    const pagina = await list({ prefix: "ciclo_", cursor, token: tok, limit: 100 });
    for (const blob of pagina.blobs) {
      if (/^ciclo_\d{6}_21-20\/\d{4}-\d{2}-\d{2}\.json$/.test(blob.pathname)) jsons.push(blob);
    }
    cursor = pagina.hasMore ? pagina.cursor : undefined;
  } while (cursor);
  jsons.sort((a, b) => b.pathname.localeCompare(a.pathname));
  return jsons[0] || null;
}

export async function bajar(pathname) {
  const archivo = await get(pathname, { access: "private", token: token(), useCache: false });
  if (!archivo || archivo.statusCode !== 200 || !archivo.stream) return null;
  return Buffer.from(await new Response(archivo.stream).arrayBuffer());
}
