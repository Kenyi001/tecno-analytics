// Baja el stock de DCR, pega Datos en el Excel de cobertura, recalcula y sube a Blob.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { get, put } from "@vercel/blob";
import { entrarDcr } from "../../compartido/dcr.mjs";
import { bajarExcelStock } from "./bajar.mjs";
import { pegarDatos } from "./pegar.mjs";

const RUTA_XLSX = "cobertura/actual.xlsx";
const RUTA_JSON = "cobertura/actual.json";

function token() {
  const valor = process.env.BLOB_READ_WRITE_TOKEN || "";
  if (!valor) throw new Error("Falta BLOB_READ_WRITE_TOKEN");
  return valor;
}

async function bajarBlob(pathname) {
  const archivo = await get(pathname, { access: "private", token: token(), useCache: false });
  if (!archivo || archivo.statusCode !== 200 || !archivo.stream) return null;
  return Buffer.from(await new Response(archivo.stream).arrayBuffer());
}

const usuario = process.env.DCR_USER || "";
const clave = process.env.DCR_PASSWORD || "";
if (!usuario || !clave) {
  console.error("Faltan los secretos DCR_USER y DCR_PASSWORD");
  process.exit(1);
}

const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "cobertura-"));
const libro = path.join(carpeta, "cobertura.xlsx");
const resumen = path.join(carpeta, "numeros.json");

const actual = await bajarBlob(RUTA_XLSX);
if (!actual) {
  console.error(`Falta ${RUTA_XLSX} en Blob. Súbelo una vez desde Cobertura.`);
  process.exit(1);
}
fs.writeFileSync(libro, actual);
console.log(`libro ${actual.length} bytes`);

const tokens = await entrarDcr(usuario, clave);
console.log("sesión lista");

// Solo LK7 y LK7K: alcanza para las tarjetas y evita el Excel completo (~200 MB).
const stock = await bajarExcelStock(tokens, usuario, ["LK7", "LK7K"]);
fs.writeFileSync(path.join(carpeta, "stock.xlsx"), stock);
console.log(`stock ${stock.length} bytes`);

const pegado = await pegarDatos(libro, stock);
console.log(`Datos ${pegado.filas} filas, fórmulas hasta ${pegado.fin}`);

const numeros = spawnSync(process.execPath, ["reportes/cobertura/numeros.mjs"], {
  env: {
    ...process.env,
    COBERTURA_LIBRO: libro,
    COBERTURA_RESUMEN: resumen,
    NODE_OPTIONS: "--max-old-space-size=7168",
  },
  encoding: "utf8",
});
if (numeros.status !== 0) {
  console.error(numeros.stdout || "");
  console.error(numeros.stderr || "");
  process.exit(numeros.status || 1);
}
console.log(numeros.stdout.trim());

const libroFinal = fs.readFileSync(libro);
const json = fs.readFileSync(resumen);
await put(RUTA_XLSX, libroFinal, {
  access: "private",
  token: token(),
  addRandomSuffix: false,
  allowOverwrite: true,
  contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  multipart: true,
});
await put(RUTA_JSON, json, {
  access: "private",
  token: token(),
  addRandomSuffix: false,
  allowOverwrite: true,
  contentType: "application/json",
});
const datos = JSON.parse(json.toString("utf8"));
console.log(`subido ${RUTA_XLSX} y ${RUTA_JSON} · tiendas ${datos.tiendas} · referencia ${datos.referencia}`);
