import { AVISOS_EXPORT_URL } from "../ventas/ruta-ventas.mjs";
import { encabezadosDcr } from "../../compartido/dcr.mjs";
import { STOCK_EXPORT_URL, cuerpoStock } from "./ruta.mjs";

const ESPERA_TAREA_MS = 10000;
const INTENTOS_TAREA = 60;

async function leerJson(respuesta) {
  const texto = await respuesta.text();
  try {
    return JSON.parse(texto);
  } catch {
    throw new Error(`DCR respondió ${respuesta.status} sin JSON`);
  }
}

function idAviso(item) {
  const id = item?.id ?? item?.taskId;
  return id == null || id === "" ? null : String(id);
}

function listaAvisos(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.records)) return data.records;
  return [];
}

async function leerAvisos(tokens, usuario) {
  const respuesta = await fetch(AVISOS_EXPORT_URL, { headers: encabezadosDcr(tokens, usuario) });
  if (respuesta.status === 401 || respuesta.status === 403) {
    throw new Error("La sesión de DCR fue rechazada al buscar el Excel");
  }
  if (!respuesta.ok) throw new Error(`No se pudo ver la lista de exportaciones (${respuesta.status})`);
  const json = await leerJson(respuesta);
  return listaAvisos(json?.data);
}

async function descargar(url, tokens, usuario) {
  if (typeof url !== "string" || !url.startsWith("http")) {
    throw new Error("La tarea de stock no trajo un enlace de archivo");
  }
  let respuesta = await fetch(url);
  if (respuesta.status === 401 || respuesta.status === 403) {
    respuesta = await fetch(url, { headers: encabezadosDcr(tokens, usuario) });
  }
  if (!respuesta.ok) throw new Error(`No se pudo bajar el Excel (${respuesta.status})`);
  const buffer = Buffer.from(await respuesta.arrayBuffer());
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new Error("El archivo de stock no es un Excel");
  }
  return buffer;
}

async function esperarAviso(tokens, usuario, previos) {
  let idNuevo = null;
  for (let i = 0; i < INTENTOS_TAREA; i++) {
    const lista = await leerAvisos(tokens, usuario);
    if (idNuevo == null) {
      const nuevo = lista.find((item) => {
        const id = idAviso(item);
        return id != null && !previos.has(id);
      });
      if (nuevo) idNuevo = idAviso(nuevo);
    }
    const item = idNuevo == null ? null : lista.find((aviso) => idAviso(aviso) === idNuevo);
    const estado = String(item?.taskStatus ?? item?.status ?? "");
    if (item?.filePath && (estado === "2" || item.isExportSuccess === true)) {
      return descargar(item.filePath, tokens, usuario);
    }
    if (estado === "3" || item?.isExportSuccess === false) {
      throw new Error("DCR no pudo armar el Excel de stock");
    }
    await new Promise((r) => setTimeout(r, ESPERA_TAREA_MS));
  }
  throw new Error("El Excel de stock no estuvo listo a tiempo");
}

export async function bajarExcelStock(tokens, usuario, modelos = []) {
  const previos = new Set((await leerAvisos(tokens, usuario)).map(idAviso).filter(Boolean));
  const respuesta = await fetch(STOCK_EXPORT_URL, {
    method: "POST",
    headers: encabezadosDcr(tokens, usuario),
    body: JSON.stringify(cuerpoStock(modelos)),
  });
  if (respuesta.status === 401 || respuesta.status === 403) {
    throw new Error("La sesión de DCR fue rechazada al pedir el stock");
  }
  const tipo = respuesta.headers.get("content-type") || "";
  if (tipo.includes("spreadsheet") || tipo.includes("octet-stream")) {
    const buffer = Buffer.from(await respuesta.arrayBuffer());
    if (buffer.length < 4 || buffer[0] !== 0x50) throw new Error("La descarga de stock no es un Excel");
    return buffer;
  }
  const json = await leerJson(respuesta);
  if (!respuesta.ok || json?.success === false || json?.code === "400") {
    throw new Error("DCR no aceptó el pedido de stock");
  }
  if (json?.data === true) return esperarAviso(tokens, usuario, previos);
  throw new Error("El pedido de stock no devolvió la tarea");
}
