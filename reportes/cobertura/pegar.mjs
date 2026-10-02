// Pega un Excel de Shop Stock In Record en la hoja Datos.
// No abre el libro en Excel y no borra las otras hojas.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import JSZip from "jszip";

function decode(texto) {
  return String(texto)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}

function xml(texto) {
  return String(texto).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function textos(documento) {
  const salida = [];
  const re = /<si>([\s\S]*?)<\/si>/g;
  let encontrado;
  while ((encontrado = re.exec(documento))) {
    const partes = [...encontrado[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((parte) => decode(parte[1]));
    salida.push(partes.join(""));
  }
  return salida;
}

function rutaHoja(workbook, rels, nombre) {
  const hoja = workbook.match(new RegExp(`<sheet[^>]*name="${nombre}"[^>]*>`));
  if (!hoja) throw new Error(`No está la hoja ${nombre}`);
  const id = hoja[0].match(/r:id="([^"]+)"/);
  const rel = rels.match(new RegExp(`Id="${id[1]}"[^>]*Target="([^"]+)"`));
  const destino = rel[1].replace(/^\//, "");
  return destino.startsWith("xl/") ? destino : `xl/${destino}`;
}

function primeraHoja(workbook, rels) {
  const hoja = workbook.match(/<sheet [^>]*>/)[0];
  const id = hoja.match(/r:id="([^"]+)"/)[1];
  const rel = rels.match(new RegExp(`Id="${id}"[^>]*Target="([^"]+)"`));
  const destino = rel[1].replace(/^\//, "");
  return destino.startsWith("xl/") ? destino : `xl/${destino}`;
}

function valor(attrs, inner, cadenas) {
  if (!inner) return "";
  if (attrs.includes('t="inlineStr"')) {
    const texto = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/);
    return texto ? decode(texto[1]) : "";
  }
  const v = inner.match(/<v>([\s\S]*?)<\/v>/);
  if (!v) return "";
  const crudo = decode(v[1]);
  if (attrs.includes('t="s"')) return cadenas[Number(crudo)] ?? "";
  return crudo;
}

function filasDe(xmlHoja, cadenas) {
  const filas = [];
  const re = /<row r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  let encontrado;
  while ((encontrado = re.exec(xmlHoja))) {
    const celdas = [];
    const celdasRe = /<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let celda;
    while ((celda = celdasRe.exec(encontrado[2]))) {
      let indice = 0;
      for (const letra of celda[1]) indice = indice * 26 + (letra.charCodeAt(0) - 64);
      celdas[indice - 1] = valor(celda[3], celda[4] || "", cadenas);
    }
    filas.push(celdas);
  }
  return filas;
}

function columna(indice) {
  let n = indice + 1;
  let letras = "";
  while (n > 0) {
    const resto = (n - 1) % 26;
    letras = String.fromCharCode(65 + resto) + letras;
    n = Math.floor((n - 1) / 26);
  }
  return letras;
}

function celda(letra, fila, valorCelda) {
  const texto = valorCelda == null ? "" : String(valorCelda);
  if (!texto) return "";
  if (/^-?\d+(\.\d+)?$/.test(texto)) return `<c r="${letra}${fila}"><v>${texto}</v></c>`;
  return `<c r="${letra}${fila}" t="inlineStr"><is><t>${xml(texto)}</t></is></c>`;
}

function tieneUnzip() {
  const prueba = spawnSync("unzip", ["-v"], { encoding: "utf8" });
  return prueba.status === 0;
}

function leerEntradaZip(rutaZip, entrada) {
  // Extraer a disco: unzip -p revienta el maxBuffer con hojas Zip64 (~1GB+).
  const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "stock-entry-"));
  try {
    const salida = spawnSync("unzip", ["-o", "-j", "-d", carpeta, rutaZip, entrada], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
    if (salida.status !== 0) {
      const listado = spawnSync("unzip", ["-l", rutaZip], {
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
      });
      const detalle = (salida.stderr || salida.stdout || "").trim() || `status ${salida.status}`;
      const nombres = (listado.stdout || "").split("\n").filter((l) => /xl\//.test(l)).slice(0, 30).join("\n");
      throw new Error(`No se pudo leer ${entrada} del Excel de stock: ${detalle}\n${nombres}`);
    }
    const archivo = path.join(carpeta, path.basename(entrada));
    if (!fs.existsSync(archivo)) {
      throw new Error(`unzip no dejó ${entrada} en ${carpeta}`);
    }
    return fs.readFileSync(archivo, "utf8");
  } finally {
    fs.rmSync(carpeta, { recursive: true, force: true });
  }
}

async function filasDesdeExport(exportOrigen) {
  let ruta = null;
  let borrar = false;
  if (Buffer.isBuffer(exportOrigen)) {
    ruta = path.join(os.tmpdir(), `stock-export-${process.pid}.xlsx`);
    fs.writeFileSync(ruta, exportOrigen);
    borrar = true;
  } else {
    ruta = String(exportOrigen);
  }
  try {
    if (tieneUnzip()) {
      const libroExport = leerEntradaZip(ruta, "xl/workbook.xml");
      const relsExport = leerEntradaZip(ruta, "xl/_rels/workbook.xml.rels");
      const hojaExport = primeraHoja(libroExport, relsExport);
      let cadenasExport = [];
      try {
        cadenasExport = textos(leerEntradaZip(ruta, "xl/sharedStrings.xml"));
      } catch {
        cadenasExport = [];
      }
      return filasDe(leerEntradaZip(ruta, hojaExport), cadenasExport);
    }
    const exportado = await JSZip.loadAsync(fs.readFileSync(ruta));
    for (const nombre of Object.keys(exportado.files)) {
      if (exportado.files[nombre].dir) delete exportado.files[nombre];
    }
    const libroExport = await exportado.file("xl/workbook.xml").async("string");
    const relsExport = await exportado.file("xl/_rels/workbook.xml.rels").async("string");
    const hojaExport = primeraHoja(libroExport, relsExport);
    const cadenasExport = exportado.file("xl/sharedStrings.xml")
      ? textos(await exportado.file("xl/sharedStrings.xml").async("string"))
      : [];
    return filasDe(await exportado.file(hojaExport).async("string"), cadenasExport);
  } finally {
    if (borrar && fs.existsSync(ruta)) fs.unlinkSync(ruta);
  }
}

export async function pegarDatos(rutaLibro, exportOrigen) {
  const filas = await filasDesdeExport(exportOrigen);

  const cobertura = await JSZip.loadAsync(fs.readFileSync(rutaLibro));
  for (const nombre of Object.keys(cobertura.files)) {
    if (cobertura.files[nombre].dir) delete cobertura.files[nombre];
  }
  const libro = await cobertura.file("xl/workbook.xml").async("string");
  const rels = await cobertura.file("xl/_rels/workbook.xml.rels").async("string");
  const datosPath = rutaHoja(libro, rels, "Datos");
  const shopPath = rutaHoja(libro, rels, "SHOP");
  const cadenasDatos = textos(await cobertura.file("xl/sharedStrings.xml").async("string"));
  const datosXml = await cobertura.file(datosPath).async("string");
  const encabezadoDatos = filasDe(datosXml.slice(0, datosXml.indexOf("</row>") + 6), cadenasDatos)[0] || [];
  const encabezadoExport = (filas[0] || []).map((nombre) => String(nombre || "").trim().toLowerCase());
  const puestos = encabezadoDatos.map((nombre) => encabezadoExport.indexOf(String(nombre || "").trim().toLowerCase()));
  const shop = puestos[3];
  const modelo = puestos[9];
  const color = puestos[12];
  const cantidad = puestos[17];
  if (shop < 0 || modelo < 0 || color < 0 || cantidad < 0) {
    throw new Error("El Excel de stock no trae Shop ID, Model, Color y Quantity");
  }
  const registros = filas.slice(1).filter((fila) => fila.some((valor) => String(valor || "").trim()));
  if (registros.length < 1000) throw new Error("El Excel de stock trae muy pocas filas para reemplazar Datos");
  const ancho = Math.max(encabezadoDatos.length, 18);
  const lineas = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${columna(ancho - 1)}${registros.length + 1}"/><sheetData>`,
  ];
  const escribir = (numero, valores) => {
    const celdas = [];
    for (let i = 0; i < ancho; i++) {
      const pieza = celda(columna(i), numero, valores[i] || "");
      if (pieza) celdas.push(pieza);
    }
    lineas.push(`<row r="${numero}">${celdas.join("")}</row>`);
  };
  escribir(1, encabezadoDatos);
  for (let indice = 0; indice < registros.length; indice++) {
    const fila = registros[indice];
    const valores = puestos.map((puesto) => (puesto >= 0 ? fila[puesto] : ""));
    escribir(indice + 2, valores);
    registros[indice] = null;
  }
  lineas.push("</sheetData></worksheet>");
  const fin = registros.length + 1;
  let shopXml = await cobertura.file(shopPath).async("string");
  shopXml = shopXml.replace(/Datos!\$([A-Z])\$2:\$\1\$\d+/g, (_, letra) => `Datos!$${letra}$2:$${letra}$${fin}`);
  cobertura.file(datosPath, lineas.join(""), { createFolders: false });
  cobertura.file(shopPath, shopXml, { createFolders: false });
  for (const nombre of Object.keys(cobertura.files)) {
    if (cobertura.files[nombre].dir) delete cobertura.files[nombre];
  }
  const buffer = await cobertura.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const temporal = `${rutaLibro}.tmp`;
  fs.writeFileSync(temporal, buffer);
  try {
    fs.renameSync(temporal, rutaLibro);
  } catch (error) {
    fs.unlinkSync(temporal);
    throw error;
  }
  return { filas: fin - 1, fin };
}
