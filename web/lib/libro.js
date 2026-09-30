import JSZip from "jszip";

const TOPE_FILAS = 2500;

function decodificar(texto) {
  return texto
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
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

function textoCelda(atributos, interior, compartidas) {
  if (/\bt="inlineStr"/.test(atributos) || /\bt="str"/.test(atributos)) {
    const partes = [...interior.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodificar(m[1]));
    return partes.join("");
  }
  const valor = /<v>([\s\S]*?)<\/v>/.exec(interior);
  if (!valor) return "";
  const crudo = decodificar(valor[1]);
  if (/\bt="s"/.test(atributos)) return compartidas[Number(crudo)] ?? "";
  if (/\bt="b"/.test(atributos)) return crudo === "1" ? "TRUE" : "FALSE";
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

function hojasDelLibro(workbookXml) {
  const hojas = [];
  const re = /<sheet\b([^>]*)\/?>/g;
  let item;
  while ((item = re.exec(workbookXml))) {
    const attrs = item[1];
    const nombre = /\bname="([^"]+)"/.exec(attrs);
    const id = /\br:id="([^"]+)"/.exec(attrs);
    if (nombre && id) hojas.push({ nombre: decodificar(nombre[1]), id: id[1] });
  }
  return hojas;
}

function rutaDe(relsXml, id) {
  const rel =
    new RegExp(`Id="${id}"[^>]*Target="([^"]+)"`).exec(relsXml) ||
    new RegExp(`Target="([^"]+)"[^>]*Id="${id}"`).exec(relsXml);
  if (!rel) return null;
  let target = rel[1];
  if (target.startsWith("/")) target = target.slice(1);
  if (!target.startsWith("xl/")) target = `xl/${target}`;
  if (target.includes("..")) return null;
  return target;
}

function leerCeldas(xml, compartidas) {
  const filas = new Map();
  const bloque = /<sheetData\b[^>]*>([\s\S]*?)<\/sheetData>/.exec(xml);
  const fuente = bloque ? bloque[1] : xml;
  const filaRe = /<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g;
  let fila;
  while ((fila = filaRe.exec(fuente))) {
    const celdas = new Map();
    const celdaRe = /<c\b([^>]*?)\br="([A-Z]+)(\d+)"([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let celda;
    while ((celda = celdaRe.exec(fila[2]))) {
      const atributos = `${celda[1]} ${celda[4]}`;
      const texto = textoCelda(atributos, celda[5] || "", compartidas);
      if (texto !== "") celdas.set(numeroColumna(celda[2]), texto);
    }
    if (celdas.size) filas.set(Number(fila[1]), celdas);
  }
  return filas;
}

export async function leerHoja(buffer, pedida) {
  const zip = await JSZip.loadAsync(buffer);
  const workbook = await zip.file("xl/workbook.xml").async("string");
  const rels = await zip.file("xl/_rels/workbook.xml.rels").async("string");
  const hojas = hojasDelLibro(workbook);
  if (!hojas.length) throw new Error("El libro no tiene hojas");
  const elegida =
    hojas.find((hoja) => hoja.nombre === pedida) ||
    hojas.find((hoja) => !pedida && hoja.nombre === "Data_DCR") ||
    hojas[0];
  const ruta = rutaDe(rels, elegida.id);
  if (!ruta || !zip.file(ruta)) throw new Error("No se encontró esa hoja");
  const compartidas = zip.file("xl/sharedStrings.xml")
    ? leerCompartidas(await zip.file("xl/sharedStrings.xml").async("string"))
    : [];
  const celdas = leerCeldas(await zip.file(ruta).async("string"), compartidas);
  let minCol = Infinity;
  let maxCol = 0;
  let maxFila = 0;
  for (const [fila, columnas] of celdas) {
    if (fila > TOPE_FILAS) continue;
    maxFila = Math.max(maxFila, fila);
    for (const col of columnas.keys()) {
      minCol = Math.min(minCol, col);
      maxCol = Math.max(maxCol, col);
    }
  }
  const cortado = [...celdas.keys()].some((fila) => fila > TOPE_FILAS);
  if (!maxFila || minCol === Infinity) {
    return { hojas: hojas.map((hoja) => hoja.nombre), hoja: elegida.nombre, columnas: [], filas: [], cortado };
  }
  const columnas = [];
  for (let col = minCol; col <= maxCol; col++) columnas.push(letrasColumna(col));
  const filas = [];
  for (let fila = 1; fila <= maxFila; fila++) {
    const mapa = celdas.get(fila);
    const valores = [];
    for (let col = minCol; col <= maxCol; col++) valores.push(mapa?.get(col) ?? "");
    filas.push(valores);
  }
  return { hojas: hojas.map((hoja) => hoja.nombre), hoja: elegida.nombre, columnas, filas, cortado };
}
