import { entrarDcr } from "../../compartido/dcr.mjs";
import { bajarExcelVentas } from "./sales.mjs";
import { armarLibro, leerHojaExport, vistaPublica } from "./book.mjs";
import { cicloDe } from "../../compartido/ciclo.mjs";
import { bajarPlantilla, subirDia } from "../../compartido/blob.mjs";

const corte = setTimeout(() => {
  console.error("corte a los 15 minutos");
  process.exit(1);
}, 15 * 60 * 1000);

const usuario = process.env.DCR_USER || "";
const clave = process.env.DCR_PASSWORD || "";
if (!usuario || !clave) {
  console.error("Faltan los secretos DCR_USER y DCR_PASSWORD");
  process.exit(1);
}

const ciclo = cicloDe();
console.log(`ciclo ${ciclo.carpeta} del ${ciclo.inicio} al ${ciclo.hasta}`);

const tokens = await entrarDcr(usuario, clave);
console.log("sesión lista");

const excel = await bajarExcelVentas(tokens, usuario, ciclo);
console.log(`excel ${excel.length} bytes`);

const filas = await leerHojaExport(excel);
console.log(`filas de venta ${filas.length - 1}`);

const plantilla = await bajarPlantilla();
const { buffer, hojas } = await armarLibro(plantilla, filas);
const vista = vistaPublica(filas, {
  inicio: ciclo.inicio,
  finEtiqueta: ciclo.finEtiqueta,
  hasta: ciclo.hasta,
  carpeta: ciclo.carpeta,
  archivo: ciclo.xlsx,
}, hojas);

await subirDia(ciclo, buffer, vista);
console.log(`subido ${ciclo.xlsx} con ${vista.conteos.registros} registros`);
clearTimeout(corte);
