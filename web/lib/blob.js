import { get, list } from "@vercel/blob";
import { cicloDe, fechaCorta } from "./ciclo";

function token() {
  const valor = process.env.BLOB_READ_WRITE_TOKEN;
  if (!valor) throw new Error("Falta el token del Blob");
  return valor;
}

async function listar(prefix) {
  const tok = token();
  const blobs = [];
  let cursor;
  do {
    const pagina = await list({ prefix, cursor, token: tok, limit: 100 });
    blobs.push(...pagina.blobs);
    cursor = pagina.hasMore ? pagina.cursor : undefined;
  } while (cursor);
  return blobs;
}

export async function bajar(pathname) {
  const archivo = await get(pathname, { access: "private", token: token(), useCache: false });
  if (!archivo || archivo.statusCode !== 200 || !archivo.stream) return null;
  return Buffer.from(await new Response(archivo.stream).arrayBuffer());
}

export async function resumenVentas() {
  const ciclo = cicloDe();
  const blobs = await listar(`${ciclo.carpeta}/`);
  const archivos = blobs
    .filter((blob) => /\/\d{4}-\d{2}-\d{2}\.xlsx$/.test(blob.pathname))
    .map((blob) => {
      const dia = blob.pathname.split("/").pop().replace(/\.xlsx$/, "");
      return { dia, texto: fechaCorta(dia), subido: blob.uploadedAt };
    })
    .sort((a, b) => b.dia.localeCompare(a.dia));
  const jsons = blobs
    .filter((blob) => blob.pathname.endsWith(".json"))
    .sort((a, b) => b.pathname.localeCompare(a.pathname));
  let vista = null;
  if (jsons[0]) {
    const bytes = await bajar(jsons[0].pathname);
    if (bytes) {
      const completo = JSON.parse(bytes.toString("utf8"));
      vista = {
        generado: completo.generado,
        dia: jsons[0].pathname.split("/").pop().replace(/\.json$/, ""),
        conteos: completo.conteos,
      };
    }
  }
  const hoy = blobs.find((blob) => blob.pathname === ciclo.json);
  return {
    ciclo: {
      inicio: ciclo.inicio,
      finEtiqueta: ciclo.finEtiqueta,
      hasta: ciclo.hasta,
      fechaHoy: ciclo.fechaHoy,
      inicioTexto: fechaCorta(ciclo.inicio),
      finTexto: fechaCorta(ciclo.finEtiqueta),
      hastaTexto: fechaCorta(ciclo.hasta),
    },
    archivos,
    vista,
    hoy: hoy ? { subido: hoy.uploadedAt } : null,
  };
}
