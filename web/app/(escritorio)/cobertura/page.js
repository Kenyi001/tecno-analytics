"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";

const COLOR_CLAVE = "#003366";
const COLOR_MIX = "#8ecae6";
const COLOR_TECNO = "#009bde";

const CORTES = [
  { id: "lk7", nombre: "LK7", detalle: "Cualquier LK7, Lambo incluido.", color: COLOR_CLAVE },
  { id: "lambo", nombre: "LK7 Lamborghini Black", detalle: "Solo el color Lambo.", color: COLOR_MIX },
  { id: "lk7k", nombre: "LK7K", detalle: "Solo LK7K.", color: COLOR_TECNO },
];

function tarjeta(grupo) {
  if (!grupo) return null;
  return grupo;
}

function numero(valor) {
  return new Intl.NumberFormat("es-BO").format(valor ?? 0);
}

function pctTexto(valor) {
  if (valor == null || valor === "") return "";
  return `${valor}%`;
}

/** Agrupa filas planas (ciudad/circuito + totales) en bloques expandibles. */
function gruposDeTabla(filas) {
  const grupos = [];
  let actual = null;
  for (const fila of filas || []) {
    if (fila.esTotal) {
      if (/grand/i.test(fila.ciudad) || /^total$/i.test(fila.ciudad.trim())) {
        grupos.push({ tipo: "grand", fila });
        actual = null;
        continue;
      }
      if (actual) {
        actual.total = fila;
        grupos.push(actual);
        actual = null;
      } else {
        grupos.push({ tipo: "total", fila });
      }
      continue;
    }
    const nombreCiudad = fila.ciudad;
    if (!actual || actual.ciudad !== nombreCiudad) {
      if (actual) grupos.push(actual);
      actual = { tipo: "ciudad", ciudad: nombreCiudad, circuitos: [fila], total: null };
    } else {
      actual.circuitos.push(fila);
    }
  }
  if (actual) grupos.push(actual);
  return grupos;
}

function TablaCiudadCircuito({ titulo, filas, conStock }) {
  const grupos = useMemo(() => gruposDeTabla(filas), [filas]);
  const [abiertas, setAbiertas] = useState(() => new Set());

  useEffect(() => {
    setAbiertas(new Set(grupos.filter((g) => g.tipo === "ciudad").map((g) => g.ciudad)));
  }, [grupos]);

  function toggle(ciudad) {
    setAbiertas((prev) => {
      const next = new Set(prev);
      if (next.has(ciudad)) next.delete(ciudad);
      else next.add(ciudad);
      return next;
    });
  }

  if (!filas?.length) return null;

  return (
    <article className="panel cobertura-tabla-panel">
      <h2>{titulo}</h2>
      <div className="tabla-scroll">
        <table className="tabla-densa cobertura-pivot">
          <thead>
            <tr>
              <th>Ciudad</th>
              <th>Circuito</th>
              <th>Total tiendas</th>
              <th>Cuenta LK7</th>
              <th>LK7 (L)</th>
              <th>% LK7</th>
              <th>% LK7K</th>
              {conStock ? (
                <>
                  <th>Stock LK7</th>
                  <th>Stock LK6</th>
                </>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {grupos.map((g, gi) => {
              if (g.tipo === "grand" || g.tipo === "total") {
                const fila = g.fila;
                return (
                  <tr key={`t-${gi}`} className="fila-total">
                    <td colSpan={2}>{fila.ciudad}</td>
                    <td>{numero(fila.totalTiendas)}</td>
                    <td>{numero(fila.lk7)}</td>
                    <td>{numero(fila.lambo)}</td>
                    <td>{pctTexto(fila.pctLk7)}</td>
                    <td>{pctTexto(fila.pctLk7k)}</td>
                    {conStock ? (
                      <>
                        <td>{numero(fila.stockLk7)}</td>
                        <td>{numero(fila.stockLk6)}</td>
                      </>
                    ) : null}
                  </tr>
                );
              }
              const abierta = abiertas.has(g.ciudad);
              const tot = g.total;
              return (
                <Fragment key={`c-${g.ciudad}`}>
                  <tr className="fila-ciudad">
                    <td>
                      <button type="button" className="btn-texto" onClick={() => toggle(g.ciudad)}>
                        {abierta ? "▾" : "▸"} {g.ciudad}
                      </button>
                    </td>
                    <td colSpan={conStock ? 8 : 6} />
                  </tr>
                  {abierta
                    ? g.circuitos.map((fila, i) => (
                        <tr key={`${g.ciudad}-${fila.circuito}-${i}`} className="fila-circuito">
                          <td />
                          <td>{fila.circuito}</td>
                          <td>{numero(fila.totalTiendas)}</td>
                          <td>{numero(fila.lk7)}</td>
                          <td>{numero(fila.lambo)}</td>
                          <td>{pctTexto(fila.pctLk7)}</td>
                          <td>{pctTexto(fila.pctLk7k)}</td>
                          {conStock ? (
                            <>
                              <td>{numero(fila.stockLk7)}</td>
                              <td>{numero(fila.stockLk6)}</td>
                            </>
                          ) : null}
                        </tr>
                      ))
                    : null}
                  {tot ? (
                    <tr className="fila-total">
                      <td colSpan={2}>{tot.ciudad}</td>
                      <td>{numero(tot.totalTiendas)}</td>
                      <td>{numero(tot.lk7)}</td>
                      <td>{numero(tot.lambo)}</td>
                      <td>{pctTexto(tot.pctLk7)}</td>
                      <td>{pctTexto(tot.pctLk7k)}</td>
                      {conStock ? (
                        <>
                          <td>{numero(tot.stockLk7)}</td>
                          <td>{numero(tot.stockLk6)}</td>
                        </>
                      ) : null}
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}

async function esExcel(archivo) {
  const firma = new Uint8Array(await archivo.slice(0, 2).arrayBuffer());
  return firma[0] === 0x50 && firma[1] === 0x4b;
}

export default function Cobertura() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [actualizando, setActualizando] = useState(false);
  const [progreso, setProgreso] = useState({ avance: 8, frase: "En fila para empezar." });
  const archivoRef = useRef(null);
  const timer = useRef(null);

  function cargar() {
    return fetch("/api/cobertura", { cache: "no-store" })
      .then(async (respuesta) => {
        if (!respuesta.ok) throw new Error("lectura");
        setDatos(await respuesta.json());
        setError("");
      })
      .catch(() => setError("No se pudo leer la cobertura."));
  }

  useEffect(() => {
    cargar();
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  async function actualizar() {
    if (!datos || actualizando || subiendo) return;
    if (!datos.tieneLibro) {
      setAviso("Primero sube el Excel de cobertura. Sin ese libro no se puede pegar el stock.");
      return;
    }
    setAviso("");
    setProgreso({ avance: 8, frase: "En fila para empezar." });
    setActualizando(true);
    const respuesta = await fetch("/api/cobertura", { method: "POST" });
    const cuerpo = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
      setActualizando(false);
      setAviso(cuerpo.aviso || "No se pudo pedir la actualización.");
      return;
    }
    const desde = cuerpo.desde;
    const limite = Date.now() + 28 * 60 * 1000;
    timer.current = setInterval(async () => {
      if (Date.now() > limite) {
        clearInterval(timer.current);
        setActualizando(false);
        setAviso("La actualización sigue en curso. Vuelve a abrir Cobertura en unos minutos.");
        return;
      }
      try {
        const estado = await fetch(`/api/cobertura/estado?desde=${desde}`, { cache: "no-store" });
        const cuerpoEstado = await estado.json();
        if (cuerpoEstado.frase || cuerpoEstado.avance) {
          setProgreso({
            avance: cuerpoEstado.estado === "listo" ? 100 : cuerpoEstado.avance || 12,
            frase: cuerpoEstado.frase || "Trabajando en la actualización.",
          });
        }
        if (cuerpoEstado.estado === "listo") {
          clearInterval(timer.current);
          setProgreso({ avance: 100, frase: "Listo." });
          await cargar();
          setTimeout(() => setActualizando(false), 900);
        } else if (cuerpoEstado.estado === "fallo") {
          clearInterval(timer.current);
          setActualizando(false);
          setAviso(cuerpoEstado.aviso || "La actualización de cobertura no terminó.");
        }
      } catch {
        // La siguiente vuelta vuelve a preguntar.
      }
    }, 8000);
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
      await upload("cobertura/actual.xlsx", archivo, {
        access: "private",
        handleUploadUrl: "/api/cobertura/subir",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        multipart: archivo.size > 4 * 1024 * 1024,
      });
      await cargar();
      setAviso("Excel subido. La fecha de actualización ya es la de esta subida.");
    } catch {
      setAviso("No se pudo subir el Excel.");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <section>
      <div className="encabezado">
        <div>
          <h1>Cobertura</h1>
          <p className="ciclo">
            {datos?.referenciaTexto && datos?.cierreTexto
              ? `Tiendas con stock al ${datos.referenciaTexto}. Pronóstico al ${datos.cierreTexto}.`
              : "Tiendas del circuito con al menos un teléfono clave."}
          </p>
        </div>
        <div className="actualizar">
          {actualizando ? (
            <div className="progreso" role="status" aria-live="polite">
              <div className="progreso-pista">
                <div className="progreso-barra" style={{ width: `${Math.max(8, Math.min(100, progreso.avance))}%` }} />
              </div>
              <p className="sub">{progreso.frase}</p>
            </div>
          ) : (
            <button
              type="button"
              className="btn"
              onClick={actualizar}
              disabled={!datos || subiendo || !datos.tieneLibro}
            >
              Actualizar stock
            </button>
          )}
          {datos?.actualizadoTexto ? (
            <p className="sub">
              Última actualización {datos.actualizadoTexto}. Datos del Excel hasta {datos.referenciaTexto}.
            </p>
          ) : datos?.tieneLibro ? (
            <p className="sub">Todavía no hay una actualización de cobertura.</p>
          ) : datos ? (
            <p className="sub">Sube el Excel una vez para poder actualizar el stock desde DCR.</p>
          ) : null}
        </div>
      </div>
      {aviso ? (
        <p className={`aviso${aviso.startsWith("Excel subido") ? "" : " fallo"}`}>{aviso}</p>
      ) : null}
      {error ? <p className="aviso fallo">{error}</p> : null}
      {!datos && !error ? <p className="aviso">Cargando cobertura…</p> : null}
      {datos ? (
        <article className="panel lista-archivos">
          <h2>
            {datos.referenciaTexto && datos.cierreTexto
              ? `Reporte del ${datos.referenciaTexto} – ${datos.cierreTexto}`
              : "Reporte de cobertura"}
          </h2>
          <div className="reporte-actual">
            <div>
              <p className="sub">Total {datos.filasDatos} registros.</p>
              <p className="sub">
                Abre el libro de este reporte
                {datos.referenciaTexto && datos.cierreTexto
                  ? `, del ${datos.referenciaTexto} al ${datos.cierreTexto},`
                  : ""}{" "}
                en el navegador.
              </p>
              <p className="sub">
                {datos.tiendas} tiendas · Top 300: {datos.top300}. Para cambiar el libro, edítalo en Excel, ciérralo y súbelo. La fecha de arriba pasa a ser la de esa subida.
              </p>
            </div>
            <div className="reporte-acciones">
              <label className={`btn secundario${subiendo ? " ocupado" : ""}`}>
                {subiendo ? "Subiendo…" : "Subir Excel"}
                <input
                  ref={archivoRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  hidden
                  disabled={subiendo}
                  onChange={subirExcel}
                />
              </label>
              <Link className="btn" href="/cobertura/libro">
                Abrir el Excel
              </Link>
            </div>
          </div>
        </article>
      ) : null}
      {datos ? (
        <>
          <p className="sub explicacion">
            Porcentaje de tiendas con al menos 1 unidad. Stock = unidades en tienda.
          </p>
          <div className="tres-conteos">
            {CORTES.map((corte) => {
              const todas = tarjeta(datos.grupos?.[corte.id]?.todas);
              if (!todas) return null;
              const avance = Math.min(100, Math.max(0, todas.pct || 0));
              return (
                <article key={corte.id} className="panel cobertura-tarjeta">
                  <h2>{corte.nombre}</h2>
                  <p className="sub explicacion">{corte.detalle}</p>
                  <div className="cobertura-pista" aria-hidden="true">
                    <span style={{ width: `${avance}%`, background: corte.color }} />
                  </div>
                  <div className="numeros">
                    <article>
                      <span>Tiendas con stock</span>
                      <strong style={{ color: corte.color }}>{todas.pct}%</strong>
                      <p className="sub">
                        {numero(todas.cubiertas)} de {numero(todas.total)} tiendas
                      </p>
                    </article>
                    <article>
                      <span>Stock</span>
                      <strong>{numero(todas.cantidad)}</strong>
                      <p className="sub">unidades en tienda</p>
                    </article>
                  </div>
                </article>
              );
            })}
          </div>

          {datos.tablaTodas?.length || datos.tablaTop300?.length ? (
            <div className="cobertura-dos-tablas">
              <TablaCiudadCircuito titulo="Todas las tiendas" filas={datos.tablaTodas} conStock={false} />
              <TablaCiudadCircuito titulo="Tiendas Top 300" filas={datos.tablaTop300} conStock />
            </div>
          ) : datos.tieneLibro ? (
            <p className="sub explicacion">
              Las tablas por ciudad y circuito se arman al abrir esta página o al subir de nuevo el Excel.
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
