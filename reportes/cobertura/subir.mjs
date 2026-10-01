import fs from "node:fs";
import { put } from "@vercel/blob";

const LOCAL = "C:\\Users\\daxke\\Downloads\\_Temp\\Tecno\\Reportes\\Cobertura\\numeros.json";
const WEB = new URL("../../web/data/cobertura.json", import.meta.url);
const RUTA = "cobertura/actual.json";

const tok = process.env.BLOB_READ_WRITE_TOKEN || "";
if (!tok) {
  console.error("Falta BLOB_READ_WRITE_TOKEN");
  process.exit(1);
}

const json = JSON.parse(fs.readFileSync(LOCAL, "utf8"));
fs.writeFileSync(WEB, `${JSON.stringify(json, null, 2)}\n`);
await put(RUTA, JSON.stringify(json), {
  access: "private",
  token: tok,
  addRandomSuffix: false,
  allowOverwrite: true,
  contentType: "application/json",
});
console.log(`subido ${RUTA} con ${json.tiendas} tiendas`);
