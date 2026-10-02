"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";

function numero(valor) {
  return new Intl.NumberFormat("es-BO").format(valor ?? 0);
}

async function esExcel(archivo) {
  const firma = new Uint8Array(await archivo.slice(0, 2).arrayBuffer());
  return firma[0] === 0x50 && firma[1] === 0x4b;
}

export default function Mayorista() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [desde, setDesde] = useState("2026-09-28");
  const [marca, setMarca] = useState("TECNO");
  const [abiertas, setAbiertas] = useState(() => new Set());
  const archivoRef = useRef(null);

  const cargar = useCallback(
    (opts = {}) => {
      const d = opts.desde ?? desde;
      const m = opts.marca ?? marca;
      const q = new URLSearchParams();
      if (d) q.set("desde", d);
      if (m) q.set("marca", m);
      return fetch(`/api/mayorista?${q}`, { cache: "no-store" })
        .then(async (respuesta) => {
          if (!respuesta.ok) throw new Error("lectura");
          const json = await respuesta.json();
          setDatos(json);
          if (json.umbralFecha) setDesde(json.umbralFecha);
          if (json.marca) setMarca(json.marca);
          setError("");
        })
        .catch(() => setError("No se pudo leer el stock mayorista."));
    },
    [desde, marca],
  );

  useEffect(() => {
    cargar();
    // Solo al montar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleCiudad(ciudad) {
    setAbiertas((prev) => {
      const next = new Set(prev);
      if (next.has(ciudad)) next.delete(ciudad);
      else next.add(ciudad);
      return next;
    });
  }

  async function subirExcel(evento) {
    const archivo = evento.target.files?.[0];
    evento.target.value = "";
    if (!archivo) return;
    if (!archivo.name.toLowerCase().endsWith(".xlsx") || !(await esExcel(archivo))) {
      setAviso("El archivo tiene que ser un Excel .xlsx.");
      return;
    }
    setSubiendo(true);
    setAviso("");
    try {
      await upload("mayorista/actual.xlsx", archivo, {
        access: "private",
        handleUploadUrl: "/api/mayorista/subir",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        multipart: archivo.size > 4 * 1024 * 1024,
      });
      await cargar();
      setAviso("Excel subido. La tabla ya usa Visitas Channel.");
    } catch {
      setAviso("No se pudo subir el Excel.");
    } finally {
      setSubiendo(false);
    }
  }

  const modelos = datos?.modelos || [];

  const filasTabla = useMemo(() => {
    if (!datos?.ciudades?.length) return [];
    const filas = [];
    for (const ciudad of datos.ciudades) {
      const abierta = abiertas.has(ciudad.ciudad);
      filas.push({ tipo: "ciudad", ciudad, abierta });
      if (abierta) {
        for (const may of ciudad.mayoristas) {
          filas.push({ tipo: "mayorista", ciudad: ciudad.ciudad, may });
        }
      }
    }
    return filas;
  }, [datos, abiertas]);

  return (
    <section>
      <div className="encabezado">
        <div>
          <h1>Stock Mayorista</h1>
          <p className="ciclo">Stock por ciudad y mayorista × modelo (Visitas Channel).</p>
        </div>
        <div className="actualizar">
          {datos?.actualizadoTexto ? (
            <p className="sub">Última actualización {datos.actualizadoTexto}.</p>
          ) : (
            <p className="sub">Sube Visitas Channel.xlsx para armar la tabla.</p>
          )}
          {datos?.umbralTexto ? (
            <p className="sub">
              Filtro: marca {datos.marca || marca}, enviado después del {datos.umbralTexto}.
            </p>
          ) : null}
        </div>
      </div>

      <article className="panel lista-archivos">
        <h2>Archivo y filtros</h2>
        <div className="reporte-actual">
          <div className="mayorista-filtros">
            <label>
              Desde (exclusivo)
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
            </label>
            <label>
              Marca
              <select value={marca} onChange={(e) => setMarca(e.target.value)}>
                {(datos?.marcas?.length ? datos.marcas : ["TECNO"]).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn" onClick={() => cargar({ desde, marca })} disabled={subiendo}>
              Aplicar filtros
            </button>
          </div>
          <div className="reporte-acciones">
            <label className={`btn secundario${subiendo ? " ocupado" : ""}`}>
              {subiendo ? "Subiendo…" : "Subir Visitas Channel"}
              <input
                ref={archivoRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                hidden
                disabled={subiendo}
                onChange={subirExcel}
              />
            </label>
            {datos?.tieneLibro ? (
              <a className="btn secundario" href="/api/mayorista/descarga">
                Descargar Excel
              </a>
            ) : null}
          </div>
        </div>
      </article>

      {aviso ? (
        <p className={`aviso${aviso.startsWith("Excel subido") ? "" : " fallo"}`}>{aviso}</p>
      ) : null}
      {error ? <p className="aviso fallo">{error}</p> : null}
      {!datos && !error ? <p className="aviso">Cargando stock mayorista…</p> : null}

      {datos ? (
        <>
          <p className="sub explicacion">
            Total {numero(datos.total)} unidades · {numero(datos.filasUsadas || 0)} filas · {modelos.length}{" "}
            modelos.
          </p>
          <div className="tabla-scroll mayorista-tabla-wrap">
            <table className="tabla-densa mayorista-tabla">
              <thead>
                <tr>
                  <th className="sticky-col">Ciudad / Mayorista</th>
                  {modelos.map((m) => (
                    <th key={m}>{m}</th>
                  ))}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {filasTabla.map((fila) => {
                  if (fila.tipo === "ciudad") {
                    const c = fila.ciudad;
                    return (
                      <tr key={`c-${c.ciudad}`} className="fila-ciudad">
                        <td className="sticky-col">
                          <button type="button" className="btn-texto" onClick={() => toggleCiudad(c.ciudad)}>
                            {fila.abierta ? "▾" : "▸"} {c.ciudad}
                          </button>
                        </td>
                        {modelos.map((m) => (
                          <td key={m}>{c.porModelo?.[m] ? numero(c.porModelo[m]) : ""}</td>
                        ))}
                        <td>
                          <strong>{numero(c.total)}</strong>
                        </td>
                      </tr>
                    );
                  }
                  const may = fila.may;
                  return (
                    <tr key={`m-${fila.ciudad}-${may.nombre}`} className="fila-mayorista">
                      <td className="sticky-col indent">{may.nombre}</td>
                      {modelos.map((m) => (
                        <td key={m}>{may.porModelo?.[m] ? numero(may.porModelo[m]) : ""}</td>
                      ))}
                      <td>{numero(may.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="fila-total">
                  <td className="sticky-col">
                    <strong>Total</strong>
                  </td>
                  {modelos.map((m) => (
                    <td key={m}>
                      <strong>{numero(datos.totalesModelo?.[m] || 0)}</strong>
                    </td>
                  ))}
                  <td>
                    <strong>{numero(datos.total)}</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
