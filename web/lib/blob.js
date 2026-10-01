import { get, list } from "@vercel/blob";
import { cicloDe, fechaCorta, fechaHoraBolivia } from "./ciclo";

function contarColumna(columnas, filas, nombre) {
  if (!Array.isArray(columnas) || !Array.isArray(filas)) return null;
  const indice = columnas.indexOf(nombre);
  if (indice < 0) return null;
  const mapa = new Map();
  for (const fila of filas) {
    const clave = String(fila?.[indice] ?? "").trim() || "(sin dato)";
    mapa.set(clave, (mapa.get(clave) || 0) + 1);
  }
  return [...mapa.entries()]
    .map(([nombreItem, ventas]) => ({ nombre: nombreItem, ventas }))
    .sort((a, b) => b.ventas - a.ventas || a.nombre.localeCompare(b.nombre, "es"));
}

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
      return {
        dia,
        texto: fechaCorta(dia),
        subido: blob.uploadedAt,
        subidoTexto: fechaHoraBolivia(blob.uploadedAt),
      };
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
      const dia = jsons[0].pathname.split("/").pop().replace(/\.json$/, "");
      const momento = completo.generado || jsons[0].uploadedAt;
      const excel = archivos.find((archivo) => archivo.dia === dia);
      const diferencia = excel?.subido && momento ? new Date(excel.subido).getTime() - new Date(momento).getTime() : 0;
      vista = {
        generado: completo.generado,
        dia,
        datosTexto: fechaCorta(dia),
        actualizadoTexto: fechaHoraBolivia(momento),
        calculadoTexto: diferencia > 3 * 60 * 1000 ? fechaHoraBolivia(excel.subido) : "",
        conteos: {
          ...completo.conteos,
          porModelo: contarColumna(completo.columnas, completo.filas, "Model") || completo.conteos?.porModelo,
        },
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
