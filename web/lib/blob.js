import { get, list } from "@vercel/blob";
import { cicloDe, fechaCorta, fechaHoraBolivia } from "./ciclo";
import { leerHoja } from "./libro";

function contarColumna(columnas, filas, nombre) {
  if (!Array.isArray(columnas) || !Array.isArray(filas)) return null;
  const indice = columnas.indexOf(nombre);
  if (indice < 0) return null;
  const mapa = new Map();
  for (const fila of filas) {
    const clave = String(fila?.[indice] ?? "").trim() || "(sin dato)";
    mapa.set(clave, (mapa.get(clave) || 0) + 1);
  }
  return [...mapa.entries()]
    .map(([nombreItem, ventas]) => ({ nombre: nombreItem, ventas }))
    .sort((a, b) => b.ventas - a.ventas || a.nombre.localeCompare(b.nombre, "es"));
}

function grupoPosicion(valor) {
  const texto = String(valor || "").trim().toLowerCase();
  return texto === "area sales manager" || texto === "sales manager" ? "TECNO" : "Mercado";
}

function grupoModelo(valor) {
  return /^lk7k?$/i.test(String(valor || "").trim()) ? "Clave" : "MIX";
}

function cortarColumna(columnas, filas, nombre, grupoDe, orden) {
  if (!Array.isArray(columnas) || !Array.isArray(filas)) return null;
  const indice = columnas.indexOf(nombre);
  if (indice < 0) return null;
  const cuentas = new Map(orden.map((item) => [item, 0]));
  for (const fila of filas) {
    const grupo = grupoDe(fila?.[indice]);
    cuentas.set(grupo, (cuentas.get(grupo) || 0) + 1);
  }
  return orden.map((nombreItem) => ({ nombre: nombreItem, ventas: cuentas.get(nombreItem) || 0 }));
}

function cruzarColumnas(columnas, filas) {
  if (!Array.isArray(columnas) || !Array.isArray(filas)) return null;
  const iPos = columnas.indexOf("Position");
  const iMod = columnas.indexOf("Model");
  if (iPos < 0 || iMod < 0) return null;
  const grupos = ["TECNO", "Mercado"];
  const partes = ["Clave", "MIX"];
  const cuentas = new Map(grupos.map((grupo) => [grupo, new Map(partes.map((parte) => [parte, 0]))]));
  for (const fila of filas) {
    const grupo = grupoPosicion(fila?.[iPos]);
    const parte = grupoModelo(fila?.[iMod]);
    const mapa = cuentas.get(grupo);
    mapa.set(parte, (mapa.get(parte) || 0) + 1);
  }
  return grupos.map((nombre) => ({
    nombre,
    partes: partes.map((parte) => ({ nombre: parte, ventas: cuentas.get(nombre).get(parte) || 0 })),
  }));
}

function claveNombre(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function rosterFijos(hoja) {
  const filas = hoja?.filas || [];
  const cabecera = filas.findIndex(
    (fila) => Array.isArray(fila) && fila.includes("Nombre Completo") && fila.includes("Team Leader"),
  );
  if (cabecera < 0) return [];
  const encabezado = filas[cabecera];
  const iNom = encabezado.indexOf("Nombre Completo");
  const iTl = encabezado.indexOf("Team Leader");
  const iCod = encabezado.indexOf("Codigo DCR");
  const gente = [];
  const vistos = new Set();
  for (const datos of filas.slice(cabecera + 1)) {
    const nombre = String(datos?.[iNom] || "").replace(/\s+/g, " ").trim();
    const lider = String(datos?.[iTl] || "").trim();
    const codigo = String(datos?.[iCod] || "").trim();
    const clave = claveNombre(nombre);
    if (!nombre || !lider || !codigo || !clave || vistos.has(clave)) continue;
    vistos.add(clave);
    gente.push({ nombre, clave });
  }
  return gente;
}

function topFijos(columnas, filas, roster) {
  if (!Array.isArray(columnas) || !Array.isArray(filas) || !roster.length) return null;
  const indice = columnas.indexOf("Uploader");
  if (indice < 0) return null;
  const cuentas = new Map(roster.map((persona) => [persona.clave, 0]));
  for (const fila of filas) {
    const clave = claveNombre(fila?.[indice]);
    if (cuentas.has(clave)) cuentas.set(clave, cuentas.get(clave) + 1);
  }
  const orden = roster
    .map((persona) => ({ nombre: persona.nombre, ventas: cuentas.get(persona.clave) || 0 }))
    .sort((a, b) => b.ventas - a.ventas || a.nombre.localeCompare(b.nombre, "es"));
  const total = orden.reduce((suma, persona) => suma + persona.ventas, 0);
  return { lista: orden.filter((persona) => persona.ventas > 0).slice(0, 10), total };
}

function token() {
  const valor = process.env.BLOB_READ_WRITE_TOKEN;
  if (!valor) throw new Error("Falta el token del Blob");
  return valor;
}

async function listar(prefix) {
  const tok = token();
  const blobs = [];
  let cursor;
  do {
    const pagina = await list({ prefix, cursor, token: tok, limit: 100 });
    blobs.push(...pagina.blobs);
    cursor = pagina.hasMore ? pagina.cursor : undefined;
  } while (cursor);
  return blobs;
}

export async function bajar(pathname) {
  const archivo = await get(pathname, { access: "private", token: token(), useCache: false });
  if (!archivo || archivo.statusCode !== 200 || !archivo.stream) return null;
  return Buffer.from(await new Response(archivo.stream).arrayBuffer());
}

export async function resumenVentas() {
  const ciclo = cicloDe();
  const blobs = await listar(`${ciclo.carpeta}/`);
  const archivos = blobs
    .filter((blob) => /\/\d{4}-\d{2}-\d{2}\.xlsx$/.test(blob.pathname))
    .map((blob) => {
      const dia = blob.pathname.split("/").pop().replace(/\.xlsx$/, "");
      return {
        dia,
        texto: fechaCorta(dia),
        subido: blob.uploadedAt,
        subidoTexto: fechaHoraBolivia(blob.uploadedAt),
      };
    })
    .sort((a, b) => b.dia.localeCompare(a.dia));
  const jsons = blobs
    .filter((blob) => blob.pathname.endsWith(".json"))
    .sort((a, b) => b.pathname.localeCompare(a.pathname));
  let vista = null;
  if (jsons[0]) {
    const bytes = await bajar(jsons[0].pathname);
    if (bytes) {
      const completo = JSON.parse(bytes.toString("utf8"));
      const dia = jsons[0].pathname.split("/").pop().replace(/\.json$/, "");
      const momento = completo.generado || jsons[0].uploadedAt;
      const excel = archivos.find((archivo) => archivo.dia === dia);
      const diferencia = excel?.subido && momento ? new Date(excel.subido).getTime() - new Date(momento).getTime() : 0;
      let porFijos = null;
      let ventasFijos = 0;
      const libro = await bajar(jsons[0].pathname.replace(/\.json$/, ".xlsx"));
      if (libro) {
        try {
          const fijos = topFijos(completo.columnas, completo.filas, rosterFijos(await leerHoja(libro, "Fijos")));
          if (fijos) {
            porFijos = fijos.lista;
            ventasFijos = fijos.total;
          }
        } catch {
          porFijos = null;
        }
      }
      vista = {
        generado: completo.generado,
        dia,
        datosTexto: fechaCorta(dia),
        actualizadoTexto: fechaHoraBolivia(momento),
        calculadoTexto: diferencia > 3 * 60 * 1000 ? fechaHoraBolivia(excel.subido) : "",
        conteos: {
          ...completo.conteos,
          porModelo: contarColumna(completo.columnas, completo.filas, "Model") || completo.conteos?.porModelo,
          porArea: cortarColumna(completo.columnas, completo.filas, "Position", grupoPosicion, ["TECNO", "Mercado"]),
          porClave: cortarColumna(completo.columnas, completo.filas, "Model", grupoModelo, ["Clave", "MIX"]),
          porCruce: cruzarColumnas(completo.columnas, completo.filas),
          porFijos,
          ventasFijos,
        },
      };
    }
  }
  const hoy = blobs.find((blob) => blob.pathname === ciclo.json);
  return {
    ciclo: {
      inicio: ciclo.inicio,
      finEtiqueta: ciclo.finEtiqueta,
      hasta: ciclo.hasta,
      fechaHoy: ciclo.fechaHoy,
      inicioTexto: fechaCorta(ciclo.inicio),
      finTexto: fechaCorta(ciclo.finEtiqueta),
      hastaTexto: fechaCorta(ciclo.hasta),
    },
    archivos,
    vista,
    hoy: hoy ? { subido: hoy.uploadedAt } : null,
  };
}
