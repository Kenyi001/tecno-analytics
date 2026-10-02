// Tablas "Todas las tiendas" y "Tiendas Top 300" (Hoja2 / SHOP).

import { leerHoja } from "./libro";

function pct(parte, total) {
  if (!total) return 0;
  return Math.round((parte / total) * 1000) / 10;
}

function tituloCiudad(texto) {
  const crudo = String(texto || "").trim();
  if (!crudo) return "";
  const lower = crudo.toLowerCase();
  if (lower.includes("el alto")) return "El Alto";
  if (lower.includes("la paz")) return "La Paz";
  if (lower.includes("santa cruz")) return "Santa Cruz";
  if (lower.includes("cochabamba")) return "Cochabamba";
  return crudo;
}

function filaVacia(f) {
  return {
    ciudad: f.ciudad || "",
    circuito: f.circuito || "",
    totalTiendas: f.totalTiendas || 0,
    lk7: f.lk7 || 0,
    lambo: f.lambo || 0,
    pctLk7: f.pctLk7 ?? 0,
    pctLk7k: f.pctLk7k ?? 0,
    stockLk7: f.stockLk7 || 0,
    stockLk6: f.stockLk6 || 0,
    esTotal: Boolean(f.esTotal),
  };
}

/** Parsea las dos tablas lado a lado de Hoja2. */
export async function tablasDesdeHoja2(buffer) {
  const hoja = await leerHoja(buffer, "Hoja2");
  const filas = hoja.filas || [];
  const tablaTodas = [];
  const tablaTop300 = [];
  let ciudadIzq = "";
  let ciudadDer = "";
  for (let i = 2; i < filas.length; i++) {
    const r = filas[i] || [];
    const a0 = String(r[0] || "").trim();
    const a1 = String(r[1] || "").trim();
    if (/^ciudad$/i.test(a0)) continue;
    if (a0 || a1) {
      if (a0 && !/total/i.test(a0)) ciudadIzq = a0;
      const esTotal = /total/i.test(a0);
      const totalTiendas = Number(r[2]) || 0;
      if (totalTiendas || esTotal) {
        tablaTodas.push(
          filaVacia({
            ciudad: esTotal ? a0 : ciudadIzq,
            circuito: esTotal ? "" : a1,
            totalTiendas,
            lk7: Number(r[3]) || 0,
            lambo: Number(r[4]) || 0,
            pctLk7: Number(String(r[5] || "").replace("%", "")) || 0,
            pctLk7k: Number(String(r[6] || "").replace("%", "")) || 0,
            esTotal,
          }),
        );
      }
    }
    const b0 = String(r[8] || "").trim();
    const b1 = String(r[9] || "").trim();
    if (b0 || b1) {
      if (b0 && !/total/i.test(b0)) ciudadDer = b0;
      const esTotal = /total/i.test(b0);
      const totalTiendas = Number(r[10]) || 0;
      if (totalTiendas || esTotal) {
        tablaTop300.push(
          filaVacia({
            ciudad: esTotal ? b0 : ciudadDer,
            circuito: esTotal ? "" : b1,
            totalTiendas,
            lk7: Number(r[11]) || 0,
            lambo: Number(r[12]) || 0,
            pctLk7: Number(String(r[13] || "").replace("%", "")) || 0,
            pctLk7k: Number(String(r[14] || "").replace("%", "")) || 0,
            stockLk7: Number(r[15]) || 0,
            stockLk6: Number(r[16]) || 0,
            esTotal,
          }),
        );
      }
    }
  }
  return { tablaTodas, tablaTop300 };
}

function agruparTiendas(tiendas, soloTop) {
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
      salida.push(
        filaVacia({
          ciudad,
          circuito: c.circuito,
          totalTiendas: c.totalTiendas,
          lk7: c.lk7,
          lambo: c.lambo,
          pctLk7: pct(c.lk7, c.totalTiendas),
          pctLk7k: pct(c.lk7k, c.totalTiendas),
          stockLk7: c.stockLk7,
          stockLk6: c.stockLk6,
        }),
      );
      tot += c.totalTiendas;
      lk7 += c.lk7;
      lambo += c.lambo;
      lk7k += c.lk7k;
      stockLk7 += c.stockLk7;
      stockLk6 += c.stockLk6;
    }
    salida.push(
      filaVacia({
        ciudad: `${ciudad} Total`,
        circuito: "",
        totalTiendas: tot,
        lk7,
        lambo,
        pctLk7: pct(lk7, tot),
        pctLk7k: pct(lk7k, tot),
        stockLk7,
        stockLk6,
        esTotal: true,
      }),
    );
  }
  return salida;
}

/** Recalcula tablas desde SHOP (+ stock de Datos si hay columnas). */
export async function tablasDesdeShopBuffer(buffer) {
  const shop = await leerHoja(buffer, "SHOP");
  const filas = shop.filas || [];
  if (filas.length < 2) return { tablaTodas: [], tablaTop300: [] };
  const head = filas[0].map((c) => String(c || "").trim().toLowerCase());
  const colExact = (nombres) => {
    for (const n of nombres) {
      const i = head.findIndex((h) => h === n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const colIncluye = (nombres, excluir = []) => {
    for (const n of nombres) {
      const i = head.findIndex((h) => h.includes(n) && !excluir.some((e) => h.includes(e)));
      if (i >= 0) return i;
    }
    return -1;
  };
  const iId = colExact(["shop_dcr"]) >= 0 ? colExact(["shop_dcr"]) : colIncluye(["shop id", "shop_dcr"]);
  const iDept = colIncluye(["departament_report", "departamento"]);
  const iTop = colIncluye(["top 300"]);
  const iCirc = colIncluye(["concatenar"]);
  let iCircuito = -1;
  for (let c = 0; c < head.length; c++) {
    const muestra = filas.slice(1, 40).map((f) => String(f?.[c] || "").trim());
    const hits = muestra.filter((v) => /^[A-Z]{2,4}-?\d{1,3}$/i.test(v)).length;
    if (hits >= 3) {
      iCircuito = c;
      break;
    }
  }
  if (iCircuito < 0) iCircuito = 9;
  const iLk7k = colExact(["lk7k"]) >= 0 ? colExact(["lk7k"]) : colIncluye(["lk7k"]);
  const iLk7 = colExact(["lk7"]) >= 0 ? colExact(["lk7"]) : colIncluye(["lk7"], ["lk7k", "(l)", "lambo"]);
  const iLambo = head.findIndex((h) => h.includes("lk7") && (h.includes("(l)") || h.includes("lambo")));

  // Stock por tienda desde Datos
  const stockPorId = new Map();
  try {
    const datos = await leerHoja(buffer, "Datos");
    const dh = (datos.filas?.[0] || []).map((c) => String(c || "").trim().toLowerCase());
    const iShop = dh.indexOf("shop id");
    const iMod = dh.indexOf("model");
    const iQty = dh.indexOf("quantity");
    const iColor = dh.indexOf("color");
    if (iShop >= 0 && iMod >= 0 && iQty >= 0) {
      for (const fila of datos.filas.slice(1)) {
        const id = String(fila?.[iShop] || "")
          .trim()
          .toUpperCase();
        if (!id) continue;
        const modelo = String(fila?.[iMod] || "")
          .trim()
          .toUpperCase();
        const qty = Number(fila?.[iQty]) || 0;
        if (!stockPorId.has(id)) stockPorId.set(id, { lk7: 0, lk6: 0 });
        const s = stockPorId.get(id);
        if (modelo === "LK7") s.lk7 += qty;
        if (modelo === "LK6") s.lk6 += qty;
      }
    }
    void iColor;
  } catch {
    // sin Datos
  }

  const tiendas = [];
  for (const fila of filas.slice(1)) {
    const id = String(fila?.[iId] || "")
      .trim()
      .toUpperCase();
    if (!id) continue;
    let circuito = String(fila?.[iCircuito] || "").trim();
    if (!/^[A-Z]{2,4}-?\d+/i.test(circuito) && iCirc >= 0) {
      const concat = String(fila?.[iCirc] || "");
      const m = concat.match(/\/([A-Z]{2,4}-?\d+)\//i);
      if (m) circuito = m[1];
    }
    const ciudad = tituloCiudad(fila?.[iDept]) || "(sin ciudad)";
    const topVal = String(fila?.[iTop] || "").trim();
    const top = Boolean(topVal) && topVal.toUpperCase() !== "FALSE" && topVal !== "0" && topVal.toUpperCase() !== "NO";
    const nLk7 = Number(fila?.[iLk7]) || 0;
    const nLambo = iLambo >= 0 ? Number(fila?.[iLambo]) || 0 : 0;
    const nLk7k = iLk7k >= 0 ? Number(fila?.[iLk7k]) || 0 : 0;
    const stock = stockPorId.get(id) || { lk7: 0, lk6: 0 };
    tiendas.push({
      id,
      ciudad,
      circuito: circuito || "(sin circuito)",
      top,
      tieneLk7: nLk7 > 0 || stock.lk7 > 0,
      tieneLambo: nLambo > 0,
      tieneLk7k: nLk7k > 0,
      stockLk7: stock.lk7 || nLk7,
      stockLk6: stock.lk6,
    });
  }
  if (!tiendas.length) return { tablaTodas: [], tablaTop300: [] };
  return {
    tablaTodas: agruparTiendas(tiendas, false),
    tablaTop300: agruparTiendas(tiendas, true),
  };
}
