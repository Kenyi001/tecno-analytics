// Proyección al cierre del ciclo de ventas (21→20).
// Ritmo solo con días completos: Sales Date < hoy en America/La_Paz.

export function diasEntre(inicio, fin) {
  const desde = new Date(`${inicio}T12:00:00Z`).getTime();
  const hasta = new Date(`${fin}T12:00:00Z`).getTime();
  if (!Number.isFinite(desde) || !Number.isFinite(hasta) || hasta < desde) return 0;
  return Math.round((hasta - desde) / 86400000) + 1;
}

export function sumarDias(isoFecha, dias) {
  const [y, m, d] = isoFecha.split("-").map(Number);
  const fecha = new Date(Date.UTC(y, m - 1, d + dias));
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getUTCDate()).padStart(2, "0");
  return `${fecha.getUTCFullYear()}-${mes}-${dia}`;
}

export function hoyIsoLaPaz(ahora = new Date()) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ahora);
  const leer = (tipo) => partes.find((p) => p.type === tipo).value;
  return `${leer("year")}-${leer("month")}-${leer("day")}`;
}

function isoDeSerial(serial) {
  const ms = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
  const fecha = new Date(ms);
  if (Number.isNaN(fecha.getTime())) return "";
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getUTCDate()).padStart(2, "0");
  return `${fecha.getUTCFullYear()}-${mes}-${dia}`;
}

export function isoDeCelda(valor) {
  if (valor == null || valor === "") return "";
  if (typeof valor === "number" && valor > 20000 && valor < 80000) return isoDeSerial(valor);
  const texto = String(valor).trim();
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = texto.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  const n = Number(texto);
  if (Number.isFinite(n) && n > 20000 && n < 80000) return isoDeSerial(n);
  return "";
}

export function esClaveModelo(valor) {
  return /^lk7k?$/i.test(String(valor || "").trim());
}

function unDecimal(valor) {
  return Math.round(valor * 10) / 10;
}

function redondear(valor) {
  return Math.round(valor);
}

export function listarDias(inicio, fin) {
  if (!inicio || !fin || fin < inicio) return [];
  const salida = [];
  let actual = inicio;
  while (actual <= fin) {
    salida.push(actual);
    actual = sumarDias(actual, 1);
  }
  return salida;
}

function proyectarConRitmo(ventasCompletas, ritmo, restantes) {
  return redondear(ventasCompletas + ritmo * restantes);
}

/**
 * @param {object} args
 * @param {string[]} args.columnas
 * @param {any[][]} args.filas
 * @param {{ inicio: string, finEtiqueta: string, hasta?: string }} args.ciclo
 * @param {string} [args.hoyLaPaz] ISO yyyy-mm-dd en La Paz
 */
export function proyectarVentas({ columnas, filas, ciclo, hoyLaPaz: hoyArg }) {
  if (!Array.isArray(columnas) || !Array.isArray(filas) || !ciclo?.inicio || !ciclo?.finEtiqueta) {
    return null;
  }
  const iMod = columnas.indexOf("Model");
  const iFecha = columnas.indexOf("Sales Date");
  if (iMod < 0) return null;

  const hoyLaPaz = hoyArg || hoyIsoLaPaz();
  const cicloDias = diasEntre(ciclo.inicio, ciclo.finEtiqueta);
  if (cicloDias < 1) return null;

  const ultimoCalendario = hoyLaPaz < ciclo.inicio ? ciclo.inicio : hoyLaPaz > ciclo.finEtiqueta ? ciclo.finEtiqueta : hoyLaPaz;
  const posicion = diasEntre(ciclo.inicio, ultimoCalendario);
  const hayParcialHoy = hoyLaPaz >= ciclo.inicio && hoyLaPaz <= ciclo.finEtiqueta && hoyLaPaz === ultimoCalendario;
  const finCompletos = hayParcialHoy ? sumarDias(hoyLaPaz, -1) : ultimoCalendario;
  const diasCompletos = finCompletos >= ciclo.inicio ? diasEntre(ciclo.inicio, finCompletos) : 0;
  const restantes = Math.max(0, cicloDias - diasCompletos);

  const porDia = new Map();
  let clave = 0;
  let mix = 0;
  let claveCompleta = 0;
  let mixCompleta = 0;

  for (const fila of filas) {
    const esClave = esClaveModelo(fila?.[iMod]);
    if (esClave) clave += 1;
    else mix += 1;
    const dia = iFecha >= 0 ? isoDeCelda(fila?.[iFecha]) : "";
    if (!dia || dia < ciclo.inicio || dia > ciclo.finEtiqueta) continue;
    porDia.set(dia, (porDia.get(dia) || 0) + 1);
    if (diasCompletos > 0 && dia <= finCompletos) {
      if (esClave) claveCompleta += 1;
      else mixCompleta += 1;
    }
  }

  const total = clave + mix;
  const ventasCompletas = claveCompleta + mixCompleta;
  const serieCompleta = listarDias(ciclo.inicio, finCompletos >= ciclo.inicio ? finCompletos : sumarDias(ciclo.inicio, -1)).map(
    (dia) => ({ dia, ventas: porDia.get(dia) || 0 }),
  );
  const porDiaLista = listarDias(ciclo.inicio, ultimoCalendario).map((dia) => ({
    dia,
    ventas: porDia.get(dia) || 0,
    completo: diasCompletos > 0 && dia <= finCompletos,
  }));

  const pocosDatos = diasCompletos < 7;
  const ritmoCrudo = diasCompletos > 0 ? ventasCompletas / diasCompletos : 0;
  const ritmoClave = diasCompletos > 0 ? claveCompleta / diasCompletos : 0;
  const ritmoMix = diasCompletos > 0 ? mixCompleta / diasCompletos : 0;

  let ritmo7Crudo = null;
  let mejor7Crudo = null;
  if (diasCompletos >= 7) {
    const ultimos = serieCompleta.slice(-7);
    ritmo7Crudo = ultimos.reduce((suma, item) => suma + item.ventas, 0) / 7;
    let mejor = 0;
    for (let i = 0; i + 7 <= serieCompleta.length; i++) {
      const ventana = serieCompleta.slice(i, i + 7);
      const promedio = ventana.reduce((suma, item) => suma + item.ventas, 0) / 7;
      if (promedio > mejor) mejor = promedio;
    }
    mejor7Crudo = mejor;
  }

  const base = diasCompletos > 0 ? proyectarConRitmo(ventasCompletas, ritmoCrudo, restantes) : total;
  const proyeccion7 =
    ritmo7Crudo != null ? proyectarConRitmo(ventasCompletas, ritmo7Crudo, restantes) : base;
  const proyeccionMejor =
    mejor7Crudo != null ? proyectarConRitmo(ventasCompletas, mejor7Crudo, restantes) : base;

  const conservador = Math.min(proyeccion7, base);
  const optimista = Math.max(proyeccionMejor, base);

  const claveProyectada =
    diasCompletos > 0 ? proyectarConRitmo(claveCompleta, ritmoClave, restantes) : clave;
  const mixProyectada = diasCompletos > 0 ? proyectarConRitmo(mixCompleta, ritmoMix, restantes) : mix;

  let tendencia = "igual";
  if (ritmo7Crudo != null) {
    if (ritmo7Crudo > ritmoCrudo + 0.05) tendencia = "sube";
    else if (ritmo7Crudo + 0.05 < ritmoCrudo) tendencia = "baja";
  }

  const deltaRitmoPct =
    ritmo7Crudo != null && ritmoCrudo > 0
      ? Math.round(((ritmo7Crudo - ritmoCrudo) / ritmoCrudo) * 1000) / 10
      : null;

  return {
    clave,
    mix,
    total,
    ventasCompletas,
    claveCompleta,
    mixCompleta,
    cicloDias,
    posicion,
    diasCompletos,
    restantes,
    hoyParcial: hayParcialHoy && (porDia.get(hoyLaPaz) || 0) >= 0 && hoyLaPaz >= ciclo.inicio,
    hoyLaPaz,
    pocosDatos,
    ritmoDiario: unDecimal(ritmoCrudo),
    ritmo7: ritmo7Crudo != null ? unDecimal(ritmo7Crudo) : null,
    mejorRitmo7: mejor7Crudo != null ? unDecimal(mejor7Crudo) : null,
    tendencia,
    deltaRitmoPct,
    claveProyectada,
    mixProyectada,
    totalProyectado: base,
    conservador,
    optimista,
    mismoCierre: conservador === optimista,
    porDia: porDiaLista,
    etiquetas: {
      base: "ritmo del ciclo",
      conservador: pocosDatos ? "pocos datos" : "últimos 7 días completos",
      optimista: pocosDatos ? "pocos datos" : "mejor semana del ciclo",
    },
  };
}

export function participacion(items) {
  const total = (items || []).reduce((suma, item) => suma + (item.ventas || 0), 0);
  if (!total) return [];
  return (items || []).map((item) => ({
    ...item,
    pct: Math.round(((item.ventas || 0) / total) * 1000) / 10,
  }));
}

export function deltaParticipacionPp(actual, anterior) {
  const mapaAnt = new Map((anterior || []).map((item) => [item.nombre, item.pct ?? 0]));
  return (actual || []).map((item) => {
    const prev = mapaAnt.has(item.nombre) ? mapaAnt.get(item.nombre) : 0;
    const deltaPp = Math.round((item.pct - prev) * 10) / 10;
    return { ...item, deltaPp, tendencia: deltaPp > 0.05 ? "sube" : deltaPp < -0.05 ? "baja" : "igual" };
  });
}

export function topConOtros(items, limite = 5) {
  const lista = [...(items || [])].sort((a, b) => b.ventas - a.ventas || a.nombre.localeCompare(b.nombre, "es"));
  if (lista.length <= limite) return { visibles: lista, ocultos: 0, otros: null };
  const visibles = lista.slice(0, limite);
  const cola = lista.slice(limite);
  const otrosVentas = cola.reduce((suma, item) => suma + item.ventas, 0);
  return {
    visibles: [...visibles, { nombre: `Otros (${cola.length} modelos)`, ventas: otrosVentas, esOtros: true }],
    ocultos: cola.length,
    otros: { nombre: `Otros (${cola.length})`, ventas: otrosVentas, items: cola },
  };
}
