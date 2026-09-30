import {
  EXPORT_TASK_LIST_URL,
  SALES_EXPORT_URL,
  cuerpoVentas,
} from "./ruta-ventas.mjs";
import { encabezadosDcr } from "./login.mjs";

const ESPERA_TAREA_MS = 10000;
const INTENTOS_TAREA = 36;

function idDeTarea(data) {
  if (typeof data === "string" || typeof data === "number") return data;
  if (data && typeof data === "object") {
    return data.taskId ?? data.id ?? data.taskid ?? null;
  }
  return null;
}

async function leerJson(respuesta) {
  const texto = await respuesta.text();
  try {
    return JSON.parse(texto);
  } catch {
    throw new Error(`DCR respondió ${respuesta.status} sin JSON`);
  }
}

export async function bajarExcelVentas(tokens, usuario, ciclo) {
  const respuesta = await fetch(SALES_EXPORT_URL, {
    method: "POST",
    headers: encabezadosDcr(tokens, usuario),
    body: JSON.stringify(cuerpoVentas(ciclo)),
  });
  if (respuesta.status === 401 || respuesta.status === 403) {
    throw new Error("La sesión de DCR fue rechazada al pedir las ventas");
  }
  const tipo = respuesta.headers.get("content-type") || "";
  if (tipo.includes("spreadsheet") || tipo.includes("octet-stream")) {
    const buffer = Buffer.from(await respuesta.arrayBuffer());
    if (buffer.length < 4 || buffer[0] !== 0x50) {
      throw new Error("La descarga de ventas no es un Excel");
    }
    return buffer;
  }
  const json = await leerJson(respuesta);
  if (!respuesta.ok || json?.success === false || json?.code === "400") {
    throw new Error("DCR no aceptó el pedido de ventas");
  }
  const tarea = idDeTarea(json?.data);
  if (tarea == null) throw new Error("El pedido de ventas no devolvió una tarea");
  return esperarArchivo(tokens, usuario, tarea);
}

async function esperarArchivo(tokens, usuario, tarea) {
  for (let i = 0; i < INTENTOS_TAREA; i++) {
    const respuesta = await fetch(EXPORT_TASK_LIST_URL, {
      method: "POST",
      headers: encabezadosDcr(tokens, usuario),
      body: JSON.stringify({ statusList: [2, 3], taskIdList: [tarea] }),
    });
    if (!respuesta.ok) {
      throw new Error(`No se pudo consultar la tarea de ventas (${respuesta.status})`);
    }
    const json = await leerJson(respuesta);
    const lista = Array.isArray(json?.data) ? json.data : [];
    const item = lista[0];
    if (item?.isExportSuccess && item.filePath) {
      return descargar(item.filePath, tokens, usuario);
    }
    if (item && item.isExportSuccess === false && item.reason) {
      throw new Error("DCR no pudo armar el Excel de ventas");
    }
    await new Promise((r) => setTimeout(r, ESPERA_TAREA_MS));
  }
  throw new Error("El Excel de ventas no estuvo listo a tiempo");
}

async function descargar(url, tokens, usuario) {
  if (typeof url !== "string" || !url.startsWith("http")) {
    throw new Error("La tarea de ventas no trajo un enlace de archivo");
  }
  let respuesta = await fetch(url);
  if (respuesta.status === 401 || respuesta.status === 403) {
    respuesta = await fetch(url, { headers: encabezadosDcr(tokens, usuario) });
  }
  if (!respuesta.ok) throw new Error(`No se pudo bajar el Excel (${respuesta.status})`);
  const buffer = Buffer.from(await respuesta.arrayBuffer());
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new Error("El archivo de ventas no es un Excel");
  }
  return buffer;
}
