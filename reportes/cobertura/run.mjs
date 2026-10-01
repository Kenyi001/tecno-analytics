import fs from "node:fs";
import { entrarDcr } from "../../compartido/dcr.mjs";
import { bajarExcelStock } from "./bajar.mjs";
import { pegarDatos } from "./pegar.mjs";

const LIBRO = "C:\\Users\\daxke\\Downloads\\_Temp\\Tecno\\Reportes\\Cobertura\\Cobertura LK7 31-08.xlsx";
const FILTRADO = "C:\\Users\\daxke\\Downloads\\_Temp\\Tecno\\Reportes\\Cobertura\\stock-lk7-lk7k.xlsx";

const usuario = process.env.DCR_USER || "";
const clave = process.env.DCR_PASSWORD || "";
if (!usuario || !clave) {
  console.error("Faltan los secretos DCR_USER y DCR_PASSWORD");
  process.exit(1);
}

const tokens = await entrarDcr(usuario, clave);
console.log("sesión lista");
const completo = await bajarExcelStock(tokens, usuario, []);
console.log(`stock sin filtro ${completo.length}`);
const claveModelos = await bajarExcelStock(tokens, usuario, ["LK7", "LK7K"]);
fs.writeFileSync(FILTRADO, claveModelos);
console.log(`corte clave ${claveModelos.length}, guardado aparte`);
const pegado = await pegarDatos(LIBRO, completo);
console.log(`Datos ${pegado.filas} filas, fórmulas hasta ${pegado.fin}`);
