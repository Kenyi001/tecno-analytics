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

// El ciclo corre del 21 al 20. Si hoy es anterior al 21, el ciclo empezó el 21 del mes pasado.
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
  const carpeta = `ciclo_${year}${String(month).padStart(2, "0")}_21-20`;
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
