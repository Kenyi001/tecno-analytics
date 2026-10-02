// Pivot de Visitas Channel (hoja Form): ciudad → mayorista × modelo, suma Stock.

import { leerHoja } from "./libro";
import { fechaCorta, fechaHoraBolivia } from "./ciclo";

export const RUTA_LIBRO_MAYORISTA = "mayorista/actual.xlsx";
export const RUTA_JSON_MAYORISTA = "mayorista/actual.json";
export const UMBRAL_DEFAULT = "2026-09-28";
export const MARCA_DEFAULT = "TECNO";

function isoDeSerial(serial) {
  const n = Number(serial);
  if (!Number.isFinite(n) || n < 20000 || n > 80000) return "";
  const ms = Date.UTC(1899, 11, 30) + Math.round(n) * 86400000;
  const fecha = new Date(ms);
  if (Number.isNaN(fecha.getTime())) return "";
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getUTCDate()).padStart(2, "0");
  return `${fecha.getUTCFullYear()}-${mes}-${dia}`;
}

function isoDeCelda(valor) {
  if (valor == null || valor === "") return "";
  if (typeof valor === "number") return isoDeSerial(valor);
  const texto = String(valor).trim();
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const n = Number(texto);
  if (Number.isFinite(n)) return isoDeSerial(n);
  return "";
}

function tituloCiudad(texto) {
  const crudo = String(texto || "").trim();
  if (!crudo) return "(sin ciudad)";
  const lower = crudo.toLowerCase();
  if (lower === "santa cruz" || lower === "santa cruz ") return "Santa Cruz";
  if (lower === "la paz") return "La Paz";
  if (lower === "el alto") return "El Alto";
  if (lower === "cochabamba") return "Cochabamba";
  if (lower === "oruro") return "Oruro";
  if (lower === "sucre") return "Sucre";
  if (lower === "potosi" || lower === "potosí") return "Potosí";
  if (lower === "tarija") return "Tarija";
  if (lower === "beni") return "Beni";
  if (lower === "pando") return "Pando";
  return crudo.replace(/\b\w/g, (c) => c.toUpperCase());
}

function partirMayorista(valor) {
  const texto = String(valor || "").trim();
  const sep = texto.indexOf("/");
  if (sep < 0) return { ciudad: tituloCiudad(texto) || "(sin ciudad)", mayorista: texto || "(sin nombre)" };
  return {
    ciudad: tituloCiudad(texto.slice(0, sep)),
    mayorista: texto.slice(sep + 1).trim() || "(sin nombre)",
  };
}

function partirModelo(valor) {
  const texto = String(valor || "").trim();
  const sep = texto.indexOf("/");
  if (sep < 0) return { marca: "", modelo: texto };
  return {
    marca: texto.slice(0, sep).trim().toUpperCase(),
    modelo: texto.slice(sep + 1).trim(),
  };
}

function indiceCol(encabezado, nombres) {
  const lower = encabezado.map((c) => String(c || "").trim().toLowerCase());
  for (const nombre of nombres) {
    const i = lower.indexOf(nombre.toLowerCase());
    if (i >= 0) return i;
  }
  return -1;
}

/**
 * @param {Buffer} buffer
 * @param {{ umbralFecha?: string, marca?: string }} opts
 */
export async function pivotMayorista(buffer, opts = {}) {
  const umbralFecha = opts.umbralFecha || UMBRAL_DEFAULT;
  const marcaFiltro = String(opts.marca || MARCA_DEFAULT).trim().toUpperCase();
  const hoja = await leerHoja(buffer, "Form");
  const filas = hoja.filas || [];
  if (filas.length < 2) throw new Error("La hoja Form no tiene datos.");
  const encabezado = filas[0].map((c) => String(c || "").trim());
  const iSub = indiceCol(encabezado, ["Submitted on", "Submitted"]);
  const iMay = indiceCol(encabezado, ["Mayoristas"]);
  const iMod = indiceCol(encabezado, ["Modelo"]);
  const iStock = indiceCol(encabezado, ["Stock"]);
  if (iSub < 0 || iMay < 0 || iMod < 0 || iStock < 0) {
    throw new Error("Faltan columnas Submitted on, Mayoristas, Modelo o Stock en Form.");
  }

  const modelosSet = new Set();
  const marcasSet = new Set();
  /** @type {Map<string, Map<string, Map<string, number>>>} */
  const arbol = new Map();
  let total = 0;
  let filasUsadas = 0;

  for (const fila of filas.slice(1)) {
    const dia = isoDeCelda(fila?.[iSub]);
    if (!dia || dia <= umbralFecha) continue;
    const { marca, modelo } = partirModelo(fila?.[iMod]);
    if (!modelo) continue;
    if (marca) marcasSet.add(marca);
    if (marcaFiltro && marca !== marcaFiltro) continue;
    const stock = Number(fila?.[iStock]);
    if (!Number.isFinite(stock) || stock === 0) continue;
    const { ciudad, mayorista } = partirMayorista(fila?.[iMay]);
    modelosSet.add(modelo);
    if (!arbol.has(ciudad)) arbol.set(ciudad, new Map());
    const mapaCiudad = arbol.get(ciudad);
    if (!mapaCiudad.has(mayorista)) mapaCiudad.set(mayorista, new Map());
    const mapaMay = mapaCiudad.get(mayorista);
    mapaMay.set(modelo, (mapaMay.get(modelo) || 0) + stock);
    total += stock;
    filasUsadas += 1;
  }

  const modelos = [...modelosSet].sort((a, b) => a.localeCompare(b, "es"));
  const totalesModelo = Object.fromEntries(modelos.map((m) => [m, 0]));
  const ciudades = [...arbol.keys()]
    .sort((a, b) => a.localeCompare(b, "es"))
    .map((ciudad) => {
      const mapaCiudad = arbol.get(ciudad);
      const mayoristas = [...mapaCiudad.keys()]
        .sort((a, b) => a.localeCompare(b, "es"))
        .map((nombre) => {
          const stocks = mapaCiudad.get(nombre);
          const porModelo = {};
          let filaTotal = 0;
          for (const modelo of modelos) {
            const n = stocks.get(modelo) || 0;
            porModelo[modelo] = n;
            filaTotal += n;
            totalesModelo[modelo] += n;
          }
          return { nombre, porModelo, total: filaTotal };
        });
      const totalCiudad = mayoristas.reduce((s, m) => s + m.total, 0);
      const porModeloCiudad = Object.fromEntries(
        modelos.map((modelo) => [modelo, mayoristas.reduce((s, m) => s + (m.porModelo[modelo] || 0), 0)]),
      );
      return { ciudad, mayoristas, total: totalCiudad, porModelo: porModeloCiudad };
    });

  return {
    generado: new Date().toISOString(),
    umbralFecha,
    umbralTexto: fechaCorta(umbralFecha),
    marca: marcaFiltro,
    marcas: [...marcasSet].sort(),
    modelos,
    ciudades,
    totalesModelo,
    total,
    filasUsadas,
    actualizadoTexto: fechaHoraBolivia(new Date()),
  };
}
