function partesBolivia(ahora = new Date()) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(ahora);
  const leer = (tipo) => Number(partes.find((p) => p.type === tipo).value);
  return { year: leer("year"), month: leer("month"), day: leer("day") };
}

function iso(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function fechaHoraBolivia(instante) {
  const fecha = new Date(instante);
  if (Number.isNaN(fecha.getTime())) return "";
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(fecha);
  const leer = (tipo) => partes.find((p) => p.type === tipo).value;
  return `${fechaCorta(`${leer("year")}-${leer("month")}-${leer("day")}`)}, ${leer("hour")}:${leer("minute")}`;
}

export function fechaCorta(isoFecha) {
  const [year, month, day] = isoFecha.split("-").map(Number);
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${day} ${meses[month - 1]} ${year}`;
}

export function instanteEnBolivia(isoFecha) {
  const [year, month, day] = isoFecha.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 16, 0, 0));
}

export function cicloDe(ahora = new Date()) {
  const hoy = partesBolivia(ahora);
  let year = hoy.year;
  let month = hoy.month;
  if (hoy.day < 21) {
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
  }
  let finYear = year;
  let finMonth = month + 1;
  if (finMonth > 12) {
    finMonth = 1;
    finYear += 1;
  }
  const inicio = iso(year, month, 21);
  const finEtiqueta = iso(finYear, finMonth, 20);
  const fechaHoy = iso(hoy.year, hoy.month, hoy.day);
  const hasta = fechaHoy < finEtiqueta ? fechaHoy : finEtiqueta;
  const carpeta = `ventas/ciclo_${year}${String(month).padStart(2, "0")}_21-20`;
  return {
    inicio,
    finEtiqueta,
    hasta,
    fechaHoy,
    carpeta,
    xlsx: `${carpeta}/${fechaHoy}.xlsx`,
    json: `${carpeta}/${fechaHoy}.json`,
  };
}

export function rutaDelDia(dia) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return null;
  const ciclo = cicloDe(instanteEnBolivia(dia));
  if (dia < ciclo.inicio || dia > ciclo.finEtiqueta) return null;
  return {
    ciclo,
    xlsx: `${ciclo.carpeta}/${dia}.xlsx`,
    json: `${ciclo.carpeta}/${dia}.json`,
  };
}

/** Ciclo 21→20 inmediatamente anterior al ciclo dado (por su fecha de inicio). */
export function cicloAnteriorDe(ciclo) {
  const [year, month] = String(ciclo?.inicio || "")
    .split("-")
    .map(Number);
  if (!year || !month) return null;
  let y = year;
  let m = month - 1;
  if (m < 1) {
    m = 12;
    y -= 1;
  }
  return cicloDe(instanteEnBolivia(iso(y, m, 21)));
}
