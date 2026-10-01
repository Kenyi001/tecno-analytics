import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { get, put } from "@vercel/blob";
import JSZip from "jszip";
import { cicloDe } from "../../compartido/ciclo.mjs";

const accion = process.argv[2];
const ruta = process.argv[3];

function token() {
  const valor = process.env.BLOB_READ_WRITE_TOKEN;
  if (!valor) {
    console.error("Falta BLOB_READ_WRITE_TOKEN");
    process.exit(1);
  }
  return valor;
}

function rechazar(rutaArchivo) {
  const normal = String(rutaArchivo || "").replaceAll("\\", "/").toLowerCase();
  if (!normal || normal.includes("ciclo 9") || normal.includes("21_09_20_10")) {
    console.error("Esa ruta es el libro abierto. Se usa solo la copia temporal.");
    process.exit(1);
  }
}

if (!ruta || !["bajar", "subir", "huella"].includes(accion)) {
  console.error("Uso: node calcular-copia.mjs bajar|subir|huella ruta.xlsx");
  process.exit(1);
}

rechazar(ruta);
const ciclo = cicloDe();

if (accion === "bajar") {
  const archivo = await get(ciclo.xlsx, { access: "private", token: token(), useCache: false });
  if (!archivo || archivo.statusCode !== 200 || !archivo.stream) {
    console.error("No está el Excel de hoy");
    process.exit(1);
  }
  const bytes = Buffer.from(await new Response(archivo.stream).arrayBuffer());
  await writeFile(ruta, bytes);
  console.log(`bajado ${ciclo.xlsx}, ${bytes.length} bytes`);
}

if (accion === "subir") {
  const bytes = await readFile(ruta);
  await put(ciclo.xlsx, bytes, {
    access: "private",
    token: token(),
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  console.log(`subido ${ciclo.xlsx}, ${bytes.length} bytes`);
}

if (accion === "huella") {
  const zip = await JSZip.loadAsync(await readFile(ruta));
  const nombres = Object.keys(zip.files).filter((nombre) => /xl\/charts\/chart\d+\.xml$/.test(nombre)).sort();
  const partes = [];
  for (const nombre of nombres) {
    const xml = await zip.file(nombre).async("string");
    const valores = [...xml.matchAll(/<c:v>([^<]*)<\/c:v>/g)].map((item) => item[1]);
    partes.push(`${nombre}:${valores.join(",")}`);
  }
  console.log(createHash("sha256").update(partes.join("|")).digest("hex").slice(0, 12));
}
