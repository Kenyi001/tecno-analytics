import { readFileSync } from "node:fs";
import { join } from "node:path";
import { get, list, put } from "@vercel/blob";
import { cicloAnteriorDe, cicloDe, fechaCorta, fechaHoraBolivia } from "./ciclo";
import { leerHoja } from "./libro";
import {
  deltaParticipacionPp,
  participacion,
  proyectarVentas,
  sumarDias,
  topConOtros,
} from "./proyeccion";

export const RUTA_COBERTURA = "cobertura/actual.json";
export const RUTA_LIBRO_COBERTURA = "cobertura/actual.xlsx";

function coberturaBase() {
  return JSON.parse(readFileSync(join(process.cwd(), "data", "cobertura.json"), "utf8"));
}

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

function indiceEncabezado(encabezado, predicado) {
  return encabezado.findIndex((nombre) => predicado(String(nombre || "").replace(/\s+/g, " ").trim()));
}

function numeroDinero(valor) {
  if (valor == null || valor === "") return null;
  if (typeof valor === "number" && Number.isFinite(valor)) return valor;
  let texto = String(valor).replace(/\s+/g, "").replace(/Bs\.?/gi, "").replace(/\$/g, "");
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(texto)) {
    texto = texto.replace(/,/g, "");
  } else if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(texto)) {
    texto = texto.replace(/\./g, "").replace(",", ".");
  } else if (texto.includes(",") && !texto.includes(".")) {
    texto = texto.replace(",", ".");
  }
  const n = Number(texto);
  return Number.isFinite(n) ? n : null;
}

function semanaIso(isoFecha) {
  const [y, m, d] = String(isoFecha || "")
    .split("-")
    .map(Number);
  if (!y || !m || !d) return null;
  const fecha = new Date(Date.UTC(y, m - 1, d));
  const dia = fecha.getUTCDay() || 7;
  fecha.setUTCDate(fecha.getUTCDate() + 4 - dia);
  const inicio = new Date(Date.UTC(fecha.getUTCFullYear(), 0, 1));
  return Math.ceil(((fecha - inicio) / 86400000 + 1) / 7);
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
  const iCom = indiceEncabezado(encabezado, (nombre) => claveNombre(nombre) === "comision bs.");
  const iComAlt =
    iCom >= 0
      ? iCom
      : indiceEncabezado(encabezado, (nombre) => {
          const clave = claveNombre(nombre);
          return clave.includes("comision") && clave.includes("bs");
        });
  const iProfit = indiceEncabezado(encabezado, (nombre) => claveNombre(nombre) === "profit");
  let tipoCambio = null;
  for (const fila of filas.slice(0, cabecera)) {
    const pos = (fila || []).findIndex((celda) => /bs\s*por\s*d[oó]lar/i.test(String(celda || "")));
    if (pos >= 0) {
      tipoCambio = numeroDinero(fila[pos + 1] ?? fila[pos]);
      if (tipoCambio == null && pos > 0) tipoCambio = numeroDinero(fila[pos - 1]);
      break;
    }
  }
  if (tipoCambio == null) tipoCambio = 8;
  const gente = [];
  const vistos = new Set();
  for (const datos of filas.slice(cabecera + 1)) {
    const nombre = String(datos?.[iNom] || "").replace(/\s+/g, " ").trim();
    const lider = String(datos?.[iTl] || "").trim();
    const codigo = String(datos?.[iCod] || "").trim();
    const clave = claveNombre(nombre);
    if (!nombre || !lider || !codigo || !clave || vistos.has(clave)) continue;
    vistos.add(clave);
    const comisionCelda = iComAlt >= 0 ? numeroDinero(datos?.[iComAlt]) : null;
    const profitUsd = iProfit >= 0 ? numeroDinero(datos?.[iProfit]) : null;
    let comisionBs = comisionCelda;
    let comisionFuente = "comision";
    if ((comisionBs == null || comisionBs === 0) && profitUsd != null && profitUsd !== 0) {
      comisionBs = Math.round(profitUsd * tipoCambio * 100) / 100;
      comisionFuente = "profit";
    }
    gente.push({
      nombre,
      clave,
      codigo,
      comisionBs,
      comisionFuente,
      tipoCambio,
    });
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

async function cierreCicloAnterior(ciclo) {
  const anterior = cicloAnteriorDe(ciclo);
  if (!anterior) return null;
  try {
    const blobs = await listar(`${anterior.carpeta}/`);
    const jsons = blobs
      .filter((blob) => blob.pathname.endsWith(".json"))
      .sort((a, b) => b.pathname.localeCompare(a.pathname));
    if (!jsons[0]) return null;
    const bytes = await bajar(jsons[0].pathname);
    if (!bytes) return null;
    const completo = JSON.parse(bytes.toString("utf8"));
    const dia = jsons[0].pathname.split("/").pop().replace(/\.json$/, "");
    const total = completo.conteos?.registros ?? (completo.filas || []).length;
    const porModelo = completo.conteos?.porModelo || contarColumna(completo.columnas, completo.filas, "Model");
    const porEstado = completo.conteos?.porEstado || contarColumna(completo.columnas, completo.filas, "State");
    const proyeccionAnt = proyectarVentas({
      columnas: completo.columnas,
      filas: completo.filas,
      ciclo: { inicio: anterior.inicio, finEtiqueta: anterior.finEtiqueta, hasta: dia },
      hoyLaPaz: sumarDias(anterior.finEtiqueta, 1),
    });
    const diasDistintos = (proyeccionAnt?.porDia || []).filter((d) => d.ventas > 0).length;
    return {
      total,
      dia,
      diaTexto: fechaCorta(dia),
      inicioTexto: fechaCorta(anterior.inicio),
      finTexto: fechaCorta(anterior.finEtiqueta),
      carpeta: anterior.carpeta,
      porModelo: participacion(porModelo || []),
      porEstado: participacion(porEstado || []),
      porDia: proyeccionAnt?.porDia || [],
      tieneSerieDiaria: diasDistintos >= 7,
      diasDistintos,
    };
  } catch {
    return null;
  }
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
  const referenciaAnterior = await cierreCicloAnterior(ciclo);
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
      const proyeccion = proyectarVentas({
        columnas: completo.columnas,
        filas: completo.filas,
        ciclo: { inicio: ciclo.inicio, hasta: dia, finEtiqueta: ciclo.finEtiqueta },
        hoyLaPaz: ciclo.fechaHoy,
      });
      const porModelo = contarColumna(completo.columnas, completo.filas, "Model") || completo.conteos?.porModelo || [];
      const porEstado = completo.conteos?.porEstado || contarColumna(completo.columnas, completo.filas, "State") || [];
      const porCruce = cruzarColumnas(completo.columnas, completo.filas);
      const modelosPct = participacion(porModelo);
      const deptosPct = participacion(porEstado);
      const modelosConDelta = referenciaAnterior?.porModelo?.length
        ? deltaParticipacionPp(modelosPct, referenciaAnterior.porModelo)
        : modelosPct.map((item) => ({ ...item, deltaPp: null, tendencia: "igual" }));
      const deptosConDelta = referenciaAnterior?.porEstado?.length
        ? deltaParticipacionPp(deptosPct, referenciaAnterior.porEstado)
        : deptosPct.map((item) => ({ ...item, deltaPp: null, tendencia: "igual" }));
      const modelosTop = topConOtros(modelosConDelta, 5);
      const fijosTop5 = (porFijos || []).slice(0, 5);
      const fijosResto = Math.max(0, (porFijos || []).length - 5);

      let insightQuien = null;
      if (porCruce) {
        const tecno = porCruce.find((g) => g.nombre === "TECNO");
        const mercado = porCruce.find((g) => g.nombre === "Mercado");
        const volTecno = (tecno?.partes || []).reduce((s, p) => s + p.ventas, 0);
        const volMercado = (mercado?.partes || []).reduce((s, p) => s + p.ventas, 0);
        const volTotal = volTecno + volMercado;
        const claveTecno = tecno?.partes?.find((p) => p.nombre === "Clave")?.ventas || 0;
        const claveTotal = (proyeccion?.clave || 0);
        if (volTotal > 0 && claveTotal > 0) {
          insightQuien = {
            pctVolumenTecno: Math.round((volTecno / volTotal) * 100),
            pctClaveTecno: Math.round((claveTecno / claveTotal) * 100),
          };
        }
      }

      let vsAnterior = null;
      if (referenciaAnterior?.total && proyeccion?.totalProyectado) {
        const delta = proyeccion.totalProyectado - referenciaAnterior.total;
        const pct = Math.round((delta / referenciaAnterior.total) * 1000) / 10;
        vsAnterior = {
          cierreAnterior: referenciaAnterior.total,
          cierreTexto: referenciaAnterior.finTexto,
          delta,
          pct,
          semaforo: pct > 1 ? "arriba" : pct < -1 ? "abajo" : "igual",
        };
      }

      vista = {
        generado: completo.generado,
        dia,
        datosTexto: fechaCorta(dia),
        actualizadoTexto: fechaHoraBolivia(momento),
        calculadoTexto: diferencia > 3 * 60 * 1000 ? fechaHoraBolivia(excel.subido) : "",
        conteos: {
          ...completo.conteos,
          registros: completo.conteos?.registros ?? completo.filas?.length ?? 0,
          porModelo: modelosConDelta,
          porModeloTop: modelosTop.visibles,
          porModeloOcultos: modelosTop.ocultos,
          porEstado: deptosConDelta,
          porArea: cortarColumna(completo.columnas, completo.filas, "Position", grupoPosicion, ["TECNO", "Mercado"]),
          porClave: cortarColumna(completo.columnas, completo.filas, "Model", grupoModelo, ["Clave", "MIX"]),
          porCruce,
          porFijos,
          porFijosTop: fijosTop5,
          porFijosOcultos: fijosResto,
          ventasFijos,
          proyeccion,
          // Alias legacy para no romper lecturas viejas.
          pronostico: proyeccion,
          insightQuien,
          vsAnterior,
          pctClave: proyeccion?.total ? Math.round((proyeccion.clave / proyeccion.total) * 1000) / 10 : 0,
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
    referenciaAnterior: referenciaAnterior
      ? {
          total: referenciaAnterior.total,
          diaTexto: referenciaAnterior.diaTexto,
          inicioTexto: referenciaAnterior.inicioTexto,
          finTexto: referenciaAnterior.finTexto,
          tieneSerieDiaria: referenciaAnterior.tieneSerieDiaria,
          diasDistintos: referenciaAnterior.diasDistintos,
          porDia: referenciaAnterior.tieneSerieDiaria ? referenciaAnterior.porDia : [],
        }
      : null,
    hoy: hoy ? { subido: hoy.uploadedAt } : null,
  };
}

function indiceColumna(columnas, nombres) {
  for (const nombre of nombres) {
    const indice = columnas.indexOf(nombre);
    if (indice >= 0) return indice;
  }
  return -1;
}

function unicos(valores) {
  return [...new Set(valores.map((valor) => String(valor || "").trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "es"),
  );
}

function localesDe(propias, iShop, iNombreTienda, iCiudad) {
  const mapa = new Map();
  for (const fila of propias) {
    const shopId = iShop >= 0 ? String(fila?.[iShop] || "").trim() : "";
    const tienda = iNombreTienda >= 0 ? String(fila?.[iNombreTienda] || "").trim() : "";
    const ciudad = iCiudad >= 0 ? String(fila?.[iCiudad] || "").trim() : "";
    const llave = shopId || tienda || ciudad;
    if (!llave) continue;
    if (!mapa.has(llave)) mapa.set(llave, { tienda: tienda || "Sin tienda", shopId: shopId || "—", ciudad: ciudad || "—" });
  }
  return [...mapa.values()].sort(
    (a, b) => a.tienda.localeCompare(b.tienda, "es") || a.shopId.localeCompare(b.shopId, "es"),
  );
}

function modelosConComision(mapa, totalVentas, comisionBs) {
  const filas = [...mapa.entries()]
    .map(([llave, ventas]) => {
      const [modelo, estado] = llave.split("\t");
      return { modelo, estado, ventas };
    })
    .sort((a, b) => b.ventas - a.ventas || a.modelo.localeCompare(b.modelo, "es") || a.estado.localeCompare(b.estado, "es"));
  if (comisionBs == null || !totalVentas) {
    return filas.map((fila) => ({ ...fila, comisionBs: null }));
  }
  let asignado = 0;
  return filas.map((fila, indice) => {
    if (indice === filas.length - 1) {
      const resto = Math.round((comisionBs - asignado) * 100) / 100;
      return { ...fila, comisionBs: resto };
    }
    const parte = Math.round(((comisionBs * fila.ventas) / totalVentas) * 100) / 100;
    asignado += parte;
    return { ...fila, comisionBs: parte };
  });
}

export async function consultarCodigo(codigo) {
  const buscado = String(codigo || "").replace(/\s+/g, "").trim().toUpperCase();
  if (!/^[A-Z0-9]{4,24}$/.test(buscado)) return { encontrado: false };
  const ciclo = cicloDe();
  const blobs = await listar(`${ciclo.carpeta}/`);
  const jsons = blobs.filter((blob) => blob.pathname.endsWith(".json")).sort((a, b) => b.pathname.localeCompare(a.pathname));
  if (!jsons[0]) return { encontrado: false };
  const bytes = await bajar(jsons[0].pathname);
  if (!bytes) return { encontrado: false };
  const completo = JSON.parse(bytes.toString("utf8"));
  const columnas = completo.columnas || [];
  const filas = completo.filas || [];
  let roster = [];
  const libro = await bajar(jsons[0].pathname.replace(/\.json$/, ".xlsx"));
  if (libro) {
    try {
      roster = rosterFijos(await leerHoja(libro, "Fijos"));
    } catch {
      roster = [];
    }
  }
  let persona = roster.find((item) => String(item.codigo || "").replace(/\s+/g, "").toUpperCase() === buscado);
  const matchFijos = Boolean(persona);
  const iUp = indiceColumna(columnas, ["Uploader"]);
  const iId = indiceColumna(columnas, ["Uploader ID"]);
  let propias = filas.filter((fila) => {
    const id = iId >= 0 ? String(fila?.[iId] || "").replace(/\s+/g, "").trim().toUpperCase() : "";
    if (id && id === buscado) return true;
    return Boolean(persona?.clave && iUp >= 0 && claveNombre(fila?.[iUp]) === persona.clave);
  });
  const matchUploaderId = propias.some((fila) => {
    const id = iId >= 0 ? String(fila?.[iId] || "").replace(/\s+/g, "").trim().toUpperCase() : "";
    return id && id === buscado;
  });
  if (!persona && propias.length && iUp >= 0) {
    const claveVenta = claveNombre(propias[0]?.[iUp]);
    persona = roster.find((item) => item.clave === claveVenta) || null;
  }
  if (persona && !propias.length) {
    propias = filas.filter((fila) => iUp >= 0 && claveNombre(fila?.[iUp]) === persona.clave);
  }
  if (!persona && !propias.length) return { encontrado: false };
  const tipo = matchFijos && !matchUploaderId ? "fijos" : matchUploaderId || buscado.startsWith("BOV") ? "uploader" : "fijos";
  const iMod = indiceColumna(columnas, ["Model"]);
  const iAct = indiceColumna(columnas, ["Activation Date"]);
  const iShop = indiceColumna(columnas, ["Shop ID"]);
  const iNombreTienda = indiceColumna(columnas, ["Shop Name", "Shop"]);
  const iCiudad = indiceColumna(columnas, ["City"]);
  const mapa = new Map();
  let ventasClave = 0;
  let ventasMix = 0;
  for (const fila of propias) {
    const modelo = iMod >= 0 ? String(fila?.[iMod] || "").trim() || "(sin modelo)" : "(sin modelo)";
    const estado = iAct >= 0 && String(fila?.[iAct] || "").trim() ? "Activado" : "No activado";
    const llave = `${modelo}\t${estado}`;
    mapa.set(llave, (mapa.get(llave) || 0) + 1);
    if (grupoModelo(modelo) === "Clave") ventasClave += 1;
    else ventasMix += 1;
  }
  const dia = jsons[0].pathname.split("/").pop().replace(/\.json$/, "");
  const uploaderId =
    unicos(propias.map((fila) => (iId >= 0 ? fila?.[iId] : ""))).find((id) => /^BOV/i.test(id)) ||
    (buscado.startsWith("BOV") ? buscado : "");
  const locales = localesDe(propias, iShop, iNombreTienda, iCiudad);
  const comisionBs = persona?.comisionBs ?? null;
  const total = propias.length;
  return {
    encontrado: true,
    tipo,
    nombre: persona?.nombre || (iUp >= 0 ? String(propias[0]?.[iUp] || "").replace(/\s+/g, " ").trim() : ""),
    codigo: persona?.codigo || (tipo === "uploader" ? "" : buscado),
    uploaderId: uploaderId || (tipo === "uploader" ? buscado : ""),
    semana: semanaIso(dia),
    rango: `${fechaCorta(ciclo.inicio)} – ${fechaCorta(dia)}`,
    locales,
    ciudades: unicos(locales.map((item) => item.ciudad).filter((c) => c && c !== "—")),
    tiendas: unicos(locales.map((item) => item.shopId).filter((c) => c && c !== "—")),
    nombresTienda: unicos(locales.map((item) => item.tienda).filter((c) => c && c !== "Sin tienda")),
    modelos: modelosConComision(mapa, total, comisionBs),
    clave: ventasClave,
    mix: ventasMix,
    total,
    comisionBs,
    comisionFuente: persona?.comisionFuente || null,
    tipoCambio: persona?.tipoCambio ?? null,
  };
}

function vistaCobertura(completo, origen, tieneLibro) {
  const referencia = completo.referencia || "";
  return {
    generado: completo.generado,
    origen,
    tieneLibro: Boolean(tieneLibro),
    referencia,
    referenciaTexto: referencia ? fechaCorta(referencia) : "",
    cierre: completo.cierre || "",
    cierreTexto: completo.cierre ? fechaCorta(completo.cierre) : "",
    actualizadoTexto: completo.generado ? fechaHoraBolivia(completo.generado) : "",
    tiendas: completo.tiendas || 0,
    top300: completo.top300 || 0,
    diasFaltan: completo.diasFaltan || 0,
    filasDatos: completo.filasDatos || 0,
    grupos: completo.grupos || {},
  };
}

async function hayLibroCobertura() {
  const blobs = await listar("cobertura/");
  return blobs.some((blob) => blob.pathname === RUTA_LIBRO_COBERTURA);
}

export async function resumenCobertura() {
  let tieneLibro = false;
  try {
    tieneLibro = await hayLibroCobertura();
  } catch {
    tieneLibro = false;
  }
  try {
    const bytes = await bajar(RUTA_COBERTURA);
    if (bytes) return vistaCobertura(JSON.parse(bytes.toString("utf8")), "blob", tieneLibro);
  } catch {
    // Si no hay Blob, se usa el cálculo guardado en el repo.
  }
  return vistaCobertura(coberturaBase(), "base", tieneLibro);
}

export async function libroCobertura() {
  return bajar(RUTA_LIBRO_COBERTURA);
}

export async function marcarLibroCobertura() {
  let actual = coberturaBase();
  try {
    const bytes = await bajar(RUTA_COBERTURA);
    if (bytes) actual = JSON.parse(bytes.toString("utf8"));
  } catch {
    actual = coberturaBase();
  }
  actual.generado = new Date().toISOString();
  return subirCobertura(actual);
}

export async function subirCobertura(json) {
  await put(RUTA_COBERTURA, JSON.stringify(json), {
    access: "private",
    token: token(),
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
  return vistaCobertura(json, "blob", true);
}
