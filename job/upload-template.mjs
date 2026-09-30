import { readFile, writeFile } from "node:fs/promises";
import { put } from "@vercel/blob";

const ruta = process.argv[2];
if (!ruta) {
  console.error("Uso: node upload-template.mjs ruta-del-ciclo.xlsx");
  process.exit(1);
}
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("Falta BLOB_READ_WRITE_TOKEN");
  process.exit(1);
}

const bytes = await readFile(ruta);
await put("template/ciclo.xlsx", bytes, {
  access: "private",
  token: process.env.BLOB_READ_WRITE_TOKEN,
  addRandomSuffix: false,
  allowOverwrite: true,
  contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
});
console.log(`plantilla lista, ${bytes.length} bytes`);
