"use client";

import { useMemo, useState } from "react";

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

export default function Hoja({ columnas, filas, estilos, pintadas, anchos, altos, merges, graficos, imagenes, indices }) {
  const [scroll, setScroll] = useState(0);
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

  const anchoTotal = NUMERO + (anchos || []).reduce((suma, ancho) => suma + ancho, 0);
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
      salida.push(
        <td key={columna} colSpan={merge?.columnas} rowSpan={merge?.filas} style={estiloDe(mapa.get(clave))}>
          {fila[columna]}
        </td>
      );
    }
    return salida;
  }

  return (
    <div className="lienzo" onScroll={(evento) => setScroll(evento.currentTarget.scrollTop)}>
      <div className="hoja-real" style={{ width: anchoTotal }}>
        <table>
          <colgroup>
            <col style={{ width: NUMERO }} />
            {(anchos || []).map((ancho, indice) => (
              <col key={indice} style={{ width: ancho }} />
            ))}
          </colgroup>
          <thead>
            <tr style={{ height: CABECERA }}>
              <th className="num" />
              {columnas.map((columna) => (
                <th key={columna}>{columna}</th>
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
              <tr key={filaIndice} style={{ height: indices ? 22 : altos[filaIndice] || 20 }}>
                <td className="num">{filaIndice + 1}</td>
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
  );
}
