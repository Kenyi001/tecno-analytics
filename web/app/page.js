"use client";

import { useEffect, useMemo, useState } from "react";

const BASE = [
  "Shop ID",
  "Shop Name",
  "Sales Date",
  "Model",
  "Sales Qty",
  "Activation Date",
  "City",
  "State",
  "Uploader",
  "Uploader ID",
];

function Barras({ titulo, items }) {
  const max = items[0]?.ventas || 1;
  return (
    <section className="panel">
      <h2>{titulo}</h2>
      {items.length === 0 ? <p className="aviso">Sin datos.</p> : null}
      {items.slice(0, 8).map((item) => (
        <div className="fila-barra" key={item.nombre}>
          <span>{item.nombre}</span>
          <div className="pista"><span style={{ width: `${(item.ventas / max) * 100}%` }} /></div>
          <strong>{item.ventas}</strong>
        </div>
      ))}
    </section>
  );
}

export default function Pagina() {
  const [vista, setVista] = useState(null);
  const [error, setError] = useState("");
  const [todas, setTodas] = useState(false);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    fetch("/api/dia")
      .then(async (respuesta) => {
        if (!respuesta.ok) throw new Error("No se pudo leer el archivo del día");
        return respuesta.json();
      })
      .then(setVista)
      .catch((e) => setError(e.message));
  }, []);

  const indices = useMemo(() => {
    if (!vista?.columnas) return [];
    const elegidas = todas ? vista.columnas : vista.columnas.filter((c) => BASE.includes(c));
    return elegidas.map((nombre) => vista.columnas.indexOf(nombre)).filter((i) => i >= 0);
  }, [vista, todas]);

  async function copiar() {
    if (!vista) return;
    const encabezado = indices.map((i) => vista.columnas[i]);
    const lineas = vista.filas.map((fila) => indices.map((i) => fila[i] ?? "").join("\t"));
    await navigator.clipboard.writeText([encabezado.join("\t"), ...lineas].join("\n"));
    setAviso("Copiado. Se puede pegar en una hoja.");
  }

  if (error) return <main><p className="aviso">{error}</p></main>;
  if (!vista) return <main><p className="aviso">Cargando el archivo del día…</p></main>;
  if (vista.vacio) {
    return (
      <main>
        <h1>Ventas del ciclo</h1>
        <p className="aviso">Todavía no hay un archivo. El trabajo corre a las 9:00.</p>
      </main>
    );
  }

  const ciclo = vista.ciclo;
  return (
    <main>
      <h1>Ventas del ciclo</h1>
      <p className="sub">
        {ciclo.inicio} al {ciclo.finEtiqueta}, datos hasta {ciclo.hasta}. {vista.conteos.registros} registros.
        Los sueldos no se muestran aquí; quedan dentro del archivo descargado.
      </p>
      <div className="barra">
        <button type="button" onClick={copiar}>Copiar lo visible</button>
        <a className="boton" href={`/api/descarga?archivo=${encodeURIComponent(ciclo.archivo)}`}>Descargar Excel</a>
        <button type="button" className="secundario" onClick={() => setTodas((v) => !v)}>
          {todas ? "Ver columnas de trabajo" : "Ver todas las columnas"}
        </button>
        {aviso ? <span className="sub">{aviso}</span> : null}
      </div>
      <ul className="hojas">
        {vista.hojas.map((hoja) => <li key={hoja}>{hoja}</li>)}
      </ul>
      <div className="paneles">
        <Barras titulo="Registros por modelo" items={vista.conteos.porModelo} />
        <Barras titulo="Registros por ciudad" items={vista.conteos.porCiudad} />
      </div>
      <div className="tabla-caja">
        <table>
          <thead>
            <tr>{indices.map((i) => <th key={vista.columnas[i]}>{vista.columnas[i]}</th>)}</tr>
          </thead>
          <tbody>
            {vista.filas.map((fila, n) => (
              <tr key={n}>
                {indices.map((i) => <td key={vista.columnas[i]}>{fila[i] ?? ""}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
