import JSZip from "jszip";
import { COLUMNAS_ESPERADAS, COLUMNAS_OCULTAS } from "./ruta-ventas.mjs";

const COLUMNA_Y = 25;

function decodificar(texto) {
  return texto
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function escapar(texto) {
  return String(texto)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function numeroColumna(letras) {
  let n = 0;
  for (const ch of letras) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function letrasColumna(n) {
  let s = "";
  while (n > 0) {
    const resto = (n - 1) % 26;
    s = String.fromCharCode(65 + resto) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function rutaHoja(workbookXml, relsXml, nombre) {
  const hoja =
    new RegExp(`<sheet\\b[^>]*\\bname="${nombre}"[^>]*\\br:id="([^"]+)"`).exec(workbookXml) ||
    new RegExp(`<sheet\\b[^>]*\\br:id="([^"]+)"[^>]*\\bname="${nombre}"`).exec(workbookXml);
  if (!hoja) throw new Error(`El libro no tiene la hoja ${nombre}`);
  const id = hoja[1];
  const rel =
    new RegExp(`Id="${id}"[^>]*Target="([^"]+)"`).exec(relsXml) ||
    new RegExp(`Target="([^"]+)"[^>]*Id="${id}"`).exec(relsXml);
  if (!rel) throw new Error(`No se encontró el archivo de la hoja ${nombre}`);
  let target = rel[1];
  if (target.startsWith("/")) return target.slice(1);
  if (target.startsWith("xl/")) return target;
  return `xl/${target}`;
}

function nombresHojas(workbookXml) {
  return [...workbookXml.matchAll(/<sheet\b[^>]*\bname="([^"]+)"/g)].map((m) => m[1]);
}

function textoCelda(atributos, interior, compartidas) {
  if (/\bt="inlineStr"/.test(atributos)) {
    const partes = [...interior.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodificar(m[1]));
    return partes.join("");
  }
  const valor = /<v>([\s\S]*?)<\/v>/.exec(interior);
  if (!valor) return "";
  const crudo = decodificar(valor[1]);
  if (/\bt="s"/.test(atributos)) return compartidas[Number(crudo)] ?? "";
  return crudo;
}

function leerCompartidas(xml) {
  if (!xml) return [];
  const salida = [];
  const re = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let item;
  while ((item = re.exec(xml))) {
    const partes = [...item[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodificar(m[1]));
    salida.push(partes.join(""));
  }
  return salida;
}

function leerFilas(xml, compartidas) {
  const filas = [];
  const filaRe = /<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  let fila;
  while ((fila = filaRe.exec(xml))) {
    const celdas = new Map();
    const celdaRe = /<c\b([^>]*?)\br="([A-Z]+)(\d+)"([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let celda;
    while ((celda = celdaRe.exec(fila[2]))) {
      const atributos = `${celda[1]} ${celda[4]}`;
      const interior = celda[5] || "";
      celdas.set(numeroColumna(celda[2]), textoCelda(atributos, interior, compartidas));
    }
    const numero = Number(fila[1]);
    const max = Math.max(celdas.size ? Math.max(...celdas.keys()) : 0, filas[0]?.length || 0);
    const ancho = numero === 1 ? max : Math.max(max, filas[0]?.length || 0);
    const valores = [];
    for (let c = 1; c <= ancho; c++) valores.push(celdas.get(c) ?? "");
    if (filas[numero - 1]) throw new Error("El Excel de ventas repite una fila");
    filas[numero - 1] = valores;
  }
  for (let i = 0; i < filas.length; i++) {
    if (!filas[i]) throw new Error("El Excel de ventas tiene un hueco entre filas");
  }
  return filas;
}

export async function leerHojaExport(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const workbook = await zip.file("xl/workbook.xml").async("string");
  const rels = await zip.file("xl/_rels/workbook.xml.rels").async("string");
  const primera = /<sheet\b[^>]*\br:id="([^"]+)"/.exec(workbook);
  if (!primera) throw new Error("El Excel de ventas no tiene hojas");
  const id = primera[1];
  const rel =
    new RegExp(`Id="${id}"[^>]*Target="([^"]+)"`).exec(rels) ||
    new RegExp(`Target="([^"]+)"[^>]*Id="${id}"`).exec(rels);
  let target = rel[1];
  if (!target.startsWith("xl/")) target = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
  const xml = await zip.file(target).async("string");
  const compartidas = zip.file("xl/sharedStrings.xml")
    ? leerCompartidas(await zip.file("xl/sharedStrings.xml").async("string"))
    : [];
  const filas = leerFilas(xml, compartidas);
  if (filas.length < 2) throw new Error("El Excel de ventas llegó vacío");
  const encabezados = filas[0];
  for (const [indice, nombre] of Object.entries(COLUMNAS_ESPERADAS)) {
    if (encabezados[Number(indice)] !== nombre) {
      throw new Error(`La columna ${Number(indice) + 1} ya no es "${nombre}". No se pega para no correr el reporte.`);
    }
  }
  return filas;
}

function celdaInline(ref, estilo, texto) {
  const s = estilo ? ` s="${estilo}"` : "";
  return `<c r="${ref}"${s} t="inlineStr"><is><t>${escapar(texto)}</t></is></c>`;
}

function estilosDeFila(xml, numeroFila) {
  const fila = new RegExp(`<row\\b[^>]*\\br="${numeroFila}"[^>]*>([\\s\\S]*?)</row>`).exec(xml);
  const estilos = new Map();
  if (!fila) return estilos;
  const celdaRe = /<c\b([^>]*?)\br="([A-Z]+)\d+"([^>]*)/g;
  let celda;
  while ((celda = celdaRe.exec(fila[1]))) {
    const estilo = /\bs="(\d+)"/.exec(`${celda[1]} ${celda[3]}`);
    if (estilo) estilos.set(numeroColumna(celda[2]), estilo[1]);
  }
  return estilos;
}

function reemplazarSheetData(xml, sheetData, filas, columnas) {
  const ultima = letrasColumna(COLUMNA_Y + columnas - 1);
  const conDimension = xml.replace(
    /<dimension\b[^>]*\bref="[^"]*"/,
    `<dimension ref="Y1:${ultima}${filas}"`
  );
  if (!/<sheetData\b[^>]*>[\s\S]*<\/sheetData>/.test(conDimension)) {
    throw new Error("La hoja Data_DCR no tiene bloque de datos");
  }
  return conDimension.replace(/<sheetData\b[^>]*>[\s\S]*<\/sheetData>/, `<sheetData>${sheetData}</sheetData>`);
}

function armarDataDcr(xml, filas) {
  const estiloEncabezado = estilosDeFila(xml, 1);
  const estiloDato = estilosDeFila(xml, 2);
  const columnas = filas[0].length;
  const trozos = [];
  filas.forEach((fila, indice) => {
    const numero = indice + 1;
    const estilos = numero === 1 ? estiloEncabezado : estiloDato;
    const celdas = [];
    for (let c = 0; c < columnas; c++) {
      const col = COLUMNA_Y + c;
      const ref = `${letrasColumna(col)}${numero}`;
      celdas.push(celdaInline(ref, estilos.get(col), fila[c] ?? ""));
    }
    trozos.push(`<row r="${numero}">${celdas.join("")}</row>`);
  });
  return reemplazarSheetData(xml, trozos.join(""), filas.length, columnas);
}

function indiceEncabezado(encabezados, nombre) {
  const i = encabezados.indexOf(nombre);
  if (i < 0) throw new Error(`El Excel de ventas no trae la columna ${nombre}`);
  return i;
}

function valorDetalle(fila, indice, enBlanco) {
  const valor = (fila[indice] ?? "").trim();
  if (!valor && enBlanco) return "(blank)";
  return valor;
}

function quitarColumnasAF(interior) {
  return interior.replace(/<c\b[^>]*\br="[A-F]\d+"[^>]*(?:\/>|>[\s\S]*?<\/c>)/g, "");
}

function rearmarDetalle(xml, filas) {
  const encabezados = filas[0];
  const cols = {
    imei: indiceEncabezado(encabezados, "IMEI/SN"),
    venta: indiceEncabezado(encabezados, "Sales Date"),
    activacion: indiceEncabezado(encabezados, "Activation Date"),
    modelo: indiceEncabezado(encabezados, "Model"),
    vendedor: indiceEncabezado(encabezados, "Uploader"),
    codigo: indiceEncabezado(encabezados, "Uploader ID"),
  };
  const datos = filas.slice(1);
  const estilo = estilosDeFila(xml, 4);
  const usados = new Set();
  const xmlNuevo = xml.replace(/<row\b([^>]*?)\br="(\d+)"([^>]*)>([\s\S]*?)<\/row>/g, (todo, antes, num, despues, interior) => {
    const numero = Number(num);
    if (numero < 4) return todo;
    const offset = numero - 4;
    usados.add(numero);
    const limpio = quitarColumnasAF(interior);
    if (offset >= datos.length) {
      return `<row${antes} r="${num}"${despues}>${limpio}</row>`;
    }
    const fila = datos[offset];
    const valores = [
      valorDetalle(fila, cols.imei, false),
      valorDetalle(fila, cols.venta, false),
      valorDetalle(fila, cols.activacion, true),
      valorDetalle(fila, cols.modelo, false),
      valorDetalle(fila, cols.vendedor, false),
      valorDetalle(fila, cols.codigo, false),
    ];
    const letras = ["A", "B", "C", "D", "E", "F"];
    const celdas = letras.map((letra, i) => celdaInline(`${letra}${numero}`, estilo.get(i + 1), valores[i]));
    return `<row${antes} r="${num}"${despues}>${celdas.join("")}${limpio}</row>`;
  });
  const ultimaPlantilla = Math.max(...usados, 3);
  if (datos.length > ultimaPlantilla - 3) {
    throw new Error("El extracto trae más filas que las fórmulas de Detalle_imei2. Hay que ampliar esa hoja en el Excel plantilla.");
  }
  for (let n = 4; n < 4 + datos.length; n++) {
    if (!usados.has(n)) throw new Error(`Falta la fila ${n} de Detalle_imei2 en la plantilla`);
  }
  return xmlNuevo;
}

function contar(filas, nombre) {
  const indice = filas[0].indexOf(nombre);
  const mapa = new Map();
  if (indice < 0) return [];
  for (const fila of filas.slice(1)) {
    const clave = (fila[indice] ?? "").trim() || "(sin dato)";
    mapa.set(clave, (mapa.get(clave) || 0) + 1);
  }
  return [...mapa.entries()]
    .map(([nombreItem, ventas]) => ({ nombre: nombreItem, ventas }))
    .sort((a, b) => b.ventas - a.ventas || a.nombre.localeCompare(b.nombre));
}

export function vistaPublica(filas, ciclo, hojas) {
  const ocultas = filas[0].map((nombre) => COLUMNAS_OCULTAS.has(nombre));
  const columnas = filas[0].filter((_, i) => !ocultas[i]);
  const registros = filas.slice(1).map((fila) => fila.filter((_, i) => !ocultas[i]));
  return {
    generado: new Date().toISOString(),
    ciclo,
    hojas,
    columnas,
    filas: registros,
    conteos: {
      registros: registros.length,
      porModelo: contar(filas, "Model"),
      porCiudad: contar(filas, "City"),
      porEstado: contar(filas, "State"),
    },
  };
}

export async function armarLibro(plantilla, filas) {
  const zip = await JSZip.loadAsync(plantilla);
  const workbook = await zip.file("xl/workbook.xml").async("string");
  const rels = await zip.file("xl/_rels/workbook.xml.rels").async("string");
  const hojas = nombresHojas(workbook);
  const dataPath = rutaHoja(workbook, rels, "Data_DCR");
  const detallePath = rutaHoja(workbook, rels, "Detalle_imei2");
  const dataXml = await zip.file(dataPath).async("string");
  const detalleXml = await zip.file(detallePath).async("string");
  const sinCarpeta = { createFolders: false };
  zip.file(dataPath, armarDataDcr(dataXml, filas), sinCarpeta);
  zip.file(detallePath, rearmarDetalle(detalleXml, filas), sinCarpeta);
  for (const nombre of Object.keys(zip.files)) {
    if (zip.files[nombre].dir) delete zip.files[nombre];
  }
  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  return { buffer, hojas };
}
