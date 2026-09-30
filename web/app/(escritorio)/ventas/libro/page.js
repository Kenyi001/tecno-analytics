"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Hoja from "../../../../components/Hoja";

function Libro() {
  const params = useSearchParams();
  const dia = params.get("dia") || "";
  const [grid, setGrid] = useState(null);
  const [error, setError] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [filtroCol, setFiltroCol] = useState(-1);
  const [filtroValor, setFiltroValor] = useState("");

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
      setFiltroCol(-1);
      setFiltroValor("");
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

  const valoresFiltro = useMemo(() => {
    if (!grid?.filtro || filtroCol < 0) return [];
    const vistos = new Set();
    for (let fila = 0; fila < grid.filas.length; fila++) {
      if (fila === grid.filtro.fila) continue;
      const valor = grid.filas[fila][filtroCol];
      if (valor) vistos.add(valor);
      if (vistos.size > 200) return null;
    }
    return [...vistos].sort((a, b) => String(a).localeCompare(String(b), "es"));
  }, [grid, filtroCol]);

  const indices = useMemo(() => {
    if (!grid?.filtro || filtroCol < 0 || !filtroValor) return null;
    const cabecera = grid.filtro.fila;
    const buscado = filtroValor.toLowerCase();
    const salida = [];
    grid.filas.forEach((fila, indice) => {
      const valor = String(fila[filtroCol] || "");
      if (indice === cabecera || valor === filtroValor || (valoresFiltro == null && valor.toLowerCase().includes(buscado))) {
        salida.push(indice);
      }
    });
    return salida;
  }, [grid, filtroCol, filtroValor, valoresFiltro]);

  async function copiar() {
    if (!grid) return;
    const filas = indices ? indices.map((indice) => grid.filas[indice]) : grid.filas;
    const lineas = [grid.columnas.join("\t"), ...filas.map((fila) => fila.join("\t"))];
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
        Los colores, los gráficos y los filtros son los del archivo. Los reportes muestran el último cálculo guardado.
      </p>
      {grid?.filtro ? (
        <div className="filtro-hoja">
          <label>
            Filtrar
            <select
              value={filtroCol}
              onChange={(evento) => {
                setFiltroCol(Number(evento.target.value));
                setFiltroValor("");
              }}
            >
              <option value={-1}>Toda la hoja</option>
              {grid.columnas.slice(grid.filtro.desde, grid.filtro.hasta + 1).map((columna, indice) => {
                const posicion = grid.filtro.desde + indice;
                const titulo = grid.filas[grid.filtro.fila]?.[posicion] || columna;
                return (
                  <option key={columna} value={posicion}>
                    {titulo}
                  </option>
                );
              })}
            </select>
          </label>
          {filtroCol >= 0 && valoresFiltro ? (
            <select value={filtroValor} onChange={(evento) => setFiltroValor(evento.target.value)}>
              <option value="">Todos</option>
              {valoresFiltro.map((valor) => (
                <option key={valor} value={valor}>
                  {valor}
                </option>
              ))}
            </select>
          ) : null}
          {filtroCol >= 0 && !valoresFiltro ? (
            <input
              value={filtroValor}
              placeholder="Escribe para filtrar"
              onChange={(evento) => setFiltroValor(evento.target.value)}
            />
          ) : null}
        </div>
      ) : null}
      {error ? <p className="aviso fallo">{error}</p> : null}
      {cargando && !grid ? <p className="aviso">Abriendo el libro…</p> : null}
      {grid ? (
        <Hoja
          key={grid.hoja}
          columnas={grid.columnas}
          filas={grid.filas}
          estilos={grid.estilos}
          pintadas={grid.pintadas}
          anchos={grid.anchos}
          altos={grid.altos}
          merges={grid.merges}
          graficos={grid.graficos}
          imagenes={grid.imagenes}
          indices={indices}
        />
      ) : (
        <div className="crece" />
      )}
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
