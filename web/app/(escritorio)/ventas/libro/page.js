"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const ALTO = 28;
const VISTA = 640;

function Rejilla({ columnas, filas }) {
  const [scroll, setScroll] = useState(0);
  const inicio = Math.max(0, Math.floor(scroll / ALTO) - 6);
  const fin = Math.min(filas.length, inicio + Math.ceil(VISTA / ALTO) + 14);
  if (!filas.length) return <p className="aviso">Esta hoja no tiene valores guardados.</p>;
  return (
    <div className="rejilla" onScroll={(evento) => setScroll(evento.currentTarget.scrollTop)}>
      <table>
        <thead>
          <tr>
            <th className="num" />
            {columnas.map((columna) => (
              <th key={columna}>{columna}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {inicio > 0 ? (
            <tr style={{ height: inicio * ALTO }}>
              <td colSpan={columnas.length + 1} />
            </tr>
          ) : null}
          {filas.slice(inicio, fin).map((fila, indice) => (
            <tr key={inicio + indice}>
              <td className="num">{inicio + indice + 1}</td>
              {fila.map((valor, columna) => (
                <td key={columna}>{valor}</td>
              ))}
            </tr>
          ))}
          {fin < filas.length ? (
            <tr style={{ height: (filas.length - fin) * ALTO }}>
              <td colSpan={columnas.length + 1} />
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function Libro() {
  const params = useSearchParams();
  const dia = params.get("dia") || "";
  const [grid, setGrid] = useState(null);
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [cargando, setCargando] = useState(false);

  async function abrir(hoja) {
    if (!dia) {
      setError("Falta el día del archivo.");
      return;
    }
    setCargando(true);
    setError("");
    const consulta = new URLSearchParams({ dia });
    if (hoja) consulta.set("hoja", hoja);
    try {
      const respuesta = await fetch(`/api/ventas/hoja?${consulta}`, { cache: "no-store" });
      const cuerpo = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) {
        setGrid(null);
        setError(cuerpo.error || "No se pudo abrir ese archivo.");
        return;
      }
      setGrid(cuerpo);
    } catch {
      setError("No se pudo abrir ese archivo.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    abrir("");
    // El día de la dirección es la única entrada de esta vista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dia]);

  async function copiar() {
    if (!grid) return;
    const lineas = [grid.columnas.join("\t"), ...grid.filas.map((fila) => fila.join("\t"))];
    await navigator.clipboard.writeText(lineas.join("\n"));
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1600);
  }

  return (
    <div className="libro">
      <div className="libro-barra">
        <Link href="/ventas">Ventas</Link>
        <strong>{dia || "Libro"}</strong>
        <span className="crece" />
        <button type="button" className="btn secundario" onClick={copiar} disabled={!grid}>
          {copiado ? "Copiado" : "Copiar"}
        </button>
        {dia ? (
          <a className="btn" href={`/api/descarga?dia=${dia}`}>
            Descargar
          </a>
        ) : null}
      </div>
      <p className="nota">
        La hoja de ventas muestra lo recién extraído. Las otras se ven como quedaron guardadas. Sueldos y cumplimiento se calculan al abrir el archivo en Excel.
      </p>
      {error ? <p className="aviso fallo">{error}</p> : null}
      {cargando && !grid ? <p className="aviso">Abriendo el libro…</p> : null}
      {grid ? <Rejilla key={grid.hoja} columnas={grid.columnas} filas={grid.filas} /> : <div className="crece" />}
      {grid?.cortado ? <p className="nota">Se muestran las primeras 2500 filas. El archivo completo se descarga.</p> : null}
      {grid ? (
        <div className="pestanas">
          {grid.hojas.map((nombre) => (
            <button
              key={nombre}
              type="button"
              className={nombre === grid.hoja ? "activa" : ""}
              onClick={() => abrir(nombre)}
            >
              {nombre}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function PaginaLibro() {
  return (
    <Suspense fallback={<p className="aviso">Abriendo el libro…</p>}>
      <Libro />
    </Suspense>
  );
}
