import { readFile, writeFile } from "node:fs/promises";
import JSZip from "jszip";
import { armarLibro, leerHojaExport, vistaPublica } from "./book.mjs";

const exportPath = process.argv[2];
const templatePath = process.argv[3];
const outPath = process.argv[4];
const filas = await leerHojaExport(await readFile(exportPath));
const vista = vistaPublica(filas, { inicio: "x", finEtiqueta: "x", hasta: "x", carpeta: "x", archivo: "x" }, []);
const ocultas = ["IMEI/SN", "IMEI/SN List", "IMEI Picture", "Consumer Phone", "Consumer Name", "Consumer Mail"];
const mal = vista.columnas.filter((c) => ocultas.includes(c));
if (mal.length) throw new Error("la vista publica incluye columnas ocultas");
if (vista.conteos.registros !== filas.length - 1) throw new Error("conteo");
const { buffer, hojas } = await armarLibro(await readFile(templatePath), filas);
await writeFile(outPath, buffer);
const zip = await JSZip.loadAsync(buffer);
const reporte = await zip.file("xl/worksheets/sheet5.xml").async("string");
const detalle = await zip.file("xl/worksheets/sheet4.xml").async("string");
const data = await zip.file("xl/worksheets/sheet16.xml").async("string");
const fijos = await zip.file("xl/worksheets/sheet7.xml").async("string");
const checks = {
  hojas: hojas.length,
  registros: vista.conteos.registros,
  shopId: /<c r="Y1"[^>]*>[\s\S]*?<t>Shop ID<\/t>/.test(data),
  finance: data.includes("Model Type-Finance"),
  filter: reporte.includes("FILTER"),
  g4: /<c r="G4"[\s\S]*?<f>/.test(detalle),
  h4: /<c r="H4"[\s\S]*?<f>/.test(detalle),
  fijos: fijos.includes("COUNTIFS"),
  cola: !/<c r="A2000"/.test(detalle),
  a4: /<c r="A4"/.test(detalle),
  modelos: vista.conteos.porModelo.length,
};
console.log(JSON.stringify(checks));
if (Object.values(checks).some((v) => v === false)) process.exit(1);
