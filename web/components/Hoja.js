"use client";

import { useMemo, useRef, useState } from "react";

const VISTA = 640;
const CABECERA = 22;
const NUMERO = 46;

function estiloDe(estilo) {
  if (!estilo) return undefined;
  return {
    background: estilo.bg || undefined,
    color: estilo.color || undefined,
    fontWeight: estilo.bold ? 650 : 450,
    fontStyle: estilo.italic ? "italic" : undefined,
    fontSize: estilo.size ? `${estilo.size}pt` : undefined,
    textAlign: estilo.align || undefined,
  };
}

function Grafico({ grafico }) {
  const series = grafico.series || [];
  const cantidad = Math.max(0, ...series.map((serie) => serie.valores.length));
  const categorias = series[0]?.categorias || [];
  const maximo = Math.max(1, ...series.flatMap((serie) => serie.valores.filter((n) => Number.isFinite(n))));
  const horizontal = grafico.direccion !== "col";
  return (
    <div
      className="grafico"
      style={{ left: grafico.x + NUMERO, top: grafico.y + CABECERA, width: grafico.w, height: grafico.h }}
    >
      <strong>{grafico.titulo}</strong>
      {series.length > 1 ? (
        <div className="leyenda">
          {series.map((serie) => (
            <span key={serie.nombre || serie.color}>
              <i style={{ background: serie.color }} />
              {serie.nombre}
            </span>
          ))}
        </div>
      ) : null}
      <div className={horizontal ? "barras" : "columnas"}>
        {Array.from({ length: cantidad }, (_, indice) => (
          <div key={indice} className={horizontal ? "barra-fila" : "col-item"}>
            {horizontal ? <span>{categorias[indice] || ""}</span> : null}
            <div className={horizontal ? "pista" : "pista-v"}>
              {series.map((serie) => {
                const valor = serie.valores[indice] || 0;
                const medida = `${Math.max(0, (valor / maximo) * 100)}%`;
                return (
                  <div
                    key={serie.nombre || serie.color}
                    style={
                      horizontal
                        ? { width: medida, background: serie.color }
                        : { height: medida, background: serie.color, width: `${100 / series.length}%` }
                    }
                  />
                );
              })}
            </div>
            {horizontal ? null : <span>{categorias[indice] || ""}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function conjuntoInicial(flags) {
  return new Set((flags || []).flatMap((oculta, indice) => (oculta ? [indice] : [])));
}

export default function Hoja({ columnas, filas, estilos, pintadas, anchos, altos, merges, graficos, imagenes, indices, columnasOcultas, filasOcultas }) {
  const [scroll, setScroll] = useState(0);
  const [ocultasCol, setOcultasCol] = useState(() => conjuntoInicial(columnasOcultas));
  const [ocultasFila, setOcultasFila] = useState(() => conjuntoInicial(filasOcultas));
  const [marcasCol, setMarcasCol] = useState(() => new Set());
  const [marcasFila, setMarcasFila] = useState(() => new Set());
  const anclaCol = useRef(null);
  const anclaFila = useRef(null);
  const mapa = useMemo(() => {
    const salida = new Map();
    for (const [fila, columna, estilo] of pintadas || []) salida.set(`${fila},${columna}`, estilos?.[estilo]);
    return salida;
  }, [pintadas, estilos]);
  const prefijo = useMemo(() => {
    const salida = [0];
    for (const alto of altos || []) salida.push(salida[salida.length - 1] + alto);
    return salida;
  }, [altos]);
  const total = indices ? indices.length : filas.length;
  const completa = !indices && filas.length <= 160 && columnas.length <= 55;
  let inicioReal = 0;
  if (!completa && total) {
    const y = Math.max(0, scroll - 160);
    if (indices) inicioReal = Math.min(total - 1, Math.floor(y / 22));
    else {
      let bajo = 0;
      let alto = total;
      while (bajo < alto) {
        const medio = (bajo + alto) >> 1;
        if (prefijo[medio] <= y) bajo = medio + 1;
        else alto = medio;
      }
      inicioReal = Math.max(0, bajo - 1);
    }
  }
  const fin = completa ? total : Math.min(total, inicioReal + 48);

  const cubiertas = useMemo(() => {
    const origen = new Map();
    const tapa = new Set();
    if (indices) return { origen, tapa };
    const ultimo = Math.max(fin - 1, inicioReal);
    for (const merge of merges || []) {
      if (merge.r < inicioReal || merge.r + merge.filas - 1 > ultimo) continue;
      origen.set(`${merge.r},${merge.c}`, merge);
      for (let r = merge.r; r < merge.r + merge.filas; r++) {
        for (let c = merge.c; c < merge.c + merge.columnas; c++) {
          if (r !== merge.r || c !== merge.c) tapa.add(`${r},${c}`);
        }
      }
    }
    return { origen, tapa };
  }, [merges, indices, inicioReal, fin]);

  if (!filas.length) return <p className="aviso">Esta hoja no tiene valores guardados.</p>;

  function alternarVisible(setOcultas, indice) {
    setOcultas((previo) => {
      const siguiente = new Set(previo);
      siguiente.delete(indice);
      return siguiente;
    });
  }

  function marcar(setMarcas, ancla, indice, shift) {
    if (shift && ancla.current != null) {
      const desde = Math.min(ancla.current, indice);
      const hasta = Math.max(ancla.current, indice);
      const serie = new Set();
      for (let i = desde; i <= hasta; i++) serie.add(i);
      setMarcas(serie);
      return;
    }
    setMarcas((previo) => {
      const siguiente = new Set(previo);
      if (siguiente.has(indice)) siguiente.delete(indice);
      else siguiente.add(indice);
      return siguiente;
    });
    ancla.current = indice;
  }

  function marcarTodo() {
    const columnasVisibles = columnas.map((_, indice) => indice).filter((indice) => !ocultasCol.has(indice));
    const base = indices || filas.map((_, indice) => indice);
    const filasVisibles = base.filter((indice) => !ocultasFila.has(indice));
    setMarcasCol(new Set(columnasVisibles));
    setMarcasFila(new Set(filasVisibles));
  }

  function ocultarMarcadas() {
    if (!marcasCol.size && !marcasFila.size) return;
    setOcultasCol((previo) => new Set([...previo, ...marcasCol]));
    setOcultasFila((previo) => new Set([...previo, ...marcasFila]));
    setMarcasCol(new Set());
    setMarcasFila(new Set());
  }

  const letrasOcultas = [...ocultasCol].sort((a, b) => a - b);
  const numerosOcultos = [...ocultasFila].sort((a, b) => a - b);
  const anchoTotal = NUMERO + (anchos || []).reduce((suma, ancho, indice) => suma + (ocultasCol.has(indice) ? 0 : ancho), 0);
  const filaEn = (posicion) => (indices ? indices[posicion] : posicion);
  const antes = indices ? inicioReal * 22 : prefijo[inicioReal] || 0;
  const despues = indices ? (total - fin) * 22 : (prefijo[filas.length] || 0) - (prefijo[fin] || 0);

  function celdas(filaIndice) {
    const fila = filas[filaIndice] || [];
    const salida = [];
    for (let columna = 0; columna < columnas.length; columna++) {
      const clave = `${filaIndice},${columna}`;
      if (!indices && cubiertas.tapa.has(clave)) continue;
      const merge = cubiertas.origen.get(clave);
      const oculta = ocultasCol.has(columna);
      salida.push(
        <td
          key={columna}
          className={oculta ? "oculta" : undefined}
          colSpan={merge?.columnas}
          rowSpan={merge?.filas}
          style={estiloDe(mapa.get(clave))}
        >
          {oculta ? "" : fila[columna]}
        </td>
      );
    }
    return salida;
  }

  return (
    <>
    <div className="ocultas-barra">
      <span>Marca las letras y los números. Con Mayús marcas la serie. Después pulsa Ocultar.</span>
      <button type="button" className="chip" onClick={marcarTodo}>
        Marcar todo
      </button>
      <button type="button" className="chip accion" onClick={ocultarMarcadas} disabled={!marcasCol.size && !marcasFila.size}>
        Ocultar{marcasCol.size || marcasFila.size ? ` ${marcasCol.size + marcasFila.size}` : ""}
      </button>
      {marcasCol.size || marcasFila.size ? (
        <button
          type="button"
          className="chip"
          onClick={() => {
            setMarcasCol(new Set());
            setMarcasFila(new Set());
          }}
        >
          Quitar marcas
        </button>
      ) : null}
      {letrasOcultas.length ? (
        letrasOcultas.length <= 24 ? (
          letrasOcultas.map((indice) => (
            <button key={indice} type="button" className="chip" onClick={() => alternarVisible(setOcultasCol, indice)}>
              {columnas[indice]}
            </button>
          ))
        ) : (
          <button type="button" className="chip" onClick={() => setOcultasCol(new Set())}>
            {letrasOcultas.length} columnas
          </button>
        )
      ) : null}
      {numerosOcultos.length ? (
        <button type="button" className="chip" onClick={() => setOcultasFila(new Set())}>
          {numerosOcultos.length} {numerosOcultos.length === 1 ? "fila" : "filas"}
        </button>
      ) : null}
      {letrasOcultas.length || numerosOcultos.length ? (
        <button
          type="button"
          className="chip"
          onClick={() => {
            setOcultasCol(new Set());
            setOcultasFila(new Set());
          }}
        >
          Mostrar todo
        </button>
      ) : null}
    </div>
    <div className="lienzo" onScroll={(evento) => setScroll(evento.currentTarget.scrollTop)}>
      <div className="hoja-real" style={{ width: anchoTotal }}>
        <table>
          <colgroup>
            <col style={{ width: NUMERO }} />
            {(anchos || []).map((ancho, indice) => (
              <col key={indice} className={ocultasCol.has(indice) ? "oculta" : undefined} style={{ width: ocultasCol.has(indice) ? 0 : ancho }} />
            ))}
          </colgroup>
          <thead>
            <tr style={{ height: CABECERA }}>
              <th className="num" title="Marcar todas las filas y columnas" onClick={marcarTodo} />
              {columnas.map((columna, indice) => (
                <th
                  key={columna}
                  className={[ocultasCol.has(indice) ? "oculta" : "", marcasCol.has(indice) ? "marcada" : ""].filter(Boolean).join(" ") || undefined}
                  title="Marcar columna. Mayús marca la serie."
                  onMouseDown={(evento) => {
                    evento.preventDefault();
                    marcar(setMarcasCol, anclaCol, indice, evento.shiftKey);
                  }}
                >
                  {columna}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!completa && antes > 0 ? (
              <tr style={{ height: antes }}>
                <td colSpan={columnas.length + 1} />
              </tr>
            ) : null}
            {Array.from({ length: Math.max(0, fin - inicioReal) }, (_, desplazamiento) => inicioReal + desplazamiento).map((posicion) => {
              const filaIndice = filaEn(posicion);
              return (
              <tr
                key={filaIndice}
                className={ocultasFila.has(filaIndice) ? "oculta" : undefined}
                style={{ height: indices ? 22 : altos[filaIndice] || 20 }}
              >
                <td
                  className={marcasFila.has(filaIndice) ? "num marcada" : "num"}
                  title="Marcar fila. Mayús marca la serie."
                  onMouseDown={(evento) => {
                    evento.preventDefault();
                    marcar(setMarcasFila, anclaFila, filaIndice, evento.shiftKey);
                  }}
                >
                  {filaIndice + 1}
                </td>
                {celdas(filaIndice)}
              </tr>
              );
            })}
            {!completa && despues > 0 ? (
              <tr style={{ height: despues }}>
                <td colSpan={columnas.length + 1} />
              </tr>
            ) : null}
          </tbody>
        </table>
        {indices
          ? null
          : (graficos || []).map((grafico) => <Grafico key={`${grafico.titulo}-${grafico.x}-${grafico.y}`} grafico={grafico} />)}
        {indices
          ? null
          : (imagenes || []).map((imagen) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={`${imagen.x}-${imagen.y}`}
                className="foto"
                alt=""
                src={`data:${imagen.tipo};base64,${imagen.datos}`}
                style={{ left: imagen.x + NUMERO, top: imagen.y + CABECERA, width: imagen.w, height: imagen.h }}
              />
            ))}
      </div>
    </div>
    </>
  );
}
