// Cuenta tiendas cubiertas en Cobertura LK7 y agrega la suma de LK7K en SHOP.
// No abre Excel. No publica el IMEI. Solo cambia la hoja SHOP y agrega Pronostico.

import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";

const LIBRO =
  process.env.COBERTURA_LIBRO ||
  "C:\\Users\\daxke\\Downloads\\_Temp\\Tecno\\Reportes\\Cobertura\\Cobertura LK7 31-08.xlsx";
const RESUMEN =
  process.env.COBERTURA_RESUMEN ||
  "C:\\Users\\daxke\\Downloads\\_Temp\\Tecno\\Reportes\\Cobertura\\numeros.json";
const CIERRE = process.env.COBERTURA_CIERRE || "2026-10-20";
const RANGO_VIEJO = 113070;

function xml(texto) {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function decode(texto) {
  return String(texto)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}

function textosCompartidos(documento) {
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

function valorCelda(attrs, inner, cadenas) {
  if (!inner) return "";
  if (attrs.includes('t="inlineStr"') || attrs.includes("t='inlineStr'")) {
    const texto = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/);
    return texto ? decode(texto[1]) : "";
  }
  const v = inner.match(/<v>([\s\S]*?)<\/v>/);
  if (!v) return "";
  const crudo = decode(v[1]);
  if (attrs.includes('t="s"') || attrs.includes("t='s'")) return cadenas[Number(crudo)] ?? "";
  if (attrs.includes('t="b"')) return crudo === "1" ? "TRUE" : "FALSE";
  return crudo;
}

function mapaFila(rowXml, cadenas) {
  const celdas = new Map();
  const re = /<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  let encontrado;
  while ((encontrado = re.exec(rowXml))) {
    celdas.set(encontrado[1], valorCelda(encontrado[3], encontrado[4] || "", cadenas));
  }
  return celdas;
}

function serialIso(iso) {
  const ms = Date.parse(`${iso}T00:00:00Z`);
  return Math.round((ms - Date.UTC(1899, 11, 30)) / 86400000);
}

function isoDeSerial(serial) {
  const ms = Date.UTC(1899, 11, 30) + serial * 86400000;
  return new Date(ms).toISOString().slice(0, 10);
}

function fechaDe(valor) {
  const texto = String(valor || "").trim();
  if (!texto) return null;
  if (/^\d+(\.\d+)?$/.test(texto)) {
    const serial = Math.floor(Number(texto));
    return serial > 20000 ? serial : null;
  }
  const iso = texto.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return serialIso(iso);
  return null;
}

function esTop(valor) {
  const texto = String(valor || "").trim().toUpperCase();
  if (!texto || texto === "FALSE" || texto === "0" || texto === "NO") return false;
  return true;
}

function proyectar(cubiertas, nuevas, total, diasFaltan) {
  const ritmo = nuevas / 7;
  const cierre = Math.min(total, Math.round(cubiertas + ritmo * diasFaltan));
  const pct = total ? Math.round((cubiertas / total) * 1000) / 10 : 0;
  return { cubiertas, nuevas7: nuevas, ritmo: Math.round(ritmo * 10) / 10, cierre, total, pct };
}

function columnaTop(encabezados) {
  for (const [columna, titulo] of encabezados.entries()) {
    if (String(titulo).toUpperCase().includes("300")) return columna;
  }
  return "E";
}

function colPorTitulo(encabezados, predicado) {
  for (const [columna, titulo] of encabezados.entries()) {
    if (predicado(String(titulo || "").trim().toLowerCase())) return columna;
  }
  return null;
}

function pctTabla(parte, total) {
  if (!total) return 0;
  return Math.round((parte / total) * 1000) / 10;
}

function tituloCiudadShop(texto) {
  const crudo = String(texto || "").trim();
  if (!crudo) return "(sin ciudad)";
  const lower = crudo.toLowerCase();
  if (lower.includes("el alto")) return "El Alto";
  if (lower.includes("la paz")) return "La Paz";
  if (lower.includes("santa cruz")) return "Santa Cruz";
  if (lower.includes("cochabamba")) return "Cochabamba";
  return crudo;
}

function agruparTablasCobertura(tiendas, soloTop) {
  const grupos = new Map();
  for (const t of tiendas) {
    if (soloTop && !t.top) continue;
    const ciudad = t.ciudad || "(sin ciudad)";
    const circuito = t.circuito || "(sin circuito)";
    const llave = `${ciudad}\t${circuito}`;
    if (!grupos.has(llave)) {
      grupos.set(llave, {
        ciudad,
        circuito,
        totalTiendas: 0,
        lk7: 0,
        lambo: 0,
        lk7k: 0,
        stockLk7: 0,
        stockLk6: 0,
      });
    }
    const g = grupos.get(llave);
    g.totalTiendas += 1;
    if (t.tieneLk7) g.lk7 += 1;
    if (t.tieneLambo) g.lambo += 1;
    if (t.tieneLk7k) g.lk7k += 1;
    g.stockLk7 += t.stockLk7 || 0;
    g.stockLk6 += t.stockLk6 || 0;
  }
  const porCiudad = new Map();
  for (const g of grupos.values()) {
    if (!porCiudad.has(g.ciudad)) porCiudad.set(g.ciudad, []);
    porCiudad.get(g.ciudad).push(g);
  }
  const salida = [];
  for (const ciudad of [...porCiudad.keys()].sort((a, b) => a.localeCompare(b, "es"))) {
    const circuitos = porCiudad.get(ciudad).sort((a, b) => a.circuito.localeCompare(b.circuito, "es"));
    let tot = 0;
    let lk7 = 0;
    let lambo = 0;
    let lk7k = 0;
    let stockLk7 = 0;
    let stockLk6 = 0;
    for (const c of circuitos) {
      salida.push({
        ciudad,
        circuito: c.circuito,
        totalTiendas: c.totalTiendas,
        lk7: c.lk7,
        lambo: c.lambo,
        pctLk7: pctTabla(c.lk7, c.totalTiendas),
        pctLk7k: pctTabla(c.lk7k, c.totalTiendas),
        stockLk7: c.stockLk7,
        stockLk6: c.stockLk6,
        esTotal: false,
      });
      tot += c.totalTiendas;
      lk7 += c.lk7;
      lambo += c.lambo;
      lk7k += c.lk7k;
      stockLk7 += c.stockLk7;
      stockLk6 += c.stockLk6;
    }
    salida.push({
      ciudad: `${ciudad} Total`,
      circuito: "",
      totalTiendas: tot,
      lk7,
      lambo,
      pctLk7: pctTabla(lk7, tot),
      pctLk7k: pctTabla(lk7k, tot),
      stockLk7,
      stockLk6,
      esTotal: true,
    });
  }
  return salida;
}

function leerTiendas(shopXml, cadenas) {
  const tiendas = [];
  const muestras = new Set();
  const re = /<row r="(\d+)"[^>]*>[\s\S]*?<\/row>/g;
  let fila1 = null;
  let topCol = "E";
  let deptCol = "D";
  let circCol = "J";
  let lk7Col = "K";
  let lamboCol = "L";
  let lk7kCol = "N";
  let encontrado;
  while ((encontrado = re.exec(shopXml))) {
    const celdas = mapaFila(encontrado[0], cadenas);
    if (encontrado[1] === "1") {
      fila1 = celdas;
      topCol = columnaTop(fila1);
      deptCol =
        colPorTitulo(fila1, (h) => h.includes("departament") || h === "departamento") || "D";
      circCol =
        colPorTitulo(fila1, (h) => /^[a-z]{2,4}-?\d/.test(h) || h === "circuito") ||
        colPorTitulo(fila1, (h) => h.includes("concatenar")) ||
        "J";
      // Prefer short circuit column: scan later from data; default J
      lk7Col =
        colPorTitulo(fila1, (h) => h === "lk7") ||
        colPorTitulo(fila1, (h) => h.includes("lk7") && !h.includes("lk7k") && !h.includes("(l)")) ||
        "K";
      lamboCol =
        colPorTitulo(fila1, (h) => h.includes("lk7") && (h.includes("(l)") || h.includes("lambo"))) ||
        "L";
      lk7kCol = colPorTitulo(fila1, (h) => h.includes("lk7k")) || "N";
      continue;
    }
    const id = String(celdas.get("A") || "").trim();
    if (!id) continue;
    const marca = String(celdas.get(topCol) || "").trim();
    if (marca && muestras.size < 8 && marca.length < 24) muestras.add(marca);
    let circuito = String(celdas.get(circCol) || "").trim();
    if (!/^[A-Z]{2,4}-?\d+/i.test(circuito)) {
      const concat = String(celdas.get(circCol) || "");
      const m = concat.match(/\/([A-Z]{2,4}-?\d+)\//i);
      if (m) circuito = m[1];
    }
    // Si circCol quedó en concatenar, buscar columna con código corto en esta fila
    if (!/^[A-Z]{2,4}-?\d+/i.test(circuito)) {
      for (const [col, val] of celdas.entries()) {
        if (/^[A-Z]{2,4}-?\d{1,3}$/i.test(String(val || "").trim())) {
          circuito = String(val).trim();
          break;
        }
      }
    }
    const nLk7 = Number(celdas.get(lk7Col) || 0) || 0;
    const nLambo = Number(celdas.get(lamboCol) || 0) || 0;
    const nLk7k = Number(celdas.get(lk7kCol) || 0) || 0;
    tiendas.push({
      id: id.toUpperCase(),
      top: esTop(marca),
      ciudad: tituloCiudadShop(celdas.get(deptCol)),
      circuito: circuito || "(sin circuito)",
      tieneLk7: nLk7 > 0,
      tieneLambo: nLambo > 0,
      tieneLk7k: nLk7k > 0,
      stockLk7: nLk7,
      stockLk6: 0,
    });
  }
  return { tiendas, encabezados: fila1, topCol, muestras: [...muestras] };
}

function acumularDatos(stream, cadenas, conocidas) {
  return new Promise((resolve, reject) => {
    const stock = new Map();
    const primera = new Map();
    let ultima = 1;
    let filas = 0;
    let modeloJ = false;
    let resto = "";
    const asegurar = (id) => {
      if (!stock.has(id)) stock.set(id, { lk7: 0, lambo: 0, lk7k: 0 });
      return stock.get(id);
    };
    const tocar = (id, corte, dia) => {
      if (dia == null) return;
      const llave = `${id}\t${corte}`;
      const previa = primera.get(llave);
      if (previa == null || dia < previa) primera.set(llave, dia);
    };
    const procesar = (rowXml) => {
      const numero = Number(rowXml.match(/<row r="(\d+)"/)?.[1] || 0);
      if (numero > ultima) ultima = numero;
      if (numero <= 1) {
        if (numero === 1) {
          const celdas = mapaFila(rowXml, cadenas);
          modeloJ = String(celdas.get("J") || "").trim().toLowerCase() === "model";
        }
        return;
      }
      filas += 1;
      const utiles = new Map();
      const re = /<c r="([DJMRS])(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
      let celda;
      while ((celda = re.exec(rowXml))) utiles.set(celda[1], valorCelda(celda[3], celda[4] || "", cadenas));
      const id = String(utiles.get("D") || "").trim().toUpperCase();
      if (!id || !conocidas.has(id)) return;
      const modelo = String(utiles.get("J") || "").trim().toUpperCase();
      const cantidad = Number(utiles.get("R") || 0);
      if (!Number.isFinite(cantidad) || cantidad <= 0) return;
      const dia = fechaDe(utiles.get("S"));
      const cuenta = asegurar(id);
      if (modelo === "LK7") {
        cuenta.lk7 += cantidad;
        tocar(id, "lk7", dia);
        if (String(utiles.get("M") || "").trim().toUpperCase() === "LAMBORGHINI BLACK") {
          cuenta.lambo += cantidad;
          tocar(id, "lambo", dia);
        }
      } else if (modelo === "LK7K") {
        cuenta.lk7k += cantidad;
        tocar(id, "lk7k", dia);
      }
    };
    stream.on("data", (buf) => {
      resto += buf.toString("utf8");
      let inicio;
      while ((inicio = resto.indexOf("<row ")) !== -1) {
        const fin = resto.indexOf("</row>", inicio);
        if (fin === -1) break;
        procesar(resto.slice(inicio, fin + 6));
        resto = resto.slice(fin + 6);
      }
    });
    stream.on("end", () => resolve({ stock, primera, ultima, filas, modeloJ }));
    stream.on("error", reject);
  });
}

function corteDe(tiendas, stock, primera, corte, desde, hasta) {
  const grupos = {
    todas: { total: 0, cubiertas: 0, nuevas: 0, cantidad: 0 },
    top300: { total: 0, cubiertas: 0, nuevas: 0, cantidad: 0 },
  };
  for (const tienda of tiendas) {
    const cuenta = stock.get(tienda.id);
    const cantidad = cuenta?.[corte] || 0;
    const dia = primera.get(`${tienda.id}\t${corte}`);
    const cubierta = cantidad > 0;
    const nueva = cubierta && dia != null && dia >= desde && dia <= hasta;
    for (const nombre of tienda.top ? ["todas", "top300"] : ["todas"]) {
      grupos[nombre].total += 1;
      grupos[nombre].cantidad += cantidad;
      if (cubierta) grupos[nombre].cubiertas += 1;
      if (nueva) grupos[nombre].nuevas += 1;
    }
  }
  return grupos;
}

function hojaPronostico(filas) {
  const encabezado = ["Grupo", "Corte", "Tiendas", "Cubiertas", "Porcentaje", "Nuevas 7 días", "Ritmo diario", "Días que faltan", "Cubiertas al cierre", "Cantidad"];
  const lineas = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>',
  ];
  const escribir = (fila, valores) => {
    const celdas = valores.map((valor, indice) => {
      const col = String.fromCharCode(65 + indice);
      if (typeof valor === "number") return `<c r="${col}${fila}"><v>${valor}</v></c>`;
      return `<c r="${col}${fila}" t="inlineStr"><is><t>${xml(valor)}</t></is></c>`;
    });
    lineas.push(`<row r="${fila}">${celdas.join("")}</row>`);
  };
  escribir(1, encabezado);
  filas.forEach((fila, indice) => escribir(indice + 2, fila));
  lineas.push("</sheetData></worksheet>");
  return lineas.join("");
}

function asegurarHoja(zip, workbook, rels, tipos, nombre, xmlHoja) {
  const existente = workbook.match(new RegExp(`<sheet[^>]*name="${nombre}"[^>]*>`));
  if (existente) {
    const ruta = rutaHoja(workbook, rels, nombre);
    zip.file(ruta, xmlHoja, { createFolders: false });
    return { workbook, rels, tipos };
  }
  const ids = [...workbook.matchAll(/sheetId="(\d+)"/g)].map((m) => Number(m[1]));
  const relIds = [...rels.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1]));
  const sheetId = Math.max(0, ...ids) + 1;
  const relId = `rId${Math.max(0, ...relIds) + 1}`;
  const usados = [...rels.matchAll(/worksheets\/sheet(\d+)\.xml/g)].map((m) => Number(m[1]));
  const numero = Math.max(0, ...usados) + 1;
  const ruta = `xl/worksheets/sheet${numero}.xml`;
  zip.file(ruta, xmlHoja, { createFolders: false });
  const libro = workbook.replace(
    "</sheets>",
    `<sheet name="${nombre}" sheetId="${sheetId}" r:id="${relId}"/></sheets>`,
  );
  const relaciones = rels.replace(
    "</Relationships>",
    `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${numero}.xml"/></Relationships>`,
  );
  const contenido = tipos.replace(
    "</Types>",
    `<Override PartName="/xl/worksheets/sheet${numero}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
  );
  return { workbook: libro, rels: relaciones, tipos: contenido };
}

function alargarShop(shopXml, fin) {
  let xmlHoja = shopXml.replaceAll(`$${RANGO_VIEJO}`, `$${fin}`);
  if (!xmlHoja.includes("<f>SUMIFS(Datos!$R$2:$R$")) throw new Error("SHOP no tiene la suma de LK7");
  xmlHoja = xmlHoja.replace(/<dimension[^>]*ref="([^"]+)"/, (todo, ref) => {
    const [desde, hasta] = ref.split(":");
    const fila = hasta.replace(/[A-Z]/g, "");
    return todo.replace(ref, `${desde}:N${fila}`);
  });
  xmlHoja = xmlHoja.replace(/<row r="(\d+)"([^>]*)>([\s\S]*?)<\/row>/g, (todo, num, attrs, inner) => {
    if (inner.includes(` r="N${num}"`)) return todo;
    if (num === "1") {
      return `<row r="1"${attrs}>${inner}<c r="N1" t="inlineStr"><is><t>LK7K</t></is></c></row>`;
    }
    if (!inner.includes('"LK7"')) return todo;
    const formula = `SUMIFS(Datos!$R$2:$R$${fin},Datos!$D$2:$D$${fin},$A${num},Datos!$J$2:$J$${fin},"LK7K")`;
    return `<row r="${num}"${attrs}>${inner}<c r="N${num}"><f>${formula}</f></c></row>`;
  });
  return xmlHoja;
}

const zip = await JSZip.loadAsync(fs.readFileSync(LIBRO));
for (const nombre of Object.keys(zip.files)) {
  if (zip.files[nombre].dir) delete zip.files[nombre];
}
const workbookXml = await zip.file("xl/workbook.xml").async("string");
const relsXml = await zip.file("xl/_rels/workbook.xml.rels").async("string");
const tiposXml = await zip.file("[Content_Types].xml").async("string");
const cadenas = textosCompartidos(await zip.file("xl/sharedStrings.xml").async("string"));
const shopPath = rutaHoja(workbookXml, relsXml, "SHOP");
const datosPath = rutaHoja(workbookXml, relsXml, "Datos");
const shopXml = await zip.file(shopPath).async("string");
const { tiendas, encabezados, topCol, muestras } = leerTiendas(shopXml, cadenas);
console.log(`top ${topCol} muestras ${muestras.join(", ")}`);
console.log([...encabezados.entries()].map(([col, titulo]) => `${col}:${titulo}`).join(" | "));
const conocidas = new Set(tiendas.map((tienda) => tienda.id));
console.log(`tiendas ${tiendas.length}`);
const datos = await acumularDatos(zip.file(datosPath).nodeStream(), cadenas, conocidas);
if (!datos.modeloJ) throw new Error("La columna J de Datos no es Model");
const hoy = Math.max(0, ...[...datos.primera.values()]);
const desde = hoy - 6;
const diasFaltan = Math.max(0, serialIso(CIERRE) - hoy);
const cortes = [
  ["lk7", "LK7"],
  ["lambo", "LK7 Lamborghini Black"],
  ["lk7k", "LK7K"],
];
// Completar flags/stock desde Datos (cantidades reales)
for (const tienda of tiendas) {
  const cuenta = datos.stock.get(tienda.id);
  if (!cuenta) continue;
  if (cuenta.lk7 > 0) {
    tienda.tieneLk7 = true;
    tienda.stockLk7 = cuenta.lk7;
  }
  if (cuenta.lambo > 0) tienda.tieneLambo = true;
  if (cuenta.lk7k > 0) tienda.tieneLk7k = true;
}

const resumen = {
  generado: new Date().toISOString(),
  ultimaFilaDatos: datos.ultima,
  filasDatos: datos.filas,
  tiendas: tiendas.length,
  top300: tiendas.filter((tienda) => tienda.top).length,
  referencia: hoy ? isoDeSerial(hoy) : "",
  diasFaltan,
  cierre: CIERRE,
  grupos: {},
  tablaTodas: agruparTablasCobertura(tiendas, false),
  tablaTop300: agruparTablasCobertura(tiendas, true),
};
const filasHoja = [];
for (const [corte, titulo] of cortes) {
  const grupos = corteDe(tiendas, datos.stock, datos.primera, corte, desde, hoy);
  resumen.grupos[corte] = {};
  for (const [grupo, cuenta] of Object.entries(grupos)) {
    const proyeccion = proyectar(cuenta.cubiertas, cuenta.nuevas, cuenta.total, diasFaltan);
    resumen.grupos[corte][grupo] = { ...proyeccion, cantidad: cuenta.cantidad };
    filasHoja.push([
      grupo,
      titulo,
      cuenta.total,
      proyeccion.cubiertas,
      proyeccion.pct,
      proyeccion.nuevas7,
      proyeccion.ritmo,
      diasFaltan,
      proyeccion.cierre,
      cuenta.cantidad,
    ]);
  }
}
fs.writeFileSync(RESUMEN, JSON.stringify(resumen, null, 2));
console.log(JSON.stringify({ referencia: resumen.referencia, diasFaltan, ultima: datos.ultima, grupos: resumen.grupos }));

const fin = Math.max(RANGO_VIEJO, datos.ultima);
const shopNuevo = alargarShop(shopXml, fin);
const pronostico = hojaPronostico([
  ...filasHoja,
  ["", `Referencia ${resumen.referencia}. El ritmo es tiendas nuevas en 7 días. El cierre no pasa del total.`, "", "", "", "", "", "", "", ""],
]);
const hojas = asegurarHoja(zip, workbookXml, relsXml, tiposXml, "Pronostico", pronostico);
let libro = hojas.workbook;
if (!libro.includes("fullCalcOnLoad")) {
  libro = libro.replace("<calcPr", '<calcPr fullCalcOnLoad="1"');
}
zip.file(shopPath, shopNuevo, { createFolders: false });
zip.file("xl/workbook.xml", libro, { createFolders: false });
zip.file("xl/_rels/workbook.xml.rels", hojas.rels, { createFolders: false });
zip.file("[Content_Types].xml", hojas.tipos, { createFolders: false });
for (const nombre of Object.keys(zip.files)) {
  if (zip.files[nombre].dir) delete zip.files[nombre];
}
const temporal = `${LIBRO}.tmp`;
const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
fs.writeFileSync(temporal, buffer);
try {
  fs.renameSync(temporal, LIBRO);
  console.log(`libro ${buffer.length}`);
} catch (error) {
  if (error?.code !== "EPERM" && error?.code !== "EBUSY") throw error;
  const alLado = LIBRO.replace(/\.xlsx$/i, " actualizado.xlsx");
  fs.copyFileSync(temporal, alLado);
  fs.unlinkSync(temporal);
  console.log(`excel abierto, guardado al lado ${buffer.length}`);
}
