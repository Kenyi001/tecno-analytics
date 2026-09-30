import JSZip from "jszip";

const TOPE_FILAS = 2500;
const DEF_ANCHO = 72;
const DEF_ALTO = 20;
const EMU = 96 / 914400;

const INDEXED = [
  "000000", "FFFFFF", "FF0000", "00FF00", "0000FF", "FFFF00", "FF00FF", "00FFFF",
  "000000", "FFFFFF", "FF0000", "00FF00", "0000FF", "FFFF00", "FF00FF", "00FFFF",
  "800000", "008000", "000080", "808000", "800080", "008080", "C0C0C0", "808080",
  "9999FF", "993366", "FFFFCC", "CCFFFF", "660066", "FF8080", "0066CC", "CCCCFF",
  "000080", "FF00FF", "FFFF00", "00FFFF", "800080", "800000", "008080", "0000FF",
  "00CCFF", "CCFFFF", "CCFFCC", "FFFF99", "99CCFF", "FF99CC", "CC99FF", "FFCC99",
  "3366FF", "33CCCC", "99CC00", "FFCC00", "FF9900", "FF6600", "666699", "969696",
  "003366", "339966", "003300", "333300", "993300", "993366", "333399", "333333",
];

const FORMATOS_BASE = {
  1: "0",
  2: "0.00",
  3: "#,##0",
  4: "#,##0.00",
  9: "0%",
  10: "0.00%",
  14: "m/d/yyyy",
};

function decodificar(texto) {
  return String(texto)
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

function resolver(base, target) {
  if (!target) return null;
  if (target.startsWith("/")) target = target.slice(1);
  if (!target.includes("..") && target.startsWith("xl/")) return target;
  const partes = base.split("/").slice(0, -1);
  for (const parte of target.split("/")) {
    if (parte === "..") partes.pop();
    else if (parte !== "." && parte) partes.push(parte);
  }
  const ruta = partes.join("/");
  return ruta.includes("..") ? null : ruta;
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

function textoCelda(atributos, interior, compartidas) {
  if (/\bt="inlineStr"/.test(atributos) || /\bt="str"/.test(atributos)) {
    const partes = [...interior.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodificar(m[1]));
    return { texto: partes.join(""), numero: false };
  }
  const valor = /<v>([\s\S]*?)<\/v>/.exec(interior);
  if (!valor) return { texto: "", numero: false };
  const crudo = decodificar(valor[1]);
  if (/\bt="s"/.test(atributos)) return { texto: compartidas[Number(crudo)] ?? "", numero: false };
  if (/\bt="b"/.test(atributos)) return { texto: crudo === "1" ? "TRUE" : "FALSE", numero: false };
  if (/\bt=/.test(atributos)) return { texto: crudo, numero: false };
  return { texto: crudo, numero: true };
}

function bloques(xml, etiqueta) {
  const re = new RegExp(`<${etiqueta}\\b[^>]*/>|<${etiqueta}\\b[^>]*>[\\s\\S]*?</${etiqueta}>`, "g");
  return xml.match(re) || [];
}

function rgbDe(fragmento) {
  if (!fragmento) return "";
  const rgb = /\brgb="([A-Fa-f0-9]{8})"/i.exec(fragmento) || /\brgb="([A-Fa-f0-9]{6})"/i.exec(fragmento);
  if (rgb) return rgb[1].slice(-6).toUpperCase();
  const last = /\blastClr="([A-Fa-f0-9]{6})"/i.exec(fragmento);
  if (last) return last[1].toUpperCase();
  const srgb = /\bsrgbClr val="([A-Fa-f0-9]{6})"/i.exec(fragmento);
  if (srgb) return srgb[1].toUpperCase();
  return "";
}

function temaColores(themeXml) {
  const esquema = themeXml ? /<a:clrScheme[\s\S]*?<\/a:clrScheme>/.exec(themeXml)?.[0] || "" : "";
  const nombres = ["dk1", "lt1", "dk2", "lt2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"];
  return nombres.map((nombre) => {
    const bloque = new RegExp(`<a:${nombre}>[\\s\\S]*?</a:${nombre}>`).exec(esquema)?.[0] || "";
    return rgbDe(bloque) || "000000";
  });
}

function luminancia(hex) {
  const n = Number.parseInt(hex, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function aplicarTinte(hex, tinte) {
  if (!hex || !tinte) return hex ? `#${hex}` : "";
  const n = Number.parseInt(hex, 16);
  let r = ((n >> 16) & 255) / 255;
  let g = ((n >> 8) & 255) / 255;
  let b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  let l = (max + min) / 2;
  const d = max - min;
  if (d) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  l = tinte < 0 ? l * (1 + tinte) : l * (1 - tinte) + tinte;
  function canal(p, q, t) {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  r = Math.round(canal(p, q, h + 1 / 3) * 255);
  g = Math.round(canal(p, q, h) * 255);
  b = Math.round(canal(p, q, h - 1 / 3) * 255);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function colorCss(fragmento, temas) {
  if (!fragmento) return "";
  const tema = /\btheme="(\d+)"/.exec(fragmento);
  const tinte = /\btint="(-?[\d.]+)"/.exec(fragmento);
  let hex = "";
  if (tema) hex = temas[Number(tema[1])] || "";
  else if (/\bindexed="(\d+)"/.test(fragmento)) {
    const indice = Number(/\bindexed="(\d+)"/.exec(fragmento)[1]);
    if (indice === 64) return "";
    hex = INDEXED[indice] || "";
  } else hex = rgbDe(fragmento);
  if (!hex) return "";
  return aplicarTinte(hex, tinte ? Number(tinte[1]) : 0);
}

function leerEstilos(stylesXml, themeXml) {
  const temas = temaColores(themeXml);
  const formatos = { ...FORMATOS_BASE };
  for (const item of (stylesXml.match(/<numFmt\b[^>]*\/>/g) || [])) {
    const id = /\bnumFmtId="(\d+)"/.exec(item);
    const codigo = /\bformatCode="([^"]*)"/.exec(item);
    if (id && codigo) formatos[id[1]] = decodificar(codigo[1]);
  }
  const fuentes = bloques(stylesXml.match(/<fonts\b[\s\S]*?<\/fonts>/)?.[0] || "", "font").map((fuente) => ({
    bold: /<b\b/.test(fuente),
    italic: /<i\b/.test(fuente),
    size: Number((/\bsz val="([\d.]+)"/.exec(fuente) || [])[1] || 11),
    color: colorCss((/<color\b[^>]*\/?>/.exec(fuente) || [])[0], temas),
  }));
  const rellenos = bloques(stylesXml.match(/<fills\b[\s\S]*?<\/fills>/)?.[0] || "", "fill").map((relleno) => {
    if (!/patternType="solid"/.test(relleno)) return "";
    const fg = /<fgColor\b[^>]*\/?>/.exec(relleno)?.[0] || /<bgColor\b[^>]*\/?>/.exec(relleno)?.[0];
    return colorCss(fg, temas);
  });
  const xfs = bloques(stylesXml.match(/<cellXfs\b[\s\S]*?<\/cellXfs>/)?.[0] || "", "xf").map((xf) => {
    const fuente = fuentes[Number((/\bfontId="(\d+)"/.exec(xf) || [])[1] || 0)] || fuentes[0] || {};
    const relleno = rellenos[Number((/\bfillId="(\d+)"/.exec(xf) || [])[1] || 0)] || "";
    const formato = formatos[(/\bnumFmtId="(\d+)"/.exec(xf) || [])[1] || "0"] || "general";
    const alineado = (/\bhorizontal="([^"]+)"/.exec(xf) || [])[1] || "";
    const color = fuente.color || "";
    const fondo = relleno || "";
    return {
      bg: fondo,
      color: color || (fondo && luminancia(fondo.slice(1)) < 0.45 ? "#ffffff" : ""),
      bold: Boolean(fuente.bold),
      italic: Boolean(fuente.italic),
      size: fuente.size || 11,
      align: alineado === "center" || alineado === "right" ? alineado : "",
      formato,
    };
  });
  const dxfs = bloques(stylesXml.match(/<dxfs\b[\s\S]*?<\/dxfs>/)?.[0] || "", "dxf").map((dxf) => ({
    bg: colorCss((/<bgColor\b[^>]*\/?>/.exec(dxf) || /<fgColor\b[^>]*\/?>/.exec(dxf) || [])[0], temas),
    color: colorCss((/<font\b[\s\S]*?<\/font>/.exec(dxf)?.[0]?.match(/<color\b[^>]*\/?>/) || [])[0], temas),
  }));
  if (!xfs.length) xfs.push({ bg: "", color: "", bold: false, italic: false, size: 11, align: "", formato: "general" });
  return { estilos: xfs, dxfs };
}

function formatear(valor, formato) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return valor;
  const f = String(formato || "general");
  const bajo = f.toLowerCase();
  if (bajo.includes("yy")) {
    const ms = Date.UTC(1899, 11, 30) + Math.round(n) * 86400000;
    const fecha = new Date(ms);
    if (Number.isNaN(fecha.getTime())) return valor;
    const dia = fecha.getUTCDate();
    const mes = fecha.getUTCMonth() + 1;
    const anio = fecha.getUTCFullYear();
    const d = bajo.indexOf("d");
    const m = bajo.indexOf("m");
    return d >= 0 && m >= 0 && d < m ? `${dia}/${mes}/${anio}` : `${mes}/${dia}/${anio}`;
  }
  const decimales = (/\.(0+)/.exec(f) || [])[1]?.length || 0;
  if (bajo.includes("%")) return `${(n * 100).toFixed(decimales)}%`;
  if (bajo === "general" || bajo === "0") {
    if (Math.abs(n - Math.round(n)) < 1e-6) return String(Math.round(n));
    return String(Math.round(n * 100) / 100);
  }
  const texto = n.toLocaleString("en-US", { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
  if (bajo.includes("bs")) return `Bs ${texto}`;
  if (f.includes("$")) return `${n < 0 ? "-" : ""}$${texto.replace("-", "")}`;
  return texto;
}

function anchoPx(width) {
  const n = Number(width);
  if (!Number.isFinite(n) || n <= 0) return 8;
  return Math.round(n * 8 + 5);
}

function leerAnchos(xml, cantidad) {
  const anchos = Array(cantidad).fill(DEF_ANCHO);
  const cols = xml.match(/<cols\b[\s\S]*?<\/cols>/)?.[0] || "";
  for (const col of cols.match(/<col\b[^>]*\/?>/g) || []) {
    const min = Number((/\bmin="(\d+)"/.exec(col) || [])[1] || 1);
    const max = Number((/\bmax="(\d+)"/.exec(col) || [])[1] || min);
    const ancho = /\bhidden="1"/.test(col) ? 8 : anchoPx((/\bwidth="([\d.]+)"/.exec(col) || [])[1] || 8.43);
    for (let i = min; i <= Math.min(max, cantidad); i++) anchos[i - 1] = ancho;
  }
  return anchos;
}

function puntoAncla(bloque) {
  return {
    col: Number((/<xdr:col>(\d+)<\/xdr:col>/.exec(bloque) || [])[1] || 0),
    colOff: Number((/<xdr:colOff>(\d+)<\/xdr:colOff>/.exec(bloque) || [])[1] || 0),
    row: Number((/<xdr:row>(\d+)<\/xdr:row>/.exec(bloque) || [])[1] || 0),
    rowOff: Number((/<xdr:rowOff>(\d+)<\/xdr:rowOff>/.exec(bloque) || [])[1] || 0),
  };
}

function pxDe(punto, anchos, altos) {
  let x = 0;
  for (let i = 0; i < punto.col && i < anchos.length; i++) x += anchos[i];
  x += punto.colOff * EMU;
  let y = 0;
  for (let i = 0; i < punto.row && i < altos.length; i++) y += altos[i];
  y += punto.rowOff * EMU;
  return { x, y };
}

function cachePuntos(bloque, numerico) {
  const salida = [];
  for (const punto of bloque.matchAll(/<c:pt\b[^>]*idx="(\d+)"[^>]*>[\s\S]*?<c:v>([^<]*)<\/c:v>/g)) {
    salida[Number(punto[1])] = numerico ? Number(decodificar(punto[2])) : decodificar(punto[2]);
  }
  return salida.filter((valor) => valor != null && valor !== "" && (!numerico || Number.isFinite(valor)));
}

function leerGrafico(xml) {
  const tituloXml = /<c:title\b[\s\S]*?<\/c:title>/.exec(xml)?.[0] || "";
  const titulo = [...tituloXml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => decodificar(m[1])).join("")
    || decodificar((/<c:v>([^<]*)<\/c:v>/.exec(tituloXml) || [])[1] || "");
  const direccion = (/<c:barDir val="([^"]+)"/.exec(xml) || [])[1] || "col";
  const series = [];
  for (const ser of xml.matchAll(/<c:ser\b[\s\S]*?<\/c:ser>/g)) {
    const cuerpo = ser[0];
    const cabeza = cuerpo.split(/<c:dLbls|<c:cat|<c:val/)[0];
    const tx = /<c:tx>([\s\S]*?)<\/c:tx>/.exec(cuerpo)?.[1] || "";
    const cat = /<c:cat>([\s\S]*?)<\/c:cat>/.exec(cuerpo)?.[1] || "";
    const val = /<c:val>([\s\S]*?)<\/c:val>/.exec(cuerpo)?.[1] || "";
    const categorias = cachePuntos(cat, false).slice(0, 24);
    const valores = cachePuntos(val, true).slice(0, 24);
    if (!valores.length) continue;
    series.push({
      nombre: decodificar((/<c:v>([^<]*)<\/c:v>/.exec(tx) || [])[1] || ""),
      color: `#${((/<a:srgbClr val="([A-Fa-f0-9]{6})"/.exec(cabeza) || [])[1] || "009BDE").toUpperCase()}`,
      categorias,
      valores,
    });
  }
  return { titulo, direccion, series };
}

function rangoDe(ref) {
  const partes = String(ref || "").split(":");
  const inicio = /^([A-Z]+)(\d+)$/.exec(partes[0] || "");
  const fin = /^([A-Z]+)(\d+)$/.exec(partes[1] || partes[0] || "");
  if (!inicio || !fin) return null;
  return {
    c1: numeroColumna(inicio[1]),
    r1: Number(inicio[2]),
    c2: numeroColumna(fin[1]),
    r2: Number(fin[2]),
  };
}

export async function leerHoja(buffer, pedida) {
  const zip = await JSZip.loadAsync(buffer);
  const workbook = await zip.file("xl/workbook.xml").async("string");
  const rels = await zip.file("xl/_rels/workbook.xml.rels").async("string");
  const hojas = hojasDelLibro(workbook).filter((hoja) => !hoja.nombre.startsWith("_xlnm") && !hoja.nombre.includes(":"));
  if (!hojas.length) throw new Error("El libro no tiene hojas");
  const elegida =
    hojas.find((hoja) => hoja.nombre === pedida) ||
    hojas.find((hoja) => !pedida && hoja.nombre === "Data_DCR") ||
    hojas[0];
  const ruta = rutaDe(rels, elegida.id);
  if (!ruta || !zip.file(ruta)) throw new Error("No se encontró esa hoja");
  const xml = await zip.file(ruta).async("string");
  const compartidas = zip.file("xl/sharedStrings.xml")
    ? leerCompartidas(await zip.file("xl/sharedStrings.xml").async("string"))
    : [];
  const { estilos, dxfs } = leerEstilos(
    zip.file("xl/styles.xml") ? await zip.file("xl/styles.xml").async("string") : "",
    zip.file("xl/theme/theme1.xml") ? await zip.file("xl/theme/theme1.xml").async("string") : ""
  );

  const celdas = new Map();
  const conteoCol = new Map();
  const altosHoja = new Map();
  let cortado = false;
  const bloque = /<sheetData\b[^>]*>([\s\S]*?)<\/sheetData>/.exec(xml);
  const fuente = bloque ? bloque[1] : "";
  const filaRe = /<row\b([^>]*)>([\s\S]*?)<\/row>/g;
  let fila;
  while ((fila = filaRe.exec(fuente))) {
    const numero = Number((/\br="(\d+)"/.exec(fila[1]) || [])[1] || 0);
    if (!numero) continue;
    if (numero > TOPE_FILAS) {
      if (!cortado && (/<v>/.test(fila[2]) || /<is\b/.test(fila[2]))) cortado = true;
      continue;
    }
    const ht = /\bht="([\d.]+)"/.exec(fila[1]);
    if (ht && /\bcustomHeight="1"/.test(fila[1])) altosHoja.set(numero, Math.round(Number(ht[1]) * 96 / 72));
    const mapa = new Map();
    const celdaRe = /<c\b([^>]*?)\br="([A-Z]+)(\d+)"([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let celda;
    while ((celda = celdaRe.exec(fila[2]))) {
      const columna = numeroColumna(celda[2]);
      const atributos = `${celda[1]} ${celda[4]}`;
      const leido = textoCelda(atributos, celda[5] || "", compartidas);
      if (!leido.texto && !/\bs="/.test(atributos)) continue;
      const estilo = Number((/\bs="(\d+)"/.exec(atributos) || [])[1] || 0);
      mapa.set(columna, { ...leido, estilo });
      conteoCol.set(columna, (conteoCol.get(columna) || 0) + 1);
    }
    if (mapa.size) celdas.set(numero, mapa);
  }

  const columnasPresentes = [...conteoCol.keys()].sort((a, b) => a - b);
  let minCol = columnasPresentes[0] || 1;
  let maxCol = minCol;
  let previo = minCol;
  for (const columna of columnasPresentes) {
    if (columna - previo > 25) break;
    maxCol = columna;
    previo = columna;
    if (maxCol - minCol > 160) break;
  }
  let maxFila = 0;
  for (const [numero, mapa] of celdas) {
    for (const columna of mapa.keys()) {
      if (columna >= minCol && columna <= maxCol) maxFila = Math.max(maxFila, numero);
    }
  }
  if (!maxFila) {
    return {
      hojas: hojas.map((hoja) => hoja.nombre),
      hoja: elegida.nombre,
      columnas: [],
      filas: [],
      estilos: [],
      pintadas: [],
      anchos: [],
      altos: [],
      merges: [],
      graficos: [],
      imagenes: [],
      filtro: null,
      cortado,
    };
  }

  const anchosTodas = leerAnchos(xml, maxCol);
  const anchos = anchosTodas.slice(minCol - 1, maxCol);
  const altos = [];
  for (let i = 1; i <= maxFila; i++) altos.push(altosHoja.get(i) || DEF_ALTO);
  const columnas = [];
  for (let col = minCol; col <= maxCol; col++) columnas.push(letrasColumna(col));
  const filas = [];
  const crudos = [];
  const pintadas = [];
  for (let r = 1; r <= maxFila; r++) {
    const mapa = celdas.get(r);
    const valores = [];
    const numeros = [];
    for (let c = minCol; c <= maxCol; c++) {
      const celda = mapa?.get(c);
      const estilo = estilos[celda?.estilo || 0] || estilos[0];
      const texto = celda ? (celda.numero ? formatear(celda.texto, estilo.formato) : celda.texto) : "";
      valores.push(texto);
      numeros.push(celda?.numero ? Number(celda.texto) : null);
      if (celda?.estilo) pintadas.push([r - 1, c - minCol, celda.estilo]);
    }
    filas.push(valores);
    crudos.push(numeros);
  }

  const estiloExtra = new Map();
  function estiloCon(base, dxf) {
    const clave = `${base}|${dxf.bg}|${dxf.color}`;
    if (estiloExtra.has(clave)) return estiloExtra.get(clave);
    const origen = estilos[base] || estilos[0];
    const fondo = dxf.bg || origen.bg;
    estilos.push({
      ...origen,
      bg: fondo,
      color: dxf.color || origen.color || (fondo && luminancia(fondo.slice(1)) < 0.45 ? "#ffffff" : origen.color),
    });
    const indice = estilos.length - 1;
    estiloExtra.set(clave, indice);
    return indice;
  }
  const pintura = new Map(pintadas.map(([r, c, s]) => [`${r},${c}`, s]));
  const reglas = [];
  for (const bloqueCf of xml.match(/<conditionalFormatting\b[^>]*>[\s\S]*?<\/conditionalFormatting>/g) || []) {
    const sqref = decodificar((/\bsqref="([^"]+)"/.exec(bloqueCf) || [])[1] || "");
    for (const regla of bloqueCf.match(/<cfRule\b[^>]*\/>|<cfRule\b[\s\S]*?<\/cfRule>/g) || []) {
      const tipo = (/\btype="([^"]+)"/.exec(regla) || [])[1];
      const operador = (/\boperator="([^"]+)"/.exec(regla) || [])[1] || "";
      const prioridad = Number((/\bpriority="(\d+)"/.exec(regla) || [])[1] || 0);
      const dxfId = Number((/\bdxfId="(\d+)"/.exec(regla) || [])[1] || -1);
      const formula = decodificar((/<formula>([^<]*)<\/formula>/.exec(regla) || [])[1] || "");
      if (tipo !== "duplicateValues" && !(tipo === "cellIs" && operador === "greaterThan")) continue;
      reglas.push({ tipo, prioridad, dxf: dxfs[dxfId], sqref, formula });
    }
  }
  reglas.sort((a, b) => b.prioridad - a.prioridad);
  for (const regla of reglas) {
    if (!regla.dxf || (!regla.dxf.bg && !regla.dxf.color)) continue;
    for (const ref of regla.sqref.split(/\s+/)) {
      const rango = rangoDe(ref);
      if (!rango) continue;
      if (regla.tipo === "duplicateValues") {
        const cuentas = new Map();
        for (let r = rango.r1; r <= Math.min(rango.r2, maxFila); r++) {
          for (let c = rango.c1; c <= rango.c2; c++) {
            const texto = filas[r - 1]?.[c - minCol] || "";
            if (texto) cuentas.set(texto, (cuentas.get(texto) || 0) + 1);
          }
        }
        for (let r = rango.r1; r <= Math.min(rango.r2, maxFila); r++) {
          for (let c = rango.c1; c <= rango.c2; c++) {
            const texto = filas[r - 1]?.[c - minCol] || "";
            if (texto && cuentas.get(texto) > 1) {
              const clave = `${r - 1},${c - minCol}`;
              pintura.set(clave, estiloCon(pintura.get(clave) || 0, regla.dxf));
            }
          }
        }
      } else if (/^-?\d+(\.\d+)?$/.test(regla.formula)) {
        const umbral = Number(regla.formula);
        for (let r = rango.r1; r <= Math.min(rango.r2, maxFila); r++) {
          for (let c = Math.max(rango.c1, minCol); c <= Math.min(rango.c2, maxCol); c++) {
            const numero = crudos[r - 1]?.[c - minCol];
            if (numero != null && numero > umbral) {
              const clave = `${r - 1},${c - minCol}`;
              pintura.set(clave, estiloCon(pintura.get(clave) || 0, regla.dxf));
            }
          }
        }
      }
    }
  }

  const merges = [];
  for (const merge of xml.match(/<mergeCell\b[^>]*ref="([^"]+)"/g) || []) {
    const ref = /ref="([^"]+)"/.exec(merge)?.[1];
    const rango = rangoDe(ref);
    if (!rango) continue;
    if (rango.r2 < 1 || rango.r1 > maxFila || rango.c2 < minCol || rango.c1 > maxCol) continue;
    merges.push({
      r: Math.max(rango.r1, 1) - 1,
      c: Math.max(rango.c1, minCol) - minCol,
      filas: Math.min(rango.r2, maxFila) - Math.max(rango.r1, 1) + 1,
      columnas: Math.min(rango.c2, maxCol) - Math.max(rango.c1, minCol) + 1,
    });
  }

  const filtroRef = rangoDe((/<autoFilter\b[^>]*ref="([^"]+)"/.exec(xml) || [])[1] || "");
  const filtro = filtroRef && filtroRef.r1 <= maxFila
    ? { fila: filtroRef.r1 - 1, desde: Math.max(filtroRef.c1, minCol) - minCol, hasta: Math.min(filtroRef.c2, maxCol) - minCol }
    : null;

  const origenX = anchosTodas.slice(0, minCol - 1).reduce((suma, ancho) => suma + ancho, 0);
  const graficos = [];
  const imagenes = [];
  const relHoja = ruta.replace(/\/([^/]+)$/, "/_rels/$1.rels");
  const relXml = zip.file(relHoja) ? await zip.file(relHoja).async("string") : "";
  const drawingId = (/<drawing\b[^>]*r:id="([^"]+)"/.exec(xml) || [])[1];
  const drawingTarget = drawingId ? resolver(ruta, (new RegExp(`Id="${drawingId}"[^>]*Target="([^"]+)"`).exec(relXml) || [])[1]) : "";
  if (drawingTarget && zip.file(drawingTarget)) {
    const drawing = await zip.file(drawingTarget).async("string");
    const drawingRelsPath = drawingTarget.replace(/\/([^/]+)$/, "/_rels/$1.rels");
    const drawingRels = zip.file(drawingRelsPath) ? await zip.file(drawingRelsPath).async("string") : "";
    const anclas = drawing.match(/<xdr:(?:twoCellAnchor|oneCellAnchor)\b[\s\S]*?<\/xdr:(?:twoCellAnchor|oneCellAnchor)>/g) || [];
    for (const ancla of anclas) {
      const desde = puntoAncla((/<xdr:from>[\s\S]*?<\/xdr:from>/.exec(ancla) || [])[0] || "");
      const hasta = puntoAncla((/<xdr:to>[\s\S]*?<\/xdr:to>/.exec(ancla) || [])[0] || "");
      const a = pxDe(desde, anchosTodas, altos);
      const b = pxDe(hasta, anchosTodas, altos);
      const caja = {
        x: Math.round(a.x - origenX),
        y: Math.round(a.y),
        w: Math.max(32, Math.round(b.x - a.x)),
        h: Math.max(24, Math.round(b.y - a.y)),
      };
      if (caja.w < 40 || caja.h < 40 || caja.y > altos.reduce((s, n) => s + n, 0) + 40) continue;
      const chartId = (/<c:chart\b[^>]*r:id="([^"]+)"/.exec(ancla) || [])[1];
      const blipId = (/<a:blip\b[^>]*r:embed="([^"]+)"/.exec(ancla) || [])[1];
      if (chartId) {
        const chartPath = resolver(drawingTarget, (new RegExp(`Id="${chartId}"[^>]*Target="([^"]+)"`).exec(drawingRels) || [])[1]);
        if (!chartPath || !zip.file(chartPath)) continue;
        const grafico = leerGrafico(await zip.file(chartPath).async("string"));
        if (grafico.series.length) graficos.push({ ...grafico, ...caja });
      } else if (blipId) {
        const imgPath = resolver(drawingTarget, (new RegExp(`Id="${blipId}"[^>]*Target="([^"]+)"`).exec(drawingRels) || [])[1]);
        const archivo = imgPath ? zip.file(imgPath) : null;
        if (!archivo) continue;
        const bytes = await archivo.async("nodebuffer");
        if (bytes.length > 900000) continue;
        const tipo = imgPath.endsWith(".jpg") || imgPath.endsWith(".jpeg") ? "image/jpeg" : "image/png";
        imagenes.push({ ...caja, tipo, datos: bytes.toString("base64") });
      }
    }
  }

  const pintadasLista = [...pintura.entries()]
    .filter(([, estilo]) => estilo)
    .map(([clave, estilo]) => {
      const [r, c] = clave.split(",").map(Number);
      return [r, c, estilo];
    });

  return {
    hojas: hojas.map((hoja) => hoja.nombre),
    hoja: elegida.nombre,
    columnas,
    filas,
    estilos,
    pintadas: pintadasLista.length > 20000 ? pintadasLista.filter(([r]) => r < 2) : pintadasLista,
    anchos,
    altos,
    merges: merges.filter((merge) => merge.filas > 0 && merge.columnas > 0 && (merge.filas > 1 || merge.columnas > 1)),
    graficos,
    imagenes,
    filtro,
    cortado,
  };
}
